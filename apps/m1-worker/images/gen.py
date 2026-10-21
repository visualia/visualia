# Loads one mflux model once, then generates a list of images, printing one JSON
# line per event so bench.mjs can time each phase against its macmon samples.
#
#   .venv/bin/python gen.py '<spec json>'
#   spec = {"family": "flux2" | "z-image-turbo" | "ernie-image-turbo",
#           "model": "<HF repo or local path>", "base": "<mflux built-in name>",
#           "steps": 4, "precision": "float16" | null, "out": "<dir>",
#           "cache_gb": 1, "vae_tiling": true,
#           "jobs": [{"id": "poster-512", "prompt": "...", "w": 512, "h": 512, "seed": 42}]}
#
# Events: start, loaded, image_start, image_done (seconds, MLX peak memory), end.
#
# Memory: the model stays loaded (text encoder included) like a resident worker would.
# Without a cache limit MLX keeps freed buffers between images and a 16 GB Mac swaps
# (first run: 17.6 GB MLX peak at 1024², 4.8 GB swap), so cap the cache, decode the
# VAE in tiles, and clear the cache after every image.
import gc, json, os, sys, time

T0 = time.time()
def emit(ev, **kw):
    print(json.dumps({"ev": ev, "t": round(time.time() * 1000), **kw}), flush=True)

emit("start")
spec = json.loads(sys.argv[1])
fam = spec["family"]
argv = ["--model", spec["model"], "--base-model", spec["base"], "--steps", str(spec["steps"]),
        "--prompt", "x", "--width", "512", "--height", "512", "--seed", "1"]
if spec.get("precision"):
    argv += ["--compute-precision", spec["precision"]]

import mlx.core as mx

if fam == "flux2":
    from mflux.models.flux2.cli import flux2_generate as cli
    from mflux.models.common.compute_precision import ComputePrecision
    from mflux.models.common.resolution.config_resolution import ConfigResolution
    from mflux.models.flux2.variants import Flux2Klein
    from mflux.cli.parser.parsers import lora_init_kwargs_from_args
    sys.argv = ["gen"] + argv
    args = cli.build_parser().parse_args()
    cfg = ConfigResolution.resolve_restricted(args.model, cli.DEFAULT_MODEL, model_path=args.model_path,
                                              extra_keys=cli.FAMILY_MODELS, base_model=args.base_model)
    model = Flux2Klein(model_config=cfg, quantize=args.quantize, model_path=args.model_path,
                       compute_precision=ComputePrecision.dtype_for(args.compute_precision),
                       **lora_init_kwargs_from_args(args))
    def generate(job):
        return model.generate_image(seed=job["seed"], prompt=job["prompt"], width=job["w"], height=job["h"],
                                    guidance=1.0, image_path=None, num_inference_steps=args.steps,
                                    image_strength=args.image_strength, scheduler="flow_match_euler_discrete",
                                    pid_decode=args.pid_decode, pid_degrade_sigma=args.pid_degrade_sigma)
else:
    if fam == "z-image-turbo":
        from mflux.models.z_image.cli import z_image_turbo_generate as cli
        Cmd = cli.ZImageTurboCommand
    elif fam == "ernie-image-turbo":
        from mflux.models.ernie_image.cli import ernie_image_turbo_generate as cli
        Cmd = cli.ErnieImageTurboCommand
    else:
        raise SystemExit(f"unknown family {fam}")
    sys.argv = ["gen"] + argv
    args = cli.build_parser().parse_args()
    model = Cmd.load(args)
    def generate(job):
        args.width, args.height = job["w"], job["h"]
        return Cmd.generate(model, args, job["seed"], job["prompt"])

if spec.get("cache_gb") is not None:
    mx.set_cache_limit(int(spec["cache_gb"] * 1e9))
if spec.get("vae_tiling"):
    from mflux.models.common.vae.tiling_config import TilingConfig
    if getattr(model, "tiling_config", None) is None:
        model.tiling_config = TilingConfig(vae_decode_tile_size=512)

emit("loaded", seconds=round(time.time() - T0, 2), mem_gb=round(mx.get_active_memory() / 1e9, 2))

os.makedirs(spec["out"], exist_ok=True)
for i, job in enumerate(spec["jobs"]):
    mx.reset_peak_memory()
    t = time.time()
    emit("image_start", i=i, id=job["id"])
    image = generate(job)
    secs = time.time() - t
    path = os.path.join(spec["out"], f"{i:02d}-{job['id']}.png")
    image.save(path=path, export_json_metadata=False)
    del image
    gc.collect()
    mx.clear_cache()
    emit("image_done", i=i, id=job["id"], seconds=round(secs, 2), peak_gb=round(mx.get_peak_memory() / 1e9, 2), path=path)

emit("end", seconds=round(time.time() - T0, 2))
