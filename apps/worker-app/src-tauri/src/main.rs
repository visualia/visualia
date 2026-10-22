// Visualia Worker: puts this computer's Ollama models into the class pool
// (plans/pool.md, plans/worker-app.md). The app is a window and a keychain
// entry; the work is done by the same worker script the command line uses
// (apps/pool/worker-node.mjs), run on a pinned Node.js sidecar. The script
// connects out to pool.visualia.space and to Ollama on 127.0.0.1 only, and
// reports each job as one JSON line (never the prompt), which goes to the
// window as a `worker` event.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

// The course key lives in the macOS keychain (Windows: Credential Manager),
// never in a file. The window can save it and forget it, not read it.
const SERVICE: &str = "space.visualia.worker";
const ACCOUNT: &str = "course-key";
// Pool name = Ollama tag; offered only when Ollama has the tag.
const MODELS: &str = "qwen3.5-9b=qwen3.5:9b,gemma4-26b=gemma4:26b,clef-flash=clef-flash-8k";

// The running worker, and its latest "joined" or "waiting" event, so a window
// that opens later (or reloads) can show where things stand.
struct Worker {
    child: Mutex<Option<(Child, ChildStdin)>>,
    last: Mutex<Option<serde_json::Value>>,
}

fn keychain() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
async fn has_key() -> bool {
    match keychain().and_then(|e| e.get_password().map_err(|e| e.to_string())) {
        Ok(_) => true,
        Err(e) => {
            eprintln!("no course key: {e}");
            false
        }
    }
}

// Whether the worker runs, and its latest joined/waiting event.
#[tauri::command]
fn status(state: State<'_, Worker>) -> serde_json::Value {
    let running = state.child.lock().unwrap().as_mut().is_some_and(|(c, _)| matches!(c.try_wait(), Ok(None)));
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
    stop(&state);
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
    let mut slot = state.child.lock().unwrap();
    if let Some((child, _)) = slot.as_mut() {
        if child.try_wait().map(|s| s.is_none()).unwrap_or(false) {
            return Ok(()); // already in the pool
        }
    }
    let key = keychain()?.get_password().map_err(|_| "No course key saved.".to_string())?;
    // externalBin puts the sidecar next to the app's own executable.
    let node = std::env::current_exe().map_err(|e| e.to_string())?.with_file_name("node");
    let script = app.path().resource_dir().map_err(|e| e.to_string())?.join("worker").join("worker-node.mjs");
    let mut child = Command::new(node)
        .arg(script)
        .env_clear()
        .env("VISUALIA_KEY", key)
        .env("WORKER_EVENTS", "1")
        .env("POOL_MODELS", MODELS)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start the worker: {e}"))?;
    let stdin = child.stdin.take().unwrap();
    let out = child.stdout.take().unwrap();
    let err = child.stderr.take().unwrap();
    let to_window = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                if matches!(event["type"].as_str(), Some("joined" | "waiting")) {
                    *to_window.state::<Worker>().last.lock().unwrap() = Some(event.clone());
                }
                let _ = to_window.emit("worker", event);
            }
        }
        let _ = to_window.emit("worker", serde_json::json!({ "type": "stopped" }));
    });
    // The worker's own log (model, seconds, joules; no prompts) goes to the app's stderr.
    std::thread::spawn(move || {
        for line in BufReader::new(err).lines().map_while(Result::ok) {
            eprintln!("worker: {line}");
        }
    });
    *slot = Some((child, stdin));
    Ok(())
}

#[tauri::command]
async fn leave(state: State<'_, Worker>) -> Result<(), String> {
    stop(&state);
    Ok(())
}

// Asks the worker to leave ("quit": it stops its job, which the cloud then
// finishes, and unloads its models), waits up to 5 s, then ends it.
fn stop(state: &Worker) {
    let Some((mut child, mut stdin)) = state.child.lock().unwrap().take() else { return };
    let _ = writeln!(stdin, "quit");
    drop(stdin);
    let t0 = Instant::now();
    while t0.elapsed() < Duration::from_secs(5) {
        if let Ok(Some(_)) = child.try_wait() {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn main() {
    tauri::Builder::default()
        .manage(Worker { child: Mutex::new(None), last: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![has_key, status, save_key, forget_key, join, leave])
        .setup(|app| {
            // Debug builds only: a key in the environment is saved to the
            // keychain by the app itself (the entry's owner reads it without a
            // prompt), for tests on a machine nobody is looking at.
            #[cfg(debug_assertions)]
            if let Ok(k) = std::env::var("VISUALIA_KEY") {
                if let Err(e) = save_key(k) {
                    eprintln!("could not save the key: {e}");
                }
            }
            // Started with `--join` (as a login item would be): join at once,
            // whether or not the window is ever shown. Off the main thread: the
            // keychain may ask the person first.
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
                stop(&app.state::<Worker>());
            }
        });
}
