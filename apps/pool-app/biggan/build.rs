// Turns models/biggan_deep_256.onnx (made by export.py) into Burn code and
// Burnpack weights in OUT_DIR/model/.
use burn_onnx::{LoadStrategy, ModelGen};

fn main() {
    let path = "models/biggan_deep_256.onnx";
    println!("cargo:rerun-if-changed={path}");
    ModelGen::new().input(path).out_dir("model/").load_strategy(LoadStrategy::Bytes).run_from_script();
}
