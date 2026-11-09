// Turns the two Real-ESRGAN ONNX files into Burn code (OUT_DIR/model/*.rs)
// and Burnpack weights (*.bpk). Fetch the ONNX files first: README.md.
use burn_onnx::ModelGen;

const MODELS: [&str; 2] = [
    "models/real_esrgan_general_x4v3/real_esrgan_general_x4v3-onnx-float/real_esrgan_general_x4v3.onnx",
    "models/real_esrgan_x4plus/real_esrgan_x4plus-onnx-float/real_esrgan_x4plus.onnx",
];

fn main() {
    for path in MODELS {
        println!("cargo:rerun-if-changed={path}");
        ModelGen::new().input(path).out_dir("model/").run_from_script();
    }
}
