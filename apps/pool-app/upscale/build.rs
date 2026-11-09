// Turns the two Real-ESRGAN ONNX files into Burn code (OUT_DIR/model/*.rs)
// and Burnpack weights (*.bpk). Fetch the ONNX files first: README.md.
// "fast" (4.9 MB) is built into the program; "quality" (67 MB) stays a file,
// read when it is there (Upscaler::load).
use burn_onnx::{LoadStrategy, ModelGen};

const DIR: &str = "models";

fn main() {
    for (name, strategy) in [("real_esrgan_general_x4v3", LoadStrategy::Embedded), ("real_esrgan_x4plus", LoadStrategy::File)] {
        let path = format!("{DIR}/{name}/{name}-onnx-float/{name}.onnx");
        println!("cargo:rerun-if-changed={path}");
        ModelGen::new().input(&path).out_dir("model/").load_strategy(strategy).run_from_script();
    }
}
