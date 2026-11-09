// cargo run --release --example draw -- <class 0..999> <seed> out.png
// Times loading, the first picture (it tunes the graphics chip's code) and a second.
use std::time::Instant;
use biggan::{BigGan, SIDE, WEIGHTS};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let class: usize = args[1].parse().expect("class 0..999");
    let seed: u64 = args[2].parse().expect("seed");
    let out = &args[3];
    let t = Instant::now();
    let g = BigGan::load(std::fs::read(WEIGHTS).expect("weights from build.rs"));
    eprintln!("load {:.2} s", t.elapsed().as_secs_f64());
    for run in 1..=2 {
        let t = Instant::now();
        let rgb = g.draw(class, seed);
        eprintln!("run {run}: {:.2} s", t.elapsed().as_secs_f64());
        image::save_buffer(out, &rgb, SIDE as u32, SIDE as u32, image::ExtendedColorType::Rgb8).expect("write png");
    }
}
