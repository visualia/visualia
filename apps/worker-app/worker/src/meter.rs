// Energy per job on Apple Silicon with macmon's library (IOReport power
// counters, SMC temperatures, no sudo, nothing to install), the same method
// as apps/pool/meter.mjs:
//   chip = all_power + ram_power + gpu_ram_power, summed over each job
//   net  = chip minus the idle baseline (a moving average while no job runs)
//   sys  = the whole computer
// Not a Mac, or the counters can't be read: energy stays unknown, jobs still run.
use crate::core::Energy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

const INTERVAL_MS: u32 = 250;

#[derive(Default)]
struct State {
    active: HashMap<u64, (Instant, f64, f64)>, // job -> (start, chip J, system J)
    next: u64,
    idle_w: Option<f64>,
    last: Option<Instant>,
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
pub struct Meter(Arc<Mutex<State>>, Arc<AtomicBool>);

// One reading, in the units the state keeps (W, °C, bytes).
struct Sample {
    chip: f64,
    sys: f64,
    cpu_c: Option<f64>,
    gpu_c: Option<f64>,
    mem_used: f64,
    mem_total: f64,
}

impl Meter {
    // Samples every INTERVAL_MS on a thread of its own (macmon's sampler
    // blocks for the interval) until close().
    pub fn start() -> Meter {
        let meter = Meter(Arc::default(), Arc::default());
        let (state, closed) = (meter.0.clone(), meter.1.clone());
        std::thread::spawn(move || {
            let Some(mut next) = sampler() else { return };
            while !closed.load(Ordering::Relaxed) {
                let Some(s) = next() else { break };
                record(&mut state.lock().unwrap(), s, Instant::now());
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

    // Stops sampling (within one interval).
    pub fn close(&self) {
        self.1.store(true, Ordering::Relaxed);
    }

    pub fn gpu_c(&self) -> Option<f64> {
        self.0.lock().unwrap().gpu_c
    }

    // The latest sample for the window, or None before the first one.
    pub fn live(&self) -> Option<Live> {
        let st = self.0.lock().unwrap();
        if st.samples == 0 {
            return None;
        }
        let gb = |b: f64| b / 1024f64.powi(3);
        Some(Live { watts: st.chip_w, c: st.shown_c, mem_used_gb: gb(st.mem_used), mem_total_gb: gb(st.mem_total) })
    }
}

fn record(st: &mut State, s: Sample, t: Instant) {
    if let Some(last) = st.last {
        let dt = t.duration_since(last).as_secs_f64();
        for (_, c, y) in st.active.values_mut() {
            *c += s.chip * dt;
            *y += s.sys * dt;
        }
    }
    if st.active.is_empty() {
        st.idle_w = Some(st.idle_w.map_or(s.chip, |w| w * 0.95 + s.chip * 0.05));
    }
    st.last = Some(t);
    if s.gpu_c.is_some() {
        st.gpu_c = s.gpu_c;
    }
    st.chip_w = s.chip;
    st.shown_c = match (s.cpu_c, st.gpu_c) { (Some(a), Some(b)) => Some(a.max(b)), (a, b) => a.or(b) };
    st.mem_used = s.mem_used;
    st.mem_total = s.mem_total;
    st.samples += 1;
}

// A function giving the next sample, or None when the counters can't be read.
#[cfg(target_os = "macos")]
fn sampler() -> Option<impl FnMut() -> Option<Sample>> {
    let mut m = macmon::Sampler::new().ok()?;
    Some(move || {
        let x = m.get_metrics(INTERVAL_MS).ok()?;
        Some(Sample {
            chip: (x.all_power + x.ram_power + x.gpu_ram_power) as f64,
            sys: x.sys_power as f64,
            cpu_c: x.temp.cpu_temp_avg.map(f64::from),
            gpu_c: x.temp.gpu_temp_avg.map(f64::from),
            mem_used: x.memory.ram_usage as f64,
            mem_total: x.memory.ram_total as f64,
        })
    })
}

#[cfg(not(target_os = "macos"))]
fn sampler() -> Option<fn() -> Option<Sample>> {
    None
}

// On a Mac: the counters are read in-process, with no macmon installed.
// `cargo test -p worker meter -- --nocapture` prints what it saw.
#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn reads_power_temperature_and_memory() {
        let m = Meter::start();
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let job = m.begin();
        let t0 = Instant::now();
        while t0.elapsed().as_millis() < 1500 {} // a second and a half of busy CPU
        let e = m.end(job).expect("no samples: IOReport not readable");
        let l = m.live().unwrap();
        m.close();
        println!("chip {:.2} W, {:?} °C, {:.1}/{:.1} GB; job: {:?} J chip, {:?} J net, {:?} J system",
            l.watts, l.c, l.mem_used_gb, l.mem_total_gb, e.energy_j, e.energy_net_j, e.sys_energy_j);
        assert!(l.watts > 0.0 && l.mem_total_gb > 1.0);
        assert!(e.energy_j > 0.0, "a busy job used no energy");
        assert!(l.c.is_some_and(|c| c > 10.0 && c < 120.0));
    }
}
