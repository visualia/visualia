// What the app's first screen does, from a terminal (for tests on a machine
// with no screen): is Ollama there, which tags it has, and a download with
// its percent.   cargo run -p worker --example onboard [tag-to-download] [stop-after-%]
use tokio_util::sync::CancellationToken;
use worker::native;

#[tokio::main]
async fn main() {
    let http = native::http();
    let ollama = "http://127.0.0.1:11434";
    let Some(v) = native::ollama_version(&http, ollama).await else {
        println!("no Ollama");
        return;
    };
    println!("Ollama {v}; tags: {:?}", native::ollama_tags(&http, ollama).await.unwrap_or_default());
    let Some(tag) = std::env::args().nth(1) else { return };
    let stop_at: Option<u64> = std::env::args().nth(2).and_then(|s| s.parse().ok());
    let stop = CancellationToken::new();
    let s = stop.clone();
    let last = std::sync::Mutex::new(None);
    let r = native::pull(&http, ollama, &tag, stop, |p| {
        let mut l = last.lock().unwrap();
        if *l != p {
            println!("{tag}: {}%", p.map_or("?".into(), |p| p.to_string()));
            *l = p;
        }
        if let (Some(p), Some(at)) = (p, stop_at) {
            if p >= at {
                s.cancel();
            }
        }
    })
    .await;
    println!("{tag}: {r:?}");
}
