// Energy per job on Apple Silicon with macmon (power counters, no sudo), the
// same method as apps/pool/meter.mjs:
//   chip = all_power + ram_power + gpu_ram_power, summed over each job
//   net  = chip minus the idle baseline (a moving average while no job runs)
//   sys  = the whole computer
// No macmon: energy stays unknown, jobs still run.
use crate::core::Energy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Default)]
struct State {
    active: HashMap<u64, (Instant, f64, f64)>, // job -> (start, chip J, system J)
    next: u64,
    idle_w: Option<f64>,
    last_ms: Option<f64>,
    samples: u64,
    gpu_c: Option<f64>,
    // For the window's live line: the latest sample.
    chip_w: f64,
    shown_c: Option<f64>, // the hotter of CPU and GPU (the idle GPU sensor can read 9 °C)
    mem_used: f64,        // bytes
    mem_total: f64,
}

// What the window's live line shows.
pub struct Live {
    pub watts: f64,
    pub c: Option<f64>,
    pub mem_used_gb: f64,
    pub mem_total_gb: f64,
}

#[derive(Clone)]
pub struct Meter(Arc<Mutex<State>>, Arc<tokio::sync::Notify>);

impl Meter {
    // Starts `macmon pipe -i 250` and reads its samples in the background.
    pub fn start(macmon: &str) -> Meter {
        let meter = Meter(Arc::default(), Arc::default());
        let child = Command::new(macmon)
            .args(["pipe", "-i", "250"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn();
        let Ok(mut child) = child else { return meter };
        let out = child.stdout.take().unwrap();
        let (state, closed) = (meter.0.clone(), meter.1.clone());
        tokio::spawn(async move {
            let _child = child; // macmon is stopped when this task ends
            let mut lines = BufReader::new(out).lines();
            loop {
                let line = tokio::select! {
                    l = lines.next_line() => match l { Ok(Some(l)) => l, _ => break },
                    _ = closed.notified() => break,
                };
                let Ok(s) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
                let f = |k: &str| s[k].as_f64().unwrap_or(0.0);
                let chip = f("all_power") + f("ram_power") + f("gpu_ram_power");
                let sys = f("sys_power");
                let t = s["timestamp"].as_str().and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
                    .map_or_else(|| chrono::Utc::now().timestamp_millis() as f64, |t| t.timestamp_millis() as f64);
                let mut st = state.lock().unwrap();
                if let Some(last) = st.last_ms {
                    let dt = (t - last) / 1000.0;
                    for (_, c, y) in st.active.values_mut() {
                        *c += chip * dt;
                        *y += sys * dt;
                    }
                }
                if st.active.is_empty() {
                    st.idle_w = Some(st.idle_w.map_or(chip, |w| w * 0.95 + chip * 0.05));
                }
                st.last_ms = Some(t);
                if let Some(c) = s["temp"]["gpu_temp_avg"].as_f64() {
                    st.gpu_c = Some(c);
                }
                st.chip_w = chip;
                let cpu_c = s["temp"]["cpu_temp_avg"].as_f64();
                st.shown_c = match (cpu_c, st.gpu_c) { (Some(a), Some(b)) => Some(a.max(b)), (a, b) => a.or(b) };
                st.mem_used = s["memory"]["ram_usage"].as_f64().unwrap_or(0.0);
                st.mem_total = s["memory"]["ram_total"].as_f64().unwrap_or(0.0);
                st.samples += 1;
            }
        });
        meter
    }

    pub fn begin(&self) -> u64 {
        let mut st = self.0.lock().unwrap();
        st.next += 1;
        let id = st.next;
        st.active.insert(id, (Instant::now(), 0.0, 0.0));
        id
    }

    // The job's energy, or None when macmon gave nothing.
    pub fn end(&self, id: u64) -> Option<Energy> {
        let mut st = self.0.lock().unwrap();
        let (t0, chip, sys) = st.active.remove(&id)?;
        if st.samples == 0 {
            return None;
        }
        let secs = t0.elapsed().as_secs_f64();
        let round = |x: f64| (x * 100.0).round() / 100.0;
        Some(Energy {
            energy_j: round(chip),
            energy_net_j: round((chip - st.idle_w.unwrap_or(0.0) * secs).max(0.0)),
            sys_energy_j: round(sys),
            source: "macmon".into(),
        })
    }

    // Stops macmon.
    pub fn close(&self) {
        self.1.notify_one();
    }

    pub fn gpu_c(&self) -> Option<f64> {
        self.0.lock().unwrap().gpu_c
    }

    // The latest sample for the window, or None before macmon has spoken.
    pub fn live(&self) -> Option<Live> {
        let st = self.0.lock().unwrap();
        if st.samples == 0 {
            return None;
        }
        let gb = |b: f64| b / 1024f64.powi(3);
        Some(Live { watts: st.chip_w, c: st.shown_c, mem_used_gb: gb(st.mem_used), mem_total_gb: gb(st.mem_total) })
    }
}
