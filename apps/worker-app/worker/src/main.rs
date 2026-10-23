// visualia-worker: puts this computer's Ollama models into the class pool.
// Connects out only, to pool.visualia.space (plans/pool.md).
//
//   VISUALIA_KEY=<course key> visualia-worker
//
// Environment: VISUALIA_KEY (needed), POOL (default https://pool.visualia.space),
// OLLAMA (default http://127.0.0.1:11434), POOL_MODELS (e.g.
// "qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k"). Stop it with Ctrl+C: it leaves the pool and
// unloads its models. It writes nothing to disk and never logs a prompt.
use worker::{core, native};

#[tokio::main]
async fn main() {
    if std::env::args().any(|a| a == "--version") {
        println!("visualia-worker {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    let env = |k: &str, d: &str| std::env::var(k).unwrap_or_else(|_| d.to_string());
    let Ok(key) = std::env::var("VISUALIA_KEY") else {
        eprintln!("Set VISUALIA_KEY to your course key.");
        std::process::exit(1);
    };
    let cfg = native::Config {
        pool: env("POOL", "https://pool.visualia.space"),
        ollama: env("OLLAMA", "http://127.0.0.1:11434"),
        key,
        models: core::parse_models(&env("POOL_MODELS", "qwen3.5-9b=qwen3.5:9b,gemma4-26b=gemma4:26b")),
    };
    let (stop, stopped) = tokio::sync::watch::channel(false);
    tokio::spawn(async move {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap();
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = term.recv() => {} }
        let _ = stop.send(true);
    });
    native::run(cfg, None, stopped).await;
}
