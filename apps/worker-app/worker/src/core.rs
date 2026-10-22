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
// (kind 'decide', for /v1/decide) carry state and questions.
pub struct Job {
    pub id: String,
    pub model: String,
    pub decide: bool,
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
    fn models_and_waits() {
        let m = parse_models("qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k");
        assert_eq!(offered(&m, &["clef-flash-8k:latest".into()]), vec!["clef-flash".to_string()]);
        assert_eq!((backoff(0), backoff(3), backoff(9)), (1, 8, 60));
        assert!(cooled(Some(64.0), 0) && !cooled(Some(70.0), 10) && cooled(Some(70.0), 60) && cooled(None, 0));
    }
}
