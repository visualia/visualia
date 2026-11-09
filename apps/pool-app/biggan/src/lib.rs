//! BigGAN-deep-256 (DeepMind, 2018) in Burn: an ImageNet class and a seed in,
//! a 256×256 picture out, in one pass. The truncation (how far the noise may
//! stray, 0.4) was fixed when the ONNX file was made (export.py).

pub mod model {
    pub mod biggan_deep_256 {
        include!(concat!(env!("OUT_DIR"), "/model/biggan_deep_256.rs"));
    }
}

use burn::prelude::*;
use burn::tensor::Bytes;

pub const SIDE: usize = 256;
pub const CLASSES: usize = 1000;
const Z: usize = 128;
const TRUNCATION: f32 = 0.4; // as in export.py

/// The weights made by build.rs, next to the generated code.
pub const WEIGHTS: &str = concat!(env!("OUT_DIR"), "/model/biggan_deep_256.bpk");

pub struct BigGan {
    device: Device,
    model: model::biggan_deep_256::Model,
}

impl BigGan {
    pub fn load(weights: Vec<u8>) -> BigGan {
        let device = Device::default();
        let model = model::biggan_deep_256::Model::from_bytes(Bytes::from_bytes_vec(weights), &device);
        BigGan { device, model }
    }

    /// One picture of ImageNet class `class` (0..1000) from `seed`, as RGB bytes.
    pub fn draw(&self, class: usize, seed: u64) -> Vec<u8> {
        assert!(class < CLASSES, "class is 0..1000");
        let z = Tensor::<2>::from_data(TensorData::new(truncated_noise(seed), [1, Z]), &self.device);
        let mut one_hot = vec![0f32; CLASSES];
        one_hot[class] = 1.0;
        let c = Tensor::<2>::from_data(TensorData::new(one_hot, [1, CLASSES]), &self.device);
        let out: Vec<f32> = self.model.forward(z, c).into_data().try_to_vec::<f32>().expect("f32 output");
        // Planar -1..1 to interleaved 0..255.
        let plane = SIDE * SIDE;
        let mut rgb = vec![0u8; plane * 3];
        for i in 0..plane {
            for ch in 0..3 {
                rgb[i * 3 + ch] = ((out[ch * plane + i] + 1.0) * 127.5).round().clamp(0.0, 255.0) as u8;
            }
        }
        rgb
    }
}

/// BigGAN's noise: normal values cut at ±2 (drawn again when outside),
/// times the truncation. A small seeded generator, so a seed is a picture.
fn truncated_noise(seed: u64) -> Vec<f32> {
    let mut state = seed;
    let mut next = move || {
        // splitmix64
        state = state.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut x = state;
        x = (x ^ (x >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        x = (x ^ (x >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        ((x ^ (x >> 31)) >> 11) as f64 / (1u64 << 53) as f64
    };
    let mut z = Vec::with_capacity(Z);
    while z.len() < Z {
        // Box-Muller
        let (u, v) = (next().max(f64::MIN_POSITIVE), next());
        let n = (-2.0 * u.ln()).sqrt() * (2.0 * std::f64::consts::PI * v).cos();
        if n.abs() <= 2.0 {
            z.push(n as f32 * TRUNCATION);
        }
    }
    z
}
