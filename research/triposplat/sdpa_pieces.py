# On MPS, attention builds the whole score matrix: TripoSplat's DiT (cond + uncond,
# 16 heads, about 12k tokens) asks for one 9.7 GB buffer, more than a 16 GB Mac
# gives. The same maths in pieces: per batch item, a few heads and a block of
# queries at a time. Imported by bench.py before the model.
import torch
import torch.nn.functional as F

_sdpa = F.scaled_dot_product_attention
LIMIT = 2 ** 27  # score elements per piece (256 MB in fp16)


def sdpa(q, k, v, *a, **kw):
    if q.device.type != "mps" or a or kw or q.dim() != 4 or q.shape[0] * q.shape[1] * q.shape[2] * k.shape[2] <= LIMIT:
        return _sdpa(q, k, v, *a, **kw)
    B, H, L, S = q.shape[0], q.shape[1], q.shape[2], k.shape[2]
    heads = max(1, LIMIT // (L * S))
    rows = max(1, LIMIT // (heads * S))
    out = torch.empty(q.shape[:-1] + (v.shape[-1],), dtype=q.dtype, device=q.device)
    for b in range(B):
        for h in range(0, H, heads):
            for r in range(0, L, rows):
                out[b:b + 1, h:h + heads, r:r + rows] = _sdpa(q[b:b + 1, h:h + heads, r:r + rows], k[b:b + 1, h:h + heads], v[b:b + 1, h:h + heads])
    return out


F.scaled_dot_product_attention = sdpa
