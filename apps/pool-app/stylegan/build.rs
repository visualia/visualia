// Turns models/stylegan2_afhqwild.onnx (from export.py) into Burn code
// (OUT_DIR/model/stylegan2_afhqwild.rs) and Burnpack weights (.bpk next to
// it). The weights are not built in: Generator::load reads the .bpk.
use burn_onnx::{LoadStrategy, ModelGen};

fn main() {
    let path = "models/stylegan2_afhqwild.onnx";
    println!("cargo:rerun-if-changed={path}");
    ModelGen::new().input(path).out_dir("model/").load_strategy(LoadStrategy::Bytes).run_from_script();
}
