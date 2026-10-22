// The app's own commands are declared here, so the capability file
// (capabilities/default.json) has to name each one the window may call.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["has_key", "status", "save_key", "forget_key", "check", "get_model", "stop_download", "open_get_ollama", "join", "leave"]),
    ))
    .expect("tauri build");
}
