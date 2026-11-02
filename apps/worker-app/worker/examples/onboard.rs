// What the app's first screen does, from a terminal (for tests on a machine
// with no screen): is Ollama there, which tags it has, the model list (from the
// pool, checked, else the built-in copy), and a download of a listed tag with
// its percent and the list's size limit.
//   POOL=http://127.0.0.1:8787 cargo run -p worker --example onboard [tag-to-download] [stop-after-%]
//   ... onboard --remove <tag>   removes a listed model (and its base, unless shared), as the app's Remove
use tokio_util::sync::CancellationToken;
use worker::{core, native};

#[tokio::main]
async fn main() {
    let http = native::http();
    let ollama = "http://127.0.0.1:11434";
    let Some(v) = native::ollama_version(&http, ollama).await else {
        println!("no Ollama");
        return;
    };
    println!("Ollama {v}; tags: {:?}", native::ollama_tags(&http, ollama).await.unwrap_or_default());
    let pool = std::env::var("POOL").unwrap_or("https://pool.visualia.space".into());
    let list = match native::model_list(&http, &pool).await {
        Some((list, dropped)) => { for d in &dropped { println!("dropped from the pool's list: {d}"); } println!("list from the pool: {} models", list.len()); list }
        None => { println!("pool list unavailable; the built-in copy"); core::built_in_models() }
    };
    for m in &list { println!("  {} = {} ({} GB, needs {} GB){}", m.name, m.tag, m.gb, m.need_gb, m.from.as_ref().map_or(String::new(), |f| format!(", made from {f}"))); }
    let Some(mut tag) = std::env::args().nth(1) else { return };
    if tag == "--remove" {
        let Some(t) = std::env::args().nth(2) else { return };
        let Some(m) = list.iter().find(|m| m.tag == t) else { println!("{t}: not on the list"); return };
        println!("remove {}: {:?}", m.tag, native::remove(&http, ollama, &m.tag).await);
        if let Some(from) = &m.from {
            if !list.iter().any(|o| o.name != m.name && (o.tag == *from || o.from.as_deref() == Some(from))) {
                println!("remove {from}: {:?}", native::remove(&http, ollama, from).await);
            }
        }
        return;
    }
    let Some(m) = list.iter().find(|m| m.tag == tag || m.from.as_deref() == Some(&tag)) else { println!("{tag}: not on the list"); return };
    let limit = core::byte_limit(m.gb);
    let made = m.from.clone().zip(m.ctx);
    if let Some((from, _)) = &made { tag = from.clone(); } // a made model: download its base
    let stop_at: Option<u64> = std::env::args().nth(2).and_then(|s| s.parse().ok());
    let stop = CancellationToken::new();
    let s = stop.clone();
    let last = std::sync::Mutex::new(None);
    let r = native::pull(&http, ollama, &tag, limit, stop, |p| {
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
    if let (Ok(()), Some((from, ctx))) = (&r, made) {
        println!("make {} from {from} (ctx {ctx}): {:?}", m.tag, native::create(&http, ollama, &m.tag, &from, ctx).await);
    }
}
