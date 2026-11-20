// Background removal (kind 'cutout', plans/pool-3d.md): a photo in, the same
// picture as a PNG with alpha out. BiRefNet-lite (MIT), the ONNX export
// onnx-community/BiRefNet_lite-ONNX at de15b22 (onnx/model.onnx, 1024x1024
// input), run with ONNX Runtime (`ort`) on the CPU inside the app, no other
// program. The steps are rembg's birefnet session as in research/triposr/rmbg.mjs,
// where they were measured: resize to 1024 (antialiased bilinear), normalise
// (ImageNet mean and std), sigmoid, min-max, resize back, then rembg's
// post_process_mask (3x3 opening, gaussian sigma 2, cut at 127).
//
// One run peaks at 8 to 9 GB of memory (measured in Node on the M1); the
// session is made for each job and dropped after it, so nothing stays loaded.
use ort::session::Session;
use ort::value::Tensor;

const SIZE: usize = 1024;
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];
pub const MAX_PIXELS: u64 = 4096 * 4096;

// The picture (PNG, JPEG or WebP) with its background removed, as PNG bytes,
// and its size. Blocking: run it off the async threads.
pub fn remove(model: &std::path::Path, picture: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    let img = image::load_from_memory(picture).map_err(|_| "not a picture this worker can read".to_string())?.to_rgba8();
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > MAX_PIXELS { return Err("picture too big".into()); }
    let (wu, hu) = (w as usize, h as usize);
    let rgba = img.into_raw();

    let mut input = vec![0f32; 3 * SIZE * SIZE];
    for c in 0..3 {
        let plane: Vec<f32> = (0..wu * hu).map(|i| f32::from(rgba[i * 4 + c]) / 255.0).collect();
        let small = resize_plane(&plane, wu, hu, SIZE, SIZE);
        for (i, v) in small.iter().enumerate() { input[c * SIZE * SIZE + i] = (v - MEAN[c]) / STD[c]; }
    }
    let logits = {
        let mut session = Session::builder().and_then(|b| b.commit_from_file(model)).map_err(|e| format!("the mask model did not load: {e}"))?;
        let name = session.inputs()[0].name().to_string();
        let tensor = Tensor::from_array(([1usize, 3, SIZE, SIZE], input)).map_err(|e| e.to_string())?;
        let outputs = session.run(ort::inputs![name => tensor]).map_err(|e| format!("the mask model failed: {e}"))?;
        let last = outputs.len() - 1; // the finest of its outputs
        let (_, data) = outputs[last].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        if data.len() != SIZE * SIZE { return Err("the mask model gave an odd mask".into()); }
        data.to_vec()
    };

    let mut pred: Vec<f32> = logits.iter().map(|x| 1.0 / (1.0 + (-x).exp())).collect();
    let (lo, hi) = pred.iter().fold((f32::INFINITY, f32::NEG_INFINITY), |(a, b), &v| (a.min(v), b.max(v)));
    let span = if hi - lo > 0.0 { hi - lo } else { 1.0 };
    for v in &mut pred { *v = (*v - lo) / span; }
    let big = resize_plane(&pred, SIZE, SIZE, wu, hu);
    let soft: Vec<u8> = big.iter().map(|v| (v * 255.0).round().clamp(0.0, 255.0) as u8).collect();
    let mask = post_process(&soft, wu, hu);

    let mut out = rgba;
    for (i, m) in mask.iter().enumerate() { out[i * 4 + 3] = *m; }
    let mut png = Vec::new();
    image::RgbaImage::from_raw(w, h, out).ok_or("the picture's size changed")?
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok((png, w, h))
}

// One plane through a triangle filter widened by the scale (antialiased
// bilinear, align_corners false), one direction at a time.
fn resize_1d(src: &[f32], sw: usize, sh: usize, d: usize, horizontal: bool) -> Vec<f32> {
    let n = if horizontal { sw } else { sh };
    let scale = n as f64 / d as f64;
    let support = scale.max(1.0);
    let (ow, oh) = if horizontal { (d, sh) } else { (sw, d) };
    let mut out = vec![0f32; ow * oh];
    for o in 0..d {
        let c = (o as f64 + 0.5) * scale;
        let lo = (c - support).floor().max(0.0) as usize;
        let hi = ((c + support).ceil() as usize).min(n - 1);
        let wts: Vec<f64> = (lo..=hi).map(|i| (1.0 - ((i as f64 + 0.5 - c) / support).abs()).max(0.0)).collect();
        let ws: f64 = wts.iter().sum();
        if horizontal {
            for y in 0..sh {
                let a: f64 = (lo..=hi).map(|i| wts[i - lo] * f64::from(src[y * sw + i])).sum();
                out[y * ow + o] = (a / ws) as f32;
            }
        } else {
            for x in 0..sw {
                let a: f64 = (lo..=hi).map(|i| wts[i - lo] * f64::from(src[i * sw + x])).sum();
                out[o * ow + x] = (a / ws) as f32;
            }
        }
    }
    out
}

fn resize_plane(src: &[f32], sw: usize, sh: usize, dw: usize, dh: usize) -> Vec<f32> {
    resize_1d(&resize_1d(src, sw, sh, dw, true), dw, sh, dh, false)
}

// rembg's post_process_mask: opening with a 3x3 cross (erode, then dilate),
// gaussian blur with sigma 2 (13 taps, edges repeated), then over 127 is in.
fn post_process(m: &[u8], w: usize, h: usize) -> Vec<u8> {
    let pass = |src: &[u8], pick: fn(u8, u8) -> u8| -> Vec<u8> {
        let mut o = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                let mut v = src[y * w + x];
                if x > 0 { v = pick(v, src[y * w + x - 1]); }
                if x + 1 < w { v = pick(v, src[y * w + x + 1]); }
                if y > 0 { v = pick(v, src[(y - 1) * w + x]); }
                if y + 1 < h { v = pick(v, src[(y + 1) * w + x]); }
                o[y * w + x] = v;
            }
        }
        o
    };
    let opened = pass(&pass(m, u8::min), u8::max);
    let k: Vec<f64> = (-6i32..=6).map(|i| (-(f64::from(i * i)) / 8.0).exp()).collect();
    let ks: f64 = k.iter().sum();
    let blur = |src: &[f64], dx: isize, dy: isize| -> Vec<f64> {
        let mut o = vec![0f64; w * h];
        for y in 0..h {
            for x in 0..w {
                let mut a = 0.0;
                for i in -6isize..=6 {
                    let xx = (x as isize + i * dx).clamp(0, w as isize - 1) as usize;
                    let yy = (y as isize + i * dy).clamp(0, h as isize - 1) as usize;
                    a += k[(i + 6) as usize] * src[yy * w + xx];
                }
                o[y * w + x] = a / ks;
            }
        }
        o
    };
    let f: Vec<f64> = opened.iter().map(|&v| f64::from(v)).collect();
    blur(&blur(&f, 1, 0), 0, 1).iter().map(|&v| if v > 127.0 { 255 } else { 0 }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resizes_and_cleans() {
        // A flat plane stays flat at any size.
        let r = resize_plane(&vec![0.25; 30 * 20], 30, 20, 7, 11);
        assert_eq!(r.len(), 77);
        assert!(r.iter().all(|v| (v - 0.25).abs() < 1e-6));
        // A lone pixel is opened away; a solid block stays.
        let mut m = vec![0u8; 20 * 20];
        m[5 * 20 + 5] = 255;
        for y in 10..18 { for x in 10..18 { m[y * 20 + x] = 255; } }
        let p = post_process(&m, 20, 20);
        assert_eq!(p[5 * 20 + 5], 0);
        assert_eq!(p[14 * 20 + 14], 255);
    }
}
