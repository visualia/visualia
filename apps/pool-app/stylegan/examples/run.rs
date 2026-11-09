// cargo run --release --example run -- <seed> [out.png]
// Draws the picture for a seed (default out: seed-<seed>.png). Times loading,
// the first picture (it tunes the graphics chip's code) and a second one.
// Weights from STYLEGAN_DIR, else the .bpk this build made.
use std::time::Instant;
use stylegan::Generator;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let seed: u64 = args.get(1).and_then(|s| s.parse().ok()).expect("a seed: a whole number");
    let output = args.get(2).cloned().unwrap_or_else(|| format!("seed-{seed}.png"));
    let dir = std::env::var("STYLEGAN_DIR").unwrap_or_else(|_| concat!(env!("OUT_DIR"), "/model").into());

    let t = Instant::now();
    let g = Generator::load(std::path::Path::new(&dir)).expect("load");
    eprintln!("load {:.2} s", t.elapsed().as_secs_f64());
    for run in 1..=2 {
        let t = Instant::now();
        let png = g.png(seed).expect("draw");
        eprintln!("seed {seed} run {run}: {:.2} s", t.elapsed().as_secs_f64());
        std::fs::write(&output, png).expect("write output");
    }
    eprintln!("{output}");
}
