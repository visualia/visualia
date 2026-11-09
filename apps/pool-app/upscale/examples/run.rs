// cargo run --release --example run -- <fast|quality> in.png out.png [tile]
// Times model loading and the upscale; the result goes to out.png.
use std::time::Instant;
use upscale::model::{real_esrgan_general_x4v3 as fast, real_esrgan_x4plus as quality};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (which, input, output) = (&args[1], &args[2], &args[3]);
    let tile: usize = args.get(4).map(|t| t.parse().unwrap()).unwrap_or(128);
    let img = image::open(input).expect("read input").to_rgb8();
    let (w, h) = (img.width() as usize, img.height() as usize);
    let device = burn::prelude::Device::default();

    let t = Instant::now();
    let run: Box<dyn Fn(burn::prelude::Tensor<4>) -> burn::prelude::Tensor<4>> = match which.as_str() {
        "fast" => { let m = fast::Model::default(); Box::new(move |x| m.forward(x)) }
        "quality" => { let m = quality::Model::default(); Box::new(move |x| m.forward(x)) }
        other => panic!("unknown model {other}: fast or quality"),
    };
    eprintln!("load {:.2} s", t.elapsed().as_secs_f64());

    // A first run on one tile compiles and tunes the GPU kernels for the
    // tile's shape (a worker does this once); time it apart.
    let t = Instant::now();
    upscale::upscale_rgb(&vec![128u8; tile * tile * 3], tile, tile, tile, 8, &device, &run);
    eprintln!("warm-up {:.2} s", t.elapsed().as_secs_f64());

    let t = Instant::now();
    let out = upscale::upscale_rgb(img.as_raw(), w, h, tile, 8, &device, &run);
    let secs = t.elapsed().as_secs_f64();
    eprintln!("{which}: {w}×{h} → {}×{} in {secs:.2} s (tile {tile})", w * 4, h * 4);
    image::RgbImage::from_raw((w * 4) as u32, (h * 4) as u32, out).unwrap().save(output).expect("write output");
}
