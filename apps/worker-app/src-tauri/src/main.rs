// Visualia Worker: puts this computer's Ollama models into the class pool
// (plans/pool.md, plans/worker-app.md). The app is a window and a keychain
// entry around the same worker the `visualia-worker` program runs
// (../worker): it connects out to pool.visualia.space and to Ollama on
// 127.0.0.1 only, and tells the window about each job (never the prompt).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Duration;
use tauri::{async_runtime, AppHandle, Emitter, Manager, RunEvent, State};
use tokio::sync::watch;
use worker::{core, native};

// The course key lives in the macOS keychain (Windows: Credential Manager),
// never in a file. The window can save it and forget it, not read it.
const SERVICE: &str = "space.visualia.worker";
const ACCOUNT: &str = "course-key";
// Pool name = Ollama tag; offered only when Ollama has the tag.
const MODELS: &str = "qwen3.5-9b=qwen3.5:9b,gemma4-26b=gemma4:26b,clef-flash=clef-flash-8k";

// The running worker (its stop switch and task), and its latest "joined" or
// "waiting" event, so a window that opens later can show where things stand.
struct Worker {
    running: Mutex<Option<(watch::Sender<bool>, async_runtime::JoinHandle<()>)>>,
    last: Mutex<Option<serde_json::Value>>,
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
        ollama: "http://127.0.0.1:11434".into(),
        key,
        models: core::parse_models(MODELS),
        macmon: "/opt/homebrew/bin/macmon".into(),
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

fn main() {
    tauri::Builder::default()
        .manage(Worker { running: Mutex::new(None), last: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![has_key, status, save_key, forget_key, join, leave])
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
