# More DiT references for check.mjs: the unconditional call (zero features) and
# a mid-schedule t, VAST's code in fp32 on the CPU. Writes refs/ditu.npz, refs/ditm.npz.
import numpy as np
import torch
import triposplat as T
torch.set_grad_enabled(False)
R = torch.load("refs.pt")
m = T.load_flow_model("ckpts/diffusion_models/triposplat_fp16.safetensors", device="cpu", dtype=torch.float32)
for name, t, f1, f2 in [("ditu", 1000.0, torch.zeros_like(R["feature1"]), torch.zeros_like(R["feature2"])),
                        ("ditm", 500.0, R["feature1"], R["feature2"])]:
    feeds = {"latent": R["x0"]["latent"], "camera": R["x0"]["camera"], "t": torch.tensor([t]), "feature1": f1, "feature2": f2}
    out = m({"latent": feeds["latent"], "camera": feeds["camera"]}, feeds["t"], {"feature1": f1, "feature2": f2})
    np.savez(f"refs/{name}.npz", **{k: v.numpy() for k, v in feeds.items()}, want_v_latent=out["latent"].numpy(), want_v_camera=out["camera"].numpy())
    print(name, "saved", flush=True)
