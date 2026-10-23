# OmniSVG 1.1 4B, text to SVG on Apple Silicon (PyTorch MPS). See research/svg-generation.md.
#
# Runs inside a clone of https://github.com/OmniSVG/OmniSVG (for its config.yaml, tokenizer.py
# and deepsvg/), with the official SVG token decoding. Differences from its inference.py, all
# for a 16 GB Mac:
#  - the model is built from Qwen2.5-VL-3B's config.json, not its weights: OmniSVG's
#    pytorch_model.bin holds the whole model, so the 7.5 GB base download isn't needed;
#  - the .bin is memory-mapped and assigned (no second copy in RAM), then moved to "mps";
#  - one sequence at a time (inference.py samples 8 at once and keeps the valid ones):
#    we retry up to --tries times until a candidate decodes and isn't empty.
# Usage: python omnisvg.py --repo OmniSVG --qwen hf/Qwen2.5-VL-3B-Instruct \
#          --weights hf/OmniSVG1.1_4B/pytorch_model.bin --briefs briefs.json --out out/omnisvg-4b
import argparse, json, os, sys, time, io
import numpy as np
import torch

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--qwen', required=True)
ap.add_argument('--weights', required=True)
ap.add_argument('--briefs', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--dtype', default='bfloat16')
ap.add_argument('--device', default='mps')
ap.add_argument('--max-new', type=int, default=1536)
ap.add_argument('--tries', type=int, default=3)
ap.add_argument('--only', default=None)
args = ap.parse_args()

repo = os.path.abspath(args.repo)
briefs = json.load(open(args.briefs, encoding='utf-8'))
out = os.path.abspath(args.out)
os.makedirs(out, exist_ok=True)
qwen, weights = os.path.abspath(args.qwen), os.path.abspath(args.weights)
os.chdir(repo)
sys.path.insert(0, repo)

import yaml
from transformers import AutoConfig, AutoProcessor, Qwen2_5_VLForConditionalGeneration
from transformers.generation.streamers import BaseStreamer
from tokenizer import SVGTokenizer
import cairosvg
from PIL import Image

cfg = yaml.safe_load(open('config.yaml'))
BOS, EOS, PAD = cfg['model']['bos_token_id'], cfg['model']['eos_token_id'], cfg['model']['pad_token_id']
VOCAB = cfg['models']['4B']['model']['vocab_size']
BLACK = cfg['colors']['black_color_token']
DTYPE = getattr(torch, args.dtype)
dev = torch.device(args.device)

SYSTEM_PROMPT = """You are an expert SVG code generator.
Generate precise, valid SVG path commands that accurately represent the described scene or object.
Focus on capturing key shapes, spatial relationships, and visual composition."""
TASK = {  # inference.py's defaults per subtype
  'icon': dict(temperature=0.5, top_p=0.88, top_k=50, repetition_penalty=1.05),
  'illustration': dict(temperature=0.6, top_p=0.90, top_k=60, repetition_penalty=1.03),
}
ICON_WORDS = ['icon', 'logo', 'symbol', 'badge', 'button', 'emoji', 'glyph', 'simple', 'arrow',
              'triangle', 'circle', 'square', 'heart', 'star', 'checkmark']

def subtype(p):  # same rule as inference.detect_text_subtype, shortened
    return 'icon' if any(w in p.lower() for w in ICON_WORDS) else 'illustration'

t0 = time.time()
processor = AutoProcessor.from_pretrained(qwen, padding_side='left')
config = AutoConfig.from_pretrained(qwen)
with torch.device('meta'):
    model = Qwen2_5_VLForConditionalGeneration._from_config(config, torch_dtype=DTYPE)
model.resize_token_embeddings(VOCAB, mean_resizing=False)  # weights come from the .bin anyway
sd = torch.load(weights, map_location='cpu', mmap=True, weights_only=True)
sd = {k.removeprefix('transformer.'): v for k, v in sd.items()}
missing, unexpected = model.load_state_dict(sd, strict=False, assign=True)
missing = [k for k in missing if 'rotary' not in k]
print('missing', missing[:5], len(missing), 'unexpected', unexpected[:5], len(unexpected), flush=True)
if 'lm_head.weight' in missing and config.tie_word_embeddings:
    model.tie_weights()
# rotary inv_freq buffers are non-persistent: recompute them off the meta device
for name, mod in model.named_modules():
    if hasattr(mod, 'inv_freq') and mod.inv_freq.is_meta:
        if hasattr(mod, 'rope_init_fn'):
            inv, _ = mod.rope_init_fn(mod.config, torch.device('cpu'))
        else:  # vision rotary: dim // 2 in Qwen2.5-VL
            d = mod.inv_freq.shape[0] * 2
            inv = 1.0 / (10000 ** (torch.arange(0, d, 2, dtype=torch.float) / d))
        mod.register_buffer('inv_freq', inv, persistent=False)
        if hasattr(mod, 'original_inv_freq'):
            mod.original_inv_freq = inv
model = model.to(dtype=DTYPE).to(dev).eval()
model.config.bos_token_id, model.config.eos_token_id, model.config.pad_token_id = BOS, EOS, PAD
del sd
svg_tok = SVGTokenizer('config.yaml', model_size='4B')
load_s = time.time() - t0
print(f'loaded in {load_s:.1f} s', flush=True)

class Clock(BaseStreamer):
    def __init__(self): self.first = None; self.n = 0; self.calls = 0
    def put(self, value):
        self.calls += 1
        if self.calls == 1: return  # the prompt
        if self.first is None: self.first = time.time()
        self.n += value.numel()
    def end(self): pass

def decode(ids):
    wrap = torch.cat([torch.full((1, 1), BOS), ids.cpu().view(1, -1), torch.full((1, 1), EOS)], dim=1)
    xy = svg_tok.process_generated_tokens(wrap)
    if len(xy) == 0: return None, 'no_tokens'
    tensors, colors = svg_tok.raster_svg(xy)
    if not tensors or not tensors[0]: return None, 'no_paths'
    while len(colors) < len(tensors[0]): colors.append(BLACK)
    s = svg_tok.apply_colors_to_svg(tensors[0], colors).to_str()
    if 'width=' not in s:
        s = s.replace('<svg', '<svg width="448" height="448"', 1)
    return s, len(tensors[0])

def empty(s, kind):
    png = cairosvg.svg2png(bytestring=s.encode(), output_width=512, output_height=512)
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3])
    return np.array(bg).mean() > (252 if kind == 'icon' else 250)

only = args.only.split(',') if args.only else None
res = open(os.path.join(out, '..', 'results.jsonl'), 'a')
for b in briefs:
    if only and b['id'] not in only: continue
    kind = subtype(b['brief'])
    instruction = f"""Generate an SVG illustration for: {b['brief'].strip()}

Requirements:
- Create complete SVG path commands
- Include proper coordinates and colors
- Maintain visual clarity and composition"""
    msgs = [{'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': [{'type': 'text', 'text': instruction}]}]
    text = processor.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    inp = processor(text=[text], padding=True, truncation=True, return_tensors='pt')
    tries = []
    svg = None
    start = time.time()
    for t in range(args.tries):
        clock = Clock(); s0 = time.time()
        torch.manual_seed(42 + t)
        with torch.no_grad():
            r = model.generate(input_ids=inp['input_ids'].to(dev), attention_mask=inp['attention_mask'].to(dev),
                               max_new_tokens=args.max_new, do_sample=True, use_cache=True,
                               eos_token_id=EOS, pad_token_id=PAD, bos_token_id=BOS, streamer=clock,
                               **TASK[kind])
        gen = r[0, inp['input_ids'].shape[1]:]
        hit_eos = bool((gen == EOS).any())
        gen = gen[gen != EOS]
        try:
            s, paths = decode(gen)
            why = 'ok' if s and not empty(s, kind) else (paths if not s else 'empty_image')
        except Exception as e:
            s, paths, why = None, 0, f'error: {e}'
        tries.append(dict(try_=t + 1, ttft_s=round(clock.first - s0, 2) if clock.first else None,
                          total_s=round(time.time() - s0, 1), tokens_out=clock.n, eos=hit_eos, result=why,
                          paths=paths if isinstance(paths, int) else None))
        print(b['id'], tries[-1], flush=True)
        if why == 'ok':
            svg = s; break
        if dev.type == 'mps': torch.mps.empty_cache()
    if svg:
        open(os.path.join(out, b['id'] + '.svg'), 'w').write(svg)
    first = tries[0]
    row = dict(model='omnisvg-1.1-4b', id=b['id'], lang=b['lang'], subtype=kind,
               ttft_s=first['ttft_s'], total_s=round(time.time() - start, 1),
               tokens_out=sum(t['tokens_out'] for t in tries), tok_per_s=round(sum(t['tokens_out'] for t in tries) / sum(t['total_s'] for t in tries), 1),
               tries=tries, svg_bytes=len(svg.encode()) if svg else 0, load_s=round(load_s, 1),
               at=time.strftime('%Y-%m-%dT%H:%M:%S'))
    res.write(json.dumps(row) + '\n'); res.flush()
    time.sleep(5)
