// The worker's decisions, with no network, files or clock: reading the pool's
// frames, writing ours, which models to offer, the JSON check, when to cool
// down. The native part (native.rs) does the talking; a browser tab could use
// this same code as WebAssembly later (plans/worker-app.md).
use serde_json::{json, Value};

pub const PING_SECONDS: u64 = 25;
pub const TOO_HOT_C: f64 = 85.0; // refuse jobs above this: the cloud takes them
pub const COOL_ABOVE_C: f64 = 75.0; // after a job, rest if hotter than this…
pub const COOL_TO_C: f64 = 65.0; // …until this cool,
pub const COOL_MAX_SECONDS: u64 = 60; // or at most this long

// A job from the pool. Chat jobs carry messages and options; decision jobs
// (kind 'decide', for /v1/decide) carry state and questions; upscale jobs
// (kind 'upscale', for /v1/upscale) carry a picture, base64.
pub struct Job {
    pub id: String,
    pub model: String,
    pub decide: bool,
    pub upscale: bool,
    pub image: String,
    pub messages: Value,
    pub max_tokens: Option<u64>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub stop: Option<Value>,
    pub seed: Option<i64>,
    pub response_format: Option<Value>,
    pub state: Value,
    pub questions: Value,
}

pub enum Frame {
    Welcome { person: String, workers: u64 },
    Job(Job),
    Cancel(String),
}

// What the pool sent; None for "pong" and anything we don't know.
pub fn parse_frame(text: &str) -> Option<Frame> {
    if text == "pong" {
        return None;
    }
    let m: Value = serde_json::from_str(text).ok()?;
    let s = |k: &str| m[k].as_str().unwrap_or("").to_string();
    match m["type"].as_str()? {
        "welcome" => Some(Frame::Welcome { person: s("person"), workers: m["workers"].as_u64().unwrap_or(0) }),
        "cancel" => Some(Frame::Cancel(s("id"))),
        "job" => Some(Frame::Job(Job {
            id: s("id"),
            model: s("model"),
            decide: m["kind"] == "decide",
            upscale: m["kind"] == "upscale",
            image: s("image"),
            messages: m["messages"].clone(),
            max_tokens: m["max_tokens"].as_u64(),
            temperature: m["temperature"].as_f64(),
            top_p: m["top_p"].as_f64(),
            stop: m.get("stop").filter(|v| !v.is_null()).cloned(),
            seed: m["seed"].as_i64(),
            response_format: m.get("response_format").filter(|v| !v.is_null()).cloned(),
            state: m["state"].clone(),
            questions: m["questions"].clone(),
        })),
        _ => None,
    }
}

// Our frames.
pub fn hello(models: &[String]) -> String {
    json!({ "type": "hello", "kind": "node", "models": models }).to_string()
}
pub fn delta(id: &str, content: &str) -> String {
    json!({ "type": "delta", "content": content, "id": id }).to_string()
}
pub fn done(id: &str, finish_reason: &str, usage: Value) -> String {
    json!({ "type": "done", "finish_reason": finish_reason, "usage": usage, "id": id }).to_string()
}
pub fn done_decide(id: &str, answers: Value, usage: Value) -> String {
    json!({ "type": "done", "answers": answers, "usage": usage, "id": id }).to_string()
}
pub fn done_upscale(id: &str, image: &str, width: u32, height: u32, usage: Value) -> String {
    json!({ "type": "done", "image": image, "width": width, "height": height, "usage": usage, "id": id }).to_string()
}
pub fn error(id: &str, message: &str) -> String {
    json!({ "type": "error", "message": cut(message, 200), "id": id }).to_string()
}

// The first n characters (not bytes).
pub fn cut(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

// Seconds to wait before connecting again: 1, 2, 4… up to a minute.
pub fn backoff(retry: u32) -> u64 {
    2u64.saturating_pow(retry).min(60)
}

// "qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k" -> [(pool name, Ollama tag)].
pub fn parse_models(spec: &str) -> Vec<(String, String)> {
    spec.split(',')
        .filter_map(|p| p.split_once('=').map(|(n, t)| (n.trim().to_string(), t.trim().to_string())))
        .collect()
}

// The pool models whose Ollama tag is installed here.
pub fn offered(models: &[(String, String)], installed: &[String]) -> Vec<String> {
    models
        .iter()
        .filter(|(_, tag)| installed.iter().any(|i| i == tag || *i == format!("{tag}:latest")))
        .map(|(n, _)| n.clone())
        .collect()
}

// The JSON a job wants back: Ok(None) for plain text, else the schema (if
// any) and the `format` to ask Ollama for (the schema, or "json").
pub fn wanted_json(job: &Job) -> Result<Option<(Option<Value>, Value)>, String> {
    let Some(rf) = &job.response_format else { return Ok(None) };
    if let Some(s) = rf["schema"].as_str() {
        let schema: Value = serde_json::from_str(s).map_err(|e| e.to_string())?;
        return Ok(Some((Some(schema.clone()), schema)));
    }
    if rf["type"] == "json_object" {
        return Ok(Some((None, json!("json"))));
    }
    Ok(None)
}

// When the engine can't enforce a schema: ask for it in the prompt instead.
pub fn json_prompt(messages: &Value, schema: Option<&Value>) -> Value {
    let rule = match schema {
        Some(s) => format!("Answer only with one JSON value, no other text, matching this JSON schema: {s}."),
        None => "Answer only with one JSON value, no other text.".to_string(),
    };
    let mut out = vec![json!({ "role": "system", "content": rule })];
    out.extend(messages.as_array().cloned().unwrap_or_default());
    Value::Array(out)
}

// Takes off the ``` or ```json fence a model may put around its JSON.
pub fn unfence(text: &str) -> String {
    let mut t = text.trim();
    if let Some(rest) = t.strip_prefix("```") {
        t = rest.strip_prefix("json").unwrap_or(rest).trim_start();
    }
    if let Some(rest) = t.strip_suffix("```") {
        t = rest.trim_end();
    }
    t.to_string()
}

// Parses, and checks the top level: required keys present, enums kept, types right.
pub fn fits(text: &str, schema: Option<&Value>) -> bool {
    let Ok(v) = serde_json::from_str::<Value>(text) else { return false };
    let Some(schema) = schema else { return true };
    if schema["type"] != "object" {
        return true;
    }
    let Some(obj) = v.as_object() else { return false };
    let required = schema["required"].as_array().cloned().unwrap_or_default();
    if required.iter().any(|k| k.as_str().is_some_and(|k| !obj.contains_key(k))) {
        return false;
    }
    for (k, p) in schema["properties"].as_object().into_iter().flatten() {
        let Some(x) = obj.get(k) else { continue };
        if let Some(choices) = p["enum"].as_array() {
            if !choices.contains(x) {
                return false;
            }
        }
        if let Some(want) = p["type"].as_str() {
            let whole = x.as_f64().is_some_and(|f| f.fract() == 0.0);
            let got = match x {
                Value::Array(_) => "array",
                Value::Null => "null",
                Value::Number(_) if whole && want == "integer" => "integer",
                Value::Number(_) => "number",
                Value::String(_) => "string",
                Value::Bool(_) => "boolean",
                Value::Object(_) => "object",
            };
            if got != want {
                return false;
            }
        }
    }
    true
}

// A job's energy, as measured on this computer (macmon on a Mac).
pub struct Energy {
    pub energy_j: f64,     // chip: CPU, GPU, Neural Engine, memory
    pub energy_net_j: f64, // the same minus the chip's idle baseline
    pub sys_energy_j: f64, // the whole computer
    pub source: String,
}

// The `usage` of a done frame: tokens, and energy when it was measured.
pub fn usage(prompt_tokens: Option<u64>, completion_tokens: Option<u64>, energy: Option<&Energy>) -> Value {
    let mut u = json!({ "prompt_tokens": prompt_tokens });
    if let Some(c) = completion_tokens {
        u["completion_tokens"] = json!(c);
    }
    if let Some(e) = energy {
        u["energy_j"] = json!(e.energy_j);
        u["energy_net_j"] = json!(e.energy_net_j);
        u["sys_energy_j"] = json!(e.sys_energy_j);
        u["energy_source"] = json!(e.source);
    }
    u
}

// ---- the model list -----------------------------------------------------------------
// One list says what the app can download and what it serves to the pool. The
// pool sends it (GET /app/models, apps/pool/src/models.js), so models can change
// without an app update; the copy below is used when the pool can't be reached.
// Whatever the pool sends must pass the hard limits here, which only an app
// update can change. Nothing is ever downloaded or removed without a click.

// A model on the list.
#[derive(Clone, Debug, PartialEq)]
pub struct Model {
    pub name: String,         // the pool's name, e.g. "qwen3.5-9b"
    pub label: String,        // what people read, e.g. "Qwen 3.5 (9B)"
    pub tag: String,          // the Ollama tag served, e.g. "qwen3.5:9b"
    pub from: Option<String>, // made from this download (with `ctx`), else `tag` is downloaded
    pub ctx: Option<u64>,     // the context length it is made with
    pub gb: f64,              // download size
    pub need_gb: u64,         // memory the computer needs
}

// Hard limits, whatever the list says.
pub const MAX_MODELS: usize = 8;
pub const MAX_MODEL_GB: f64 = 24.0;
pub const KEEP_FREE_GB: f64 = 10.0; // disk left free after a download
const SIZE_SLACK: f64 = 1.1; // a download may be at most 10% bigger than listed

// The built-in copy (sizes from Ollama's and Hugging Face's manifests, 2026-11-02).
pub fn built_in_models() -> Vec<Model> {
    check_list(&json!({ "models": [
        { "name": "qwen3.5-9b", "label": "Qwen 3.5 (9B)", "tag": "qwen3.5:9b", "gb": 7.6, "need_gb": 16 },
        { "name": "gemma4-26b", "label": "Gemma 4 (26B)", "tag": "gemma4:26b", "gb": 16.1, "need_gb": 32 },
        { "name": "clef-flash", "label": "Clef-flash (decisions)", "tag": "clef-flash-8k",
          "from": "hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M", "ctx": 8192, "gb": 7.0, "need_gb": 16 },
    ] })).0
}

// An Ollama library tag ("qwen3.5:9b") or a Hugging Face GGUF ("hf.co/owner/repo:Q4_K_M").
fn good_tag(t: &str) -> bool {
    let plain = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c));
    let (path, version) = t.split_once(':').unwrap_or((t, "latest"));
    let path_ok = match path.strip_prefix("hf.co/") {
        Some(rest) => rest.split('/').count() == 2 && rest.split('/').all(plain),
        None => plain(path),
    };
    t.len() <= 120 && path_ok && plain(version)
}

// Keeps the entries that pass the limits; says why each other one was dropped.
pub fn check_list(v: &Value) -> (Vec<Model>, Vec<String>) {
    let (mut kept, mut dropped) = (Vec::<Model>::new(), Vec::new());
    let Some(items) = v["models"].as_array() else { return (kept, vec!["no models array".into()]) };
    for (i, m) in items.iter().enumerate() {
        let s = |k: &str| m[k].as_str().map(str::to_string);
        let why = (|| {
            if kept.len() >= MAX_MODELS { return Err(format!("more than {MAX_MODELS} models")); }
            let name = s("name").filter(|n| n.len() <= 40 && !n.is_empty() && n.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || ".-".contains(c))).ok_or("bad name")?;
            if kept.iter().any(|k| k.name == name) { return Err(format!("{name}: twice")); }
            let label = s("label").filter(|l| !l.trim().is_empty() && l.chars().count() <= 40 && !l.chars().any(char::is_control)).ok_or(format!("{name}: bad label"))?;
            let tag = s("tag").filter(|t| good_tag(t)).ok_or(format!("{name}: bad tag"))?;
            let from = match m.get("from") { None | Some(Value::Null) => None, Some(f) => Some(f.as_str().filter(|f| good_tag(f)).ok_or(format!("{name}: bad from"))?.to_string()) };
            let ctx = match m.get("ctx") { None | Some(Value::Null) => None, Some(c) => Some(c.as_u64().filter(|c| (2048..=32768).contains(c)).ok_or(format!("{name}: bad ctx"))?) };
            if from.is_some() != ctx.is_some() { return Err(format!("{name}: from and ctx go together")); }
            if from.is_some() && tag.contains('/') { return Err(format!("{name}: a made model needs a plain tag")); }
            let gb = m["gb"].as_f64().filter(|g| *g > 0.0 && *g <= MAX_MODEL_GB).ok_or(format!("{name}: size missing or over {MAX_MODEL_GB} GB"))?;
            let need_gb = m["need_gb"].as_u64().filter(|n| *n <= 512).ok_or(format!("{name}: bad need_gb"))?;
            Ok(Model { name, label, tag, from, ctx, gb, need_gb })
        })();
        match why { Ok(m) => kept.push(m), Err(e) => dropped.push(format!("model {i}: {e}")) }
    }
    (kept, dropped)
}

// (pool name, Ollama tag) for what the worker serves.
pub fn served(list: &[Model]) -> Vec<(String, String)> {
    list.iter().map(|m| (m.name.clone(), m.tag.clone())).collect()
}

// Enough disk for a download of `gb`, keeping KEEP_FREE_GB free (None: unknown, allowed).
pub fn fits_disk(free_gb: Option<f64>, gb: f64) -> bool {
    free_gb.map_or(true, |f| f - gb * SIZE_SLACK >= KEEP_FREE_GB)
}

// The most a download listed at `gb` may really be, in bytes.
pub fn byte_limit(gb: f64) -> u64 {
    (gb.min(MAX_MODEL_GB) * SIZE_SLACK * 1e9) as u64
}

// Whether a computer with this much memory can run a model that needs `need`.
pub fn fits_memory(memory_gb: Option<u64>, need: u64) -> bool {
    memory_gb.map_or(true, |m| m >= need)
}

// A download's progress over all its parts, as a whole percent (None: not known yet).
pub fn percent(completed: u64, total: u64) -> Option<u64> {
    (total > 0).then(|| completed.min(total) * 100 / total)
}

// Temperatures of the graphics chip, °C (None: not measured).
pub fn too_hot(gpu_c: Option<f64>) -> bool {
    gpu_c.is_some_and(|c| c > TOO_HOT_C)
}
pub fn should_cool(gpu_c: Option<f64>) -> bool {
    gpu_c.is_some_and(|c| c > COOL_ABOVE_C)
}
pub fn cooled(gpu_c: Option<f64>, seconds: u64) -> bool {
    !gpu_c.is_some_and(|c| c > COOL_TO_C) || seconds >= COOL_MAX_SECONDS
}

// "12.34" or "?" for the log.
pub fn joules(j: Option<f64>) -> String {
    j.map_or("?".to_string(), |j| format!("{j}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_upscale_jobs() {
        let Some(Frame::Job(j)) = parse_frame(r#"{"type":"job","id":"1","kind":"upscale","model":"upscale-fast","image":"aGk="}"#) else { panic!() };
        assert!(j.upscale && !j.decide);
        assert_eq!((j.model.as_str(), j.image.as_str()), ("upscale-fast", "aGk="));
        let done: Value = serde_json::from_str(&done_upscale("1", "aGk=", 8, 4, json!({}))).unwrap();
        assert_eq!((done["type"].as_str(), done["width"].as_u64(), done["image"].as_str()), (Some("done"), Some(8), Some("aGk=")));
    }

    #[test]
    fn checks_json() {
        let s = json!({ "type": "object", "required": ["a"], "properties": { "a": { "type": "integer" }, "b": { "enum": ["x", "y"] } } });
        assert!(fits(r#"{"a": 2}"#, Some(&s)));
        assert!(fits(r#"{"a": 2.0, "b": "x"}"#, Some(&s)));
        assert!(!fits(r#"{"a": 2.5}"#, Some(&s)));
        assert!(!fits(r#"{"b": "x"}"#, Some(&s)));
        assert!(!fits(r#"{"a": 1, "b": "z"}"#, Some(&s)));
        assert!(!fits("not json", None));
        assert_eq!(unfence("```json\n{\"a\":1}\n```"), "{\"a\":1}");
        assert_eq!(unfence(" {\"a\":1} "), "{\"a\":1}");
    }

    #[test]
    fn downloads() {
        assert_eq!(percent(0, 0), None);
        assert_eq!(percent(50, 200), Some(25));
        assert_eq!(percent(300, 200), Some(100));
        assert!(fits_memory(Some(16), 16) && !fits_memory(Some(16), 32) && fits_memory(None, 32));
    }

    #[test]
    fn model_list() {
        let b = built_in_models();
        assert_eq!(b.len(), 3, "the built-in list passes its own checks");
        assert_eq!(served(&b)[2], ("clef-flash".to_string(), "clef-flash-8k".to_string()));
        let one = |m: Value| check_list(&json!({ "models": [m] }));
        let ok = json!({ "name": "x", "label": "X", "tag": "x:1b", "gb": 1.0, "need_gb": 8 });
        assert_eq!(one(ok.clone()).0.len(), 1);
        let bad = |k: &str, v: Value| { let mut m = ok.clone(); m[k] = v; one(m).0.is_empty() };
        assert!(bad("gb", json!(25.0)), "over the size cap");
        assert!(bad("gb", json!(0)), "no size");
        assert!(bad("tag", json!("https://evil.example/x")), "not a tag");
        assert!(bad("tag", json!("hf.co/a/b/c:q")), "hf path too deep");
        assert!(bad("tag", json!("x; rm -rf /")), "odd characters");
        assert!(bad("name", json!("Qwen 9B")), "name not a pool name");
        assert!(bad("label", json!("a\nb")), "control characters");
        assert!(bad("from", json!("hf.co/a/b:q")), "from without ctx");
        assert!(!bad("tag", json!("hf.co/bartowski/Some_Model-GGUF:Q4_K_M")));
        let many: Vec<Value> = (0..12).map(|i| json!({ "name": format!("m{i}"), "label": "M", "tag": format!("m{i}:1b"), "gb": 1.0, "need_gb": 8 })).collect();
        let (kept, dropped) = check_list(&json!({ "models": many }));
        assert_eq!((kept.len(), dropped.len()), (MAX_MODELS, 4));
        assert!(check_list(&json!({ "nope": 1 })).0.is_empty());
        assert!(fits_disk(Some(30.0), 16.1) && !fits_disk(Some(25.0), 16.1) && fits_disk(None, 16.1));
        assert_eq!(byte_limit(10.0), 11_000_000_000);
        assert_eq!(byte_limit(100.0), byte_limit(MAX_MODEL_GB));
    }

    #[test]
    fn models_and_waits() {
        let m = parse_models("qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k");
        assert_eq!(offered(&m, &["clef-flash-8k:latest".into()]), vec!["clef-flash".to_string()]);
        assert_eq!((backoff(0), backoff(3), backoff(9)), (1, 8, 60));
        assert!(cooled(Some(64.0), 0) && !cooled(Some(70.0), 10) && cooled(Some(70.0), 60) && cooled(None, 0));
    }
}
