// The worker on a computer with Ollama: the same steps as
// apps/pool/worker-node.mjs, with the decisions in core.rs.
// 1. Signs in at https://pool.visualia.space/login with the course key and
//    keeps the cookie in memory.
// 2. Opens one outbound WebSocket to the pool and offers the models Ollama has.
// 3. Runs each job on Ollama at 127.0.0.1:11434 (thinking off), streams the
//    words back, and reports the job's energy (macmon). Decision jobs go to
//    Ollama's /v1/systemone. Models load when a job asks for them.
// It writes nothing to disk and never logs a prompt or an answer.
use crate::core::{self, Frame, Job};
use crate::meter::Meter;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, protocol::CloseFrame, Message};
use tokio_util::sync::CancellationToken;

pub struct Config {
    pub pool: String,                  // https://pool.visualia.space
    pub ollama: String,                // http://127.0.0.1:11434
    pub key: String,                   // the course key
    pub models: Vec<(String, String)>, // pool name -> Ollama tag
}

// What the app's window shows: never a prompt or an answer.
pub type Events = Arc<dyn Fn(Value) + Send + Sync>;

type Tx = mpsc::UnboundedSender<Message>;

struct Worker {
    cfg: Config,
    http: reqwest::Client,
    events: Option<Events>,
    power: Meter,
    cookie: Mutex<Option<String>>,
    current: Mutex<Vec<String>>, // the models this worker offers
    running: Mutex<HashMap<String, CancellationToken>>,
    // Ollama's MLX runner has no structured output (501). Then the schema goes
    // into the prompt, the answer is held back, checked, and sent whole.
    format_works: AtomicBool,
    socket: Mutex<Option<(Tx, tokio::task::JoinHandle<()>)>>,
}

pub fn log(line: &str) {
    println!("{} {line}", chrono::Local::now().format("%H:%M:%S"));
}

impl Worker {
    fn event(&self, mut e: Value) {
        if let Some(f) = &self.events {
            e["t"] = json!(chrono::Utc::now().timestamp_millis());
            f(e);
        }
    }
}

// Runs until `stop` turns true, then leaves the pool and unloads the models.
pub async fn run(cfg: Config, events: Option<Events>, mut stop: watch::Receiver<bool>) {
    let power = Meter::start();
    let w = Arc::new(Worker {
        http: reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).build().unwrap(),
        cfg, events, power,
        cookie: Mutex::new(None),
        current: Mutex::new(vec![]),
        running: Mutex::new(HashMap::new()),
        format_works: AtomicBool::new(true),
        socket: Mutex::new(None),
    });
    // The window's live line every 5 s: memory in use, temperature (and where
    // the worker pauses), power.
    if w.events.is_some() {
        let w = w.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                if let Some(l) = w.power.live() {
                    w.event(json!({
                        "type": "live",
                        "mem_used_gb": (l.mem_used_gb * 10.0).round() / 10.0,
                        "mem_total_gb": l.mem_total_gb.round(),
                        "c": l.c.map(f64::round),
                        "pause_c": core::COOL_ABOVE_C,
                        "watts": (l.watts * 10.0).round() / 10.0,
                    }));
                }
            }
        });
    }
    let mut retry = 0;
    while !*stop.borrow() {
        let why = tokio::select! {
            why = session(&w, &mut retry) => why,
            _ = stop.changed() => break,
        };
        let wait = core::backoff(retry);
        retry += 1;
        w.event(json!({ "type": "waiting", "why": why, "seconds": wait }));
        log(&format!("{why}; trying again in {wait} s"));
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(wait)) => {}
            _ = stop.changed() => break,
        }
    }
    quit(&w).await;
}

// One connection: sign in, connect, serve until the socket closes. Returns why it ended.
async fn session(w: &Arc<Worker>, retry: &mut u32) -> String {
    if w.cookie.lock().unwrap().is_none() {
        match sign_in(w).await {
            Ok(c) => *w.cookie.lock().unwrap() = Some(c),
            Err(e) => return e,
        }
    }
    let models = match installed(w).await {
        Ok(have) => core::offered(&w.cfg.models, &have),
        Err(e) => return e,
    };
    *w.current.lock().unwrap() = models.clone();
    if models.is_empty() {
        let tags: Vec<_> = w.cfg.models.iter().map(|(_, t)| t.as_str()).collect();
        return format!("none of these models is in Ollama: {}", tags.join(", "));
    }
    let cookie = w.cookie.lock().unwrap().clone().unwrap_or_default();
    let url = format!("{}/connect", w.cfg.pool.replacen("http", "ws", 1));
    let mut req = url.into_client_request().unwrap();
    req.headers_mut().insert("origin", w.cfg.pool.parse().unwrap());
    req.headers_mut().insert("cookie", cookie.parse().unwrap());
    let Ok((ws, _)) = tokio_tungstenite::connect_async(req).await else {
        *w.cookie.lock().unwrap() = None; // refused at the door: sign in again next time
        return "connection refused".into();
    };
    *retry = 0;
    let (mut sink, mut stream) = ws.split();
    // One task writes to the socket; jobs send it frames through `tx`.
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            let close = matches!(m, Message::Close(_));
            if sink.send(m).await.is_err() || close {
                break;
            }
        }
    });
    let _ = tx.send(Message::text(core::hello(&models)));
    *w.socket.lock().unwrap() = Some((tx.clone(), writer));
    let mut ping = tokio::time::interval_at(
        tokio::time::Instant::now() + Duration::from_secs(core::PING_SECONDS),
        Duration::from_secs(core::PING_SECONDS),
    );
    loop {
        tokio::select! {
            m = stream.next() => match m {
                Some(Ok(Message::Text(t))) => match core::parse_frame(&t) {
                    Some(Frame::Welcome { person, workers }) => {
                        let names: Vec<_> = models.iter().map(|n| format!("pool/{n}")).collect();
                        w.event(json!({ "type": "joined", "person": person, "models": names, "workers": workers }));
                        log(&format!("in the pool as {person} with {}; {workers} worker(s) in the class", names.join(", ")));
                    }
                    Some(Frame::Job(job)) => {
                        let (w, tx) = (w.clone(), tx.clone());
                        tokio::spawn(async move { run_job(&w, &tx, job).await });
                    }
                    Some(Frame::Cancel(id)) => {
                        if let Some(t) = w.running.lock().unwrap().get(&id) {
                            t.cancel();
                        }
                    }
                    None => {}
                },
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                _ => {}
            },
            _ = ping.tick() => { let _ = tx.send(Message::text("ping")); }
        }
    }
    if let Some((_, writer)) = w.socket.lock().unwrap().take() {
        writer.abort(); // jobs still running now send into nothing, as in the JS worker
    }
    "connection lost".into()
}

// The course key, posted like the join page's form; the pool's cookie comes back.
async fn sign_in(w: &Worker) -> Result<String, String> {
    let res = w.http.post(format!("{}/login", w.cfg.pool))
        .header("origin", &w.cfg.pool)
        .form(&[("key", &w.cfg.key)])
        .send().await.map_err(|e| e.to_string())?;
    let cookie = res.headers().get_all("set-cookie").iter()
        .filter_map(|h| h.to_str().ok())
        .find_map(|h| h.split(';').next().filter(|c| c.starts_with("__Host-pool=")).map(String::from));
    cookie.ok_or_else(|| {
        if res.status().as_u16() == 429 { "too many sign-in attempts, wait a minute" } else { "sign-in refused: check the key" }.into()
    })
}

// The Ollama tags installed here.
async fn installed(w: &Worker) -> Result<Vec<String>, String> {
    ollama_tags(&w.http, &w.cfg.ollama).await
}

// ---- for the app's first screen: is Ollama there, which models, downloads ----

pub type Http = reqwest::Client;
pub fn http() -> Http {
    reqwest::Client::new()
}

// Ollama's version, or None when it isn't running here.
pub async fn ollama_version(http: &reqwest::Client, ollama: &str) -> Option<String> {
    let r: Value = http.get(format!("{ollama}/api/version")).timeout(Duration::from_secs(3)).send().await.ok()?.json().await.ok()?;
    r["version"].as_str().map(String::from)
}

pub async fn ollama_tags(http: &reqwest::Client, ollama: &str) -> Result<Vec<String>, String> {
    let r: Value = http.get(format!("{ollama}/api/tags")).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok(r["models"].as_array().into_iter().flatten().filter_map(|m| m["name"].as_str().map(String::from)).collect())
}

// Which engine Ollama runs a model with: "mlx", "llamacpp", or None.
pub async fn ollama_runner(http: &reqwest::Client, ollama: &str, tag: &str) -> Option<String> {
    let r: Value = http.post(format!("{ollama}/api/show")).json(&json!({ "model": tag })).timeout(Duration::from_secs(3)).send().await.ok()?.json().await.ok()?;
    r["details"]["runner"].as_str().map(String::from)
}

// Asks Ollama to download a model, reporting the percent as it goes. Stopping
// leaves the parts already downloaded: the next try goes on from there.
pub async fn pull(http: &reqwest::Client, ollama: &str, tag: &str, stop: CancellationToken, progress: impl Fn(Option<u64>)) -> Result<(), String> {
    let work = async {
        let res = http.post(format!("{ollama}/api/pull")).json(&json!({ "model": tag, "stream": true })).send().await.map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("ollama {}", res.status().as_u16()));
        }
        // Each part (layer) reports its own total and progress.
        let mut parts: HashMap<String, (u64, u64)> = HashMap::new();
        let mut body = res.bytes_stream();
        let mut buf = Vec::new();
        while let Some(chunk) = body.next().await {
            buf.extend_from_slice(&chunk.map_err(|e| e.to_string())?);
            while let Some(nl) = buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buf.drain(..=nl).collect();
                let Ok(e) = serde_json::from_slice::<Value>(&line) else { continue };
                if let Some(err) = e["error"].as_str() {
                    return Err(err.to_string());
                }
                if e["status"] == "success" {
                    return Ok(());
                }
                if let (Some(d), Some(t)) = (e["digest"].as_str(), e["total"].as_u64()) {
                    parts.insert(d.to_string(), (e["completed"].as_u64().unwrap_or(0), t));
                    let (done, total) = parts.values().fold((0, 0), |(a, b), (c, t)| (a + c, b + t));
                    progress(core::percent(done, total));
                }
            }
        }
        Err("the download stopped".into())
    };
    tokio::select! {
        r = work => r,
        _ = stop.cancelled() => Err("stopped".into()),
    }
}

async fn run_job(w: &Arc<Worker>, tx: &Tx, job: Job) {
    let token = CancellationToken::new();
    w.running.lock().unwrap().insert(job.id.clone(), token.clone());
    let send = |m: String| { let _ = tx.send(Message::text(m)); };
    let t0 = Instant::now();
    let meter = w.power.begin();
    let pieces = AtomicUsize::new(0);
    let what = if job.decide { "decide" } else { "job" };
    let work = async {
        let tag = w.cfg.models.iter().find(|(n, _)| *n == job.model).map(|(_, t)| t.clone())
            .ok_or(format!("this worker has no {}", job.model))?;
        if core::too_hot(w.power.gpu_c()) {
            return Err("this computer is too hot right now".to_string()); // the cloud takes it
        }
        if job.decide { decide(w, &job, &tag).await } else { chat(w, &job, &tag, &send, &pieces).await }
    };
    let result = tokio::select! {
        r = work => Some(r),
        _ = token.cancelled() => None,
    };
    let secs = t0.elapsed().as_secs_f64();
    let energy = w.power.end(meter);
    match result {
        Some(Ok(done)) => {
            let e = energy.as_ref();
            let (j, net) = (e.map(|e| e.energy_j), e.map(|e| e.energy_net_j));
            match done {
                Done::Chat { finish, prompt_tokens, completion_tokens } => {
                    let tokens = completion_tokens.unwrap_or(pieces.load(Ordering::Relaxed) as u64);
                    send(core::done(&job.id, finish, core::usage(prompt_tokens, Some(tokens), e)));
                    w.event(json!({ "type": "job", "kind": "chat", "model": format!("pool/{}", job.model), "tokens": tokens, "seconds": secs, "energy_j": j, "energy_net_j": net }));
                    log(&format!("job pool/{}: {tokens} tokens, {secs:.1} s, {} J (net {})", job.model, core::joules(j), core::joules(net)));
                }
                Done::Decide { answers, prompt_tokens } => {
                    send(core::done_decide(&job.id, answers, core::usage(prompt_tokens, None, e)));
                    w.event(json!({ "type": "job", "kind": "decide", "model": format!("pool/{}", job.model), "tokens": null, "seconds": secs, "energy_j": j, "energy_net_j": net }));
                    let n = job.questions.as_object().map_or(0, |q| q.len());
                    log(&format!("decide pool/{}: {n} question(s), {secs:.1} s, {} J (net {})", job.model, core::joules(j), core::joules(net)));
                }
            }
        }
        Some(Err(e)) => {
            send(core::error(&job.id, &e));
            w.event(json!({ "type": "job", "kind": if job.decide { "decide" } else { "chat" }, "model": format!("pool/{}", job.model), "failed": core::cut(&e, 120), "seconds": secs }));
            log(&format!("{what} pool/{} failed: {}", job.model, core::cut(&e, 120)));
        }
        None => {
            w.event(json!({ "type": "job", "kind": if job.decide { "decide" } else { "chat" }, "model": format!("pool/{}", job.model), "failed": "cancelled", "seconds": secs }));
            if job.decide {
                log(&format!("decide pool/{}: cancelled", job.model));
            } else {
                log(&format!("job pool/{}: cancelled after {} pieces", job.model, pieces.load(Ordering::Relaxed)));
            }
        }
    }
    w.running.lock().unwrap().remove(&job.id);
    cool_down(w, tx).await;
}

enum Done {
    Chat { finish: &'static str, prompt_tokens: Option<u64>, completion_tokens: Option<u64> },
    Decide { answers: Value, prompt_tokens: Option<u64> },
}

// A chat job on Ollama's /api/chat, streamed back word by word.
async fn chat(w: &Worker, job: &Job, tag: &str, send: &impl Fn(String), pieces: &AtomicUsize) -> Result<Done, String> {
    let wanted = core::wanted_json(job)?;
    let ask = |with_format: bool| {
        let (schema, format) = match &wanted { Some((s, f)) => (s.as_ref(), Some(f)), None => (None, None) };
        let mut options = json!({ "num_predict": job.max_tokens });
        if let Some(t) = job.temperature { options["temperature"] = json!(t); }
        if let Some(p) = job.top_p { options["top_p"] = json!(p); }
        if let Some(s) = &job.stop { options["stop"] = if s.is_array() { s.clone() } else { json!([s]) }; }
        if let Some(s) = job.seed { options["seed"] = json!(s); }
        let mut body = json!({ "model": tag, "stream": true, "think": false, "options": options });
        if with_format {
            body["format"] = format.cloned().unwrap_or(Value::Null);
            body["messages"] = job.messages.clone();
        } else {
            body["messages"] = if format.is_some() { core::json_prompt(&job.messages, schema) } else { job.messages.clone() };
        }
        w.http.post(format!("{}/api/chat", w.cfg.ollama)).json(&body).send()
    };
    let try_format = wanted.is_some() && w.format_works.load(Ordering::Relaxed);
    let mut res = ask(try_format).await.map_err(|e| e.to_string())?;
    if try_format && res.status().as_u16() == 501 {
        w.format_works.store(false, Ordering::Relaxed);
        res = ask(false).await.map_err(|e| e.to_string())?;
    }
    if !res.status().is_success() {
        let status = res.status().as_u16();
        return Err(format!("ollama {status}: {}", core::cut(&res.text().await.unwrap_or_default(), 120)));
    }
    let hold = wanted.is_some() && !w.format_works.load(Ordering::Relaxed); // check the JSON before sending it
    let mut held = String::new();
    let (mut prompt_tokens, mut completion_tokens, mut finish) = (None, None, "stop");
    let mut buf = Vec::new();
    let mut body = res.bytes_stream();
    while let Some(chunk) = body.next().await {
        buf.extend_from_slice(&chunk.map_err(|e| e.to_string())?);
        while let Some(nl) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=nl).collect();
            let line = String::from_utf8_lossy(&line);
            if line.trim().is_empty() {
                continue;
            }
            let e: Value = serde_json::from_str(line.trim()).map_err(|e| e.to_string())?;
            if let Some(err) = e["error"].as_str() {
                return Err(err.to_string());
            }
            if let Some(c) = e["message"]["content"].as_str().filter(|c| !c.is_empty()) {
                pieces.fetch_add(1, Ordering::Relaxed);
                if hold { held.push_str(c) } else { send(core::delta(&job.id, c)) }
            }
            if e["done"] == true {
                prompt_tokens = e["prompt_eval_count"].as_u64();
                completion_tokens = e["eval_count"].as_u64();
                finish = if e["done_reason"] == "length" { "length" } else { "stop" };
            }
        }
    }
    if hold {
        let text = core::unfence(&held);
        if !core::fits(&text, wanted.as_ref().and_then(|(s, _)| s.as_ref())) {
            return Err("the answer did not match the schema".into());
        }
        send(core::delta(&job.id, &text));
    }
    Ok(Done::Chat { finish, prompt_tokens, completion_tokens })
}

// A decision: state + typed questions -> answers, one JSON reply. The model
// loads on demand (Clef-flash cold: 6-18 s on the M1).
async fn decide(w: &Worker, job: &Job, tag: &str) -> Result<Done, String> {
    let res = w.http.post(format!("{}/v1/systemone", w.cfg.ollama))
        .json(&json!({ "model": tag, "state": job.state, "questions": job.questions }))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        return Err(format!("ollama {status}: {}", core::cut(&res.text().await.unwrap_or_default(), 120)));
    }
    let r: Value = res.json().await.map_err(|e| e.to_string())?;
    let u = &r["usage"];
    Ok(Done::Decide { answers: r["answers"].clone(), prompt_tokens: u["input_tokens"].as_u64().or(u["prompt_tokens"].as_u64()) })
}

// A laptop between jobs: if the graphics chip is hot, offer no models (the
// pool sends jobs elsewhere or to the cloud) until it is cool again.
async fn cool_down(w: &Worker, tx: &Tx) {
    if !core::should_cool(w.power.gpu_c()) || tx.is_closed() {
        return;
    }
    let _ = tx.send(Message::text(core::hello(&[])));
    w.event(json!({ "type": "cooling", "gpu_c": w.power.gpu_c().map(f64::round) }));
    let t0 = Instant::now();
    while !core::cooled(w.power.gpu_c(), t0.elapsed().as_secs()) {
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    log(&format!("cooled to {} °C in {} s", w.power.gpu_c().map_or(0.0, f64::round), t0.elapsed().as_secs()));
    let models = w.current.lock().unwrap().clone();
    let _ = tx.send(Message::text(core::hello(&models)));
    w.event(json!({ "type": "cooled", "gpu_c": w.power.gpu_c().map(f64::round) }));
}

// Leaving: stop the jobs (the cloud finishes them), close the socket, and
// free the memory by unloading this worker's models from Ollama.
async fn quit(w: &Worker) {
    for t in w.running.lock().unwrap().values() {
        t.cancel();
    }
    let socket = w.socket.lock().unwrap().take();
    if let Some((tx, writer)) = socket {
        let _ = tx.send(Message::Close(Some(CloseFrame { code: 1000.into(), reason: "stopped".into() })));
        let _ = tokio::time::timeout(Duration::from_secs(2), writer).await;
    }
    w.power.close();
    w.event(json!({ "type": "left" }));
    log("left the pool");
    let unloads = w.cfg.models.iter().map(|(_, tag)| {
        w.http.post(format!("{}/api/generate", w.cfg.ollama))
            .json(&json!({ "model": tag, "keep_alive": 0 }))
            .timeout(Duration::from_secs(3))
            .send()
    });
    futures_util::future::join_all(unloads).await;
}
