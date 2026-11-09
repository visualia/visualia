// Turns the two Real-ESRGAN ONNX files into Burn code (OUT_DIR/model/*.rs)
// and Burnpack weights (OUT_DIR/model/*.bpk). Fetch the ONNX files first:
// README.md. The weights are not built in: the app downloads them from the
// pool, a tab fetches them (Upscaler::load, web.rs).
use burn_onnx::{LoadStrategy, ModelGen};

fn main() {
    for name in ["real_esrgan_general_x4v3", "real_esrgan_x4plus"] {
        let path = format!("models/{name}/{name}-onnx-float/{name}.onnx");
        println!("cargo:rerun-if-changed={path}");
        ModelGen::new().input(&path).out_dir("model/").load_strategy(LoadStrategy::Bytes).run_from_script();
    }
}
