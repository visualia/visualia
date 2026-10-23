// Visualia Pool (the worker app): puts this computer's Ollama models into the class pool
// (plans/pool.md, plans/worker-app.md). The app is a window and a keychain
// entry around the same worker the `visualia-worker` program runs
// (../worker): it connects out to pool.visualia.space and to Ollama on
// 127.0.0.1 only, and tells the window about each job (never the prompt).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Duration;
use tauri::{async_runtime, AppHandle, Emitter, Manager, RunEvent, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;
use worker::{core, native};

// The course key lives in the macOS keychain (Windows: Credential Manager),
// never in a file. The window can save it and forget it, not read it.
const SERVICE: &str = "space.visualia.pool";
const ACCOUNT: &str = "course-key";
// Pool name = Ollama tag; offered only when Ollama has the tag.
const MODELS: &str = "qwen3.5-9b=qwen3.5:9b,gemma4-26b=gemma4:26b,clef-flash=clef-flash-8k";
const OLLAMA: &str = "http://127.0.0.1:11434";
// The one page the app opens in the browser: where people get Ollama.
const GET_OLLAMA: &str = "https://ollama.com/download";

// The running worker (its stop switch and task), and its latest "joined" or
// "waiting" event, so a window that opens later can show where things stand.
struct Worker {
    running: Mutex<Option<(watch::Sender<bool>, async_runtime::JoinHandle<()>)>>,
    last: Mutex<Option<serde_json::Value>>,
    download: Mutex<Option<CancellationToken>>, // the model being downloaded, if any
}

fn keychain() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
async fn has_key() -> bool {
    keychain().and_then(|e| e.get_password().map_err(|e| e.to_string())).is_ok()
}

// Whether the worker runs, and its latest joined/waiting event.
#[tauri::command]
fn status(state: State<'_, Worker>) -> serde_json::Value {
    let running = state.running.lock().unwrap().as_ref().is_some_and(|(_, task)| !task.inner().is_finished());
    serde_json::json!({ "running": running, "last": if running { state.last.lock().unwrap().clone() } else { None } })
}

#[tauri::command]
fn save_key(key: String) -> Result<(), String> {
    let letters: String = key.to_uppercase().chars().filter(|c| c.is_ascii_uppercase()).collect();
    if letters.len() != 8 {
        return Err("A course key has eight letters, like ABCD-EFGH.".into());
    }
    keychain()?.set_password(&letters).map_err(|e| e.to_string())
}

#[tauri::command]
async fn forget_key(state: State<'_, Worker>) -> Result<(), String> {
    stop(&state).await;
    match keychain()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ---- before joining: Ollama, the models, the memory -------------------------

// The models the app can download here (debug builds: plus a small one from
// VISUALIA_TEST_GET, "name=tag", to test downloads without pulling gigabytes).
fn gettable() -> Vec<(String, String, f64, u64)> {
    let mut list: Vec<_> = core::GETTABLE.iter().map(|(n, t, gb, need)| (n.to_string(), t.to_string(), *gb, *need)).collect();
    #[cfg(debug_assertions)]
    if let Some((n, t)) = std::env::var("VISUALIA_TEST_GET").ok().and_then(|v| v.split_once('=').map(|(a, b)| (a.to_string(), b.to_string()))) {
        list.push((n, t, 0.5, 0));
    }
    list
}

// The computer's memory in GB (macOS: hw.memsize; elsewhere unknown for now).
fn memory_gb() -> Option<u64> {
    let out = std::process::Command::new("/usr/sbin/sysctl").args(["-n", "hw.memsize"]).output().ok()?;
    let bytes: u64 = String::from_utf8_lossy(&out.stdout).trim().parse().ok()?;
    Some((bytes as f64 / 1024f64.powi(3)).round() as u64)
}

// The chip's name, e.g. "Apple M1 Pro" (macOS; elsewhere unknown for now).
fn chip_name() -> Option<String> {
    let out = std::process::Command::new("/usr/sbin/sysctl").args(["-n", "machdep.cpu.brand_string"]).output().ok()?;
    let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!name.is_empty()).then_some(name)
}

// Is Ollama here, which models it has, and which ones this computer can run.
#[tauri::command]
async fn check() -> serde_json::Value {
    let http = native::http();
    let memory = memory_gb();
    let Some(version) = native::ollama_version(&http, OLLAMA).await else {
        return serde_json::json!({ "ollama": false, "memory_gb": memory, "chip": chip_name() });
    };
    let have = native::ollama_tags(&http, OLLAMA).await.unwrap_or_default();
    let is_here = |tag: &str| have.iter().any(|i| i == tag || *i == format!("{tag}:latest"));
    let models: Vec<_> = gettable().into_iter().map(|(name, tag, gb, need)| serde_json::json!({
        "name": name, "tag": tag, "gb": gb, "need_gb": need,
        "fits": core::fits_memory(memory, need), "here": is_here(&tag),
    })).collect();
    let ready = !core::offered(&core::parse_models(MODELS), &have).is_empty();
    // MLX when Ollama runs any downloaded model with it (Apple Silicon builds).
    let mut mlx = false;
    for (_, tag, _, _) in gettable() {
        if is_here(&tag) && native::ollama_runner(&http, OLLAMA, &tag).await.as_deref() == Some("mlx") { mlx = true; }
    }
    serde_json::json!({ "ollama": true, "version": version, "memory_gb": memory, "chip": chip_name(), "mlx": mlx, "models": models, "ready": ready })
}

// Downloads one of the offered models through Ollama; the window hears
// `download` events: { tag, percent } as it goes, then { tag, done } or { tag, error }.
#[tauri::command]
fn get_model(app: AppHandle, tag: String) -> Result<(), String> {
    if !gettable().iter().any(|(_, t, _, _)| *t == tag) {
        return Err("not a model this app offers".into());
    }
    let stop = CancellationToken::new();
    {
        let state = app.state::<Worker>();
        let mut slot = state.download.lock().unwrap();
        if slot.is_some() {
            return Err("one download at a time".into());
        }
        *slot = Some(stop.clone());
    }
    async_runtime::spawn(async move {
        let window = app.clone();
        let t = tag.clone();
        let result = native::pull(&native::http(), OLLAMA, &tag, stop, move |p| {
            let _ = window.emit("download", serde_json::json!({ "tag": t, "percent": p }));
        }).await;
        let state = app.state::<Worker>();
        *state.download.lock().unwrap() = None;
        let _ = app.emit("download", match result {
            Ok(()) => serde_json::json!({ "tag": tag, "done": true }),
            Err(e) => serde_json::json!({ "tag": tag, "error": e }),
        });
    });
    Ok(())
}

#[tauri::command]
fn stop_download(state: State<'_, Worker>) {
    if let Some(stop) = state.download.lock().unwrap().take() {
        stop.cancel();
    }
}

#[tauri::command]
fn open_get_ollama(app: AppHandle) -> Result<(), String> {
    app.opener().open_url(GET_OLLAMA, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn join(app: AppHandle) -> Result<(), String> {
    start(&app)
}

fn start(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Worker>();
    let mut slot = state.running.lock().unwrap();
    if slot.as_ref().is_some_and(|(_, task)| !task.inner().is_finished()) {
        return Ok(()); // already in the pool
    }
    // Debug builds only: a key in the environment is used as it is, for tests
    // on a machine nobody is looking at (its keychain may be locked).
    #[cfg(debug_assertions)]
    let from_env = std::env::var("VISUALIA_KEY").ok();
    #[cfg(not(debug_assertions))]
    let from_env: Option<String> = None;
    let key = match from_env {
        Some(k) => k,
        None => keychain()?.get_password().map_err(|_| "No course key saved.".to_string())?,
    };
    let cfg = native::Config {
        pool: "https://pool.visualia.space".into(),
        ollama: OLLAMA.into(),
        key,
        models: core::parse_models(MODELS),
    };
    let window = app.clone();
    let events: native::Events = std::sync::Arc::new(move |e: serde_json::Value| {
        if matches!(e["type"].as_str(), Some("joined" | "waiting")) {
            *window.state::<Worker>().last.lock().unwrap() = Some(e.clone());
        }
        let _ = window.emit("worker", e);
    });
    let (switch, stopped) = watch::channel(false);
    let window = app.clone();
    let task = async_runtime::spawn(async move {
        native::run(cfg, Some(events), stopped).await;
        let _ = window.emit("worker", serde_json::json!({ "type": "stopped" }));
    });
    *slot = Some((switch, task));
    Ok(())
}

#[tauri::command]
async fn leave(state: State<'_, Worker>) -> Result<(), String> {
    stop(&state).await;
    Ok(())
}

// Leaves the pool (a running job is finished by the cloud) and unloads the
// models; gives it 5 s.
async fn stop(state: &Worker) {
    let Some((switch, task)) = state.running.lock().unwrap().take() else { return };
    let _ = switch.send(true);
    let _ = tokio::time::timeout(Duration::from_secs(5), task).await;
}

// Start with the computer while a key is saved (the window turns it on and off).
#[tauri::command]
fn set_autostart(app: AppHandle, on: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let a = app.autolaunch();
    if on { a.enable() } else { a.disable() }.map_err(|e| e.to_string())?;
    Ok(a.is_enabled().unwrap_or(false))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // "Start with this computer": a login item (LaunchAgent) that opens the app with --join.
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--join"])))
        .manage(Worker { running: Mutex::new(None), last: Mutex::new(None), download: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![has_key, status, save_key, forget_key, check, get_model, stop_download, open_get_ollama, join, leave, set_autostart])
        .setup(|app| {
            // Stopped by the system (SIGTERM, as at log-out or by a service
            // manager): quit the normal way, which leaves the pool.
            #[cfg(unix)]
            {
                let app = app.handle().clone();
                async_runtime::spawn(async move {
                    if let Ok(mut term) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                        term.recv().await;
                        app.exit(0);
                    }
                });
            }
            // Started with `--join` (as a login item would be): join at once.
            // Off the main thread: the keychain may ask the person first.
            if std::env::args().any(|a| a == "--join") {
                let app = app.handle().clone();
                std::thread::spawn(move || {
                    if let Err(e) = start(&app) {
                        eprintln!("could not join: {e}");
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("could not start the app")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                async_runtime::block_on(stop(&app.state::<Worker>()));
            }
        });
}
