//! The upscaler in a browser tab (the pool's join page): WebAssembly calling
//! the graphics chip through WebGPU. The page fetches the weights, checks
//! their SHA-256, and gives RGBA pixels in and gets RGBA 4× back.
use crate::{forward, Forward, Kind, Tiles, MAX_PIXELS, PAD, SCALE, TILE};
use burn::prelude::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WebUpscaler {
    device: Device,
    forward: Forward,
}

#[wasm_bindgen]
impl WebUpscaler {
    /// `name`: the pool's name (upscale-fast); `weights`: its .bpk file.
    pub async fn create(name: String, weights: Vec<u8>) -> Result<WebUpscaler, JsError> {
        let kind = Kind::from_name(&name).ok_or_else(|| JsError::new(&format!("no upscaler called {name}")))?;
        let device = Device::wgpu_options().init_async().await.map_err(|e| JsError::new(&format!("no WebGPU: {e}")))?;
        let forward = forward(kind, weights, &device);
        Ok(WebUpscaler { device, forward })
    }

    /// RGBA pixels (width × height) in, RGBA pixels 4× as wide and high out.
    pub async fn rgba(&self, rgba: Vec<u8>, width: usize, height: usize) -> Result<Vec<u8>, JsError> {
        if (width * height) as u64 > MAX_PIXELS || rgba.len() != width * height * 4 {
            return Err(JsError::new("picture too big or the wrong size"));
        }
        let t = Tiles { width, height, tile: TILE, pad: PAD };
        let mut out = vec![0u8; width * SCALE * height * SCALE * 4];
        for corner in t.corners() {
            let data = (self.forward)(t.tensor(t.read(&rgba, 4, corner), &self.device))
                .into_data_async().await.map_err(|e| JsError::new(&format!("{e:?}")))?;
            let result: Vec<f32> = data.try_to_vec::<f32>().map_err(|e| JsError::new(&format!("{e:?}")))?;
            t.write(&result, &mut out, 4, corner);
        }
        Ok(out)
    }
}
