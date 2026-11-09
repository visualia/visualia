// UPSCALE_DIR=weights cargo run --release --example run -- <fast|quality> in.png out.jpg
// Times loading, the first picture (it tunes the graphics chip's code) and a
// second one; the result goes to out.jpg.
use std::time::Instant;
use upscale::{Kind, Upscaler};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (which, input, output) = (&args[1], &args[2], &args[3]);
    let kind = match which.as_str() {
        "fast" => Kind::Fast,
        "quality" => Kind::Quality,
        other => panic!("unknown model {other}: fast or quality"),
    };
    let dir = std::env::var("UPSCALE_DIR").unwrap_or_else(|_| "weights".into());
    let bytes = std::fs::read(input).expect("read input");

    let t = Instant::now();
    let up = Upscaler::load(kind, std::path::Path::new(&dir)).expect("load");
    eprintln!("load {:.2} s", t.elapsed().as_secs_f64());
    for run in 1..=2 {
        let t = Instant::now();
        let (jpeg, w, h) = up.file(&bytes).expect("upscale");
        eprintln!("{which} run {run}: → {w}×{h} in {:.2} s", t.elapsed().as_secs_f64());
        std::fs::write(output, jpeg).expect("write output");
    }
}
