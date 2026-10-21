# Downloads the pre-quantized mflux weights into ./hf (isolated HF cache). Run with .venv/bin/python.
import os, sys, time
os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(os.path.abspath(__file__)), "hf"))
from huggingface_hub import snapshot_download
for r in sys.argv[1:]:
    t = time.time(); print(time.strftime("%T"), "start", r, flush=True)
    p = snapshot_download("mflux-community/" + r, ignore_patterns=[" /*", " *"])
    print(time.strftime("%T"), "done", r, p, round(time.time() - t), "s", flush=True)
print("ALLDONE", flush=True)
