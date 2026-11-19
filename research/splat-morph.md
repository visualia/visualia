# Splat morph: animating and morphing point clouds and Gaussian splats in the browser

2026-11-16. Desk research for a live morph between TripoSplat objects (262,144 Gaussians, `.splat` or PLY). The
morph itself would be positron's (a device draws it live from data); visualia supplies the splats and, if needed, a
precomputed pairing. Nothing was built or measured here. **READ** means the linked page (or the cloned source) says it,
**INFERRED** means reasoned from it.

## Verdict

**First demo: Spark 2.4 (three.js, WebGL2, MIT), one `SplatMesh` per object, a `dyno` world modifier that reads the
other object's splat by index and blends centre, log-scale, quaternion (slerp) and colour. Pair the splats by index,
which for TripoSplat output is already a Morton-order pairing.** INFERRED, from these reasons:

- Spark sorts the splats *after* the modifiers have run, on the GPU-computed distances, so splats that move every frame
  are sorted correctly, about one frame late. Its authors call this "fully dynamic 3DGS where every splat can move
  independently each frame". READ, [Hacker News reply by the Spark team](https://news.ycombinator.com/item?id=44254194);
  `docs/docs/system-design.md` in the repo.
- It already ships a morph, an explosion, a flow, dissolves and reveals as examples, all as `dyno` shader graphs
  (cloned source, `examples/splat-transitions/effects/*.js`), and a WebXR example that runs on Quest 3. READ.
- `dyno.readPackedSplat(packedSplats, index)` exists, so a modifier on object A can read splat *i* of object B. READ,
  `src/dyno/splats.ts`. That is all a correspondence morph needs.
- **TripoSplat gives the pairing for free.** Our own port writes 8,192 anchor points × 32 Gaussians, anchor-major
  (`xyz = offset + points[:, None, :]`, flattened), and the octree walk emits the anchors parent by parent, child 0
  to 7 (x bit, y bit, z bit). That is Morton (Z-order) order on a 256³ grid. READ, `research/triposplat/triposplat.mjs`
  lines 86–126 and `export.py` line 139. INFERRED: splat *i* of chair and splat *i* of flamingo sit at the same rank on
  the same space-filling curve, which is the cheap correspondence people compute by sorting. Keep that order when
  writing `.splat` (do not sort by size, as some converters do).
- PlayCanvas is the strong second (WebGPU compute renderer with GPU sort, XR budget tuned for Quest), but its
  modifiers live in one scene-wide material chunk and it is a whole engine rather than a library positron can drop in.

Budget for Quest 3S: two objects of 262,144 is 524,288 splats, inside the reported 1 M Quest budget, but small dense
objects are exactly the case Spark warns about (below). Start with 65,536 per object on the headset. INFERRED.

## Renderers

| Renderer | Licence | Per-splat changes each frame | Sorting when splats move | WebXR | Last activity |
|---|---|---|---|---|---|
| [Spark](https://github.com/sparkjsdev/spark) (World Labs), three.js | MIT | Yes, on the GPU: `dyno` shader graph via `objectModifier`/`worldModifier` on centre, scales, quaternion, rgba; uniforms change without recompiling. Also CPU writes to `PackedSplats` ("thousands to tens of thousands of splats is reasonable") | Distances computed on the GPU after modifiers, read back, radix/bucket sort in a Web Worker; ~1 frame lag | Yes (`SparkXr`, `examples/webxr`, Quest 3 named) | v2.4.0, 2026-10-20 |
| [PlayCanvas engine](https://github.com/playcanvas/engine) / [SuperSplat](https://github.com/playcanvas/supersplat) | MIT | Yes, on the GPU: `gsplatModifyVS` with `modifySplatCenter`, `modifySplatRotationScale`, `modifySplatColor` (GLSL and WGSL); also `GSplatContainer` for procedural data with `update(numSplats, centersUpdated)` | CPU sort in a worker (WebGL2/WebGPU), or GPU compute radix sort (WebGPU only); the WebGPU projector calls `modifySplatCenter` before sorting | Yes, both renderers; XR budget for Quest | engine pushed 2026-11-16; 2.19.0 brought the WebGPU renderer |
| [Babylon.js](https://github.com/BabylonJS/Babylon.js) `GaussianSplattingMesh` | Apache-2.0 | CPU: `updateData` on the 32-byte-per-splat array; GPU: material plugins on `GaussianSplattingMaterial`, Node Material has a Gaussian Splatting graph type | Worker sort, or GPU sort on WebGPU ("off by default and its API may change") | Engine has WebXR; splat-specific XR not checked | pushed 2026-11-15 |
| [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) (mkkellogg), three.js | MIT | `dynamicScene` flag for moving whole scenes; no per-splat shader hook documented | WASM SIMD CPU sort in a worker | Yes (`webXRMode`) | **No longer developed**, author points to Spark; last commit 2025-10-19 |
| [gsplat.js](https://github.com/huggingface/gsplat.js) (Hugging Face) | MIT | Not documented | Not checked | Not documented | Last release 1.2.9 (2025-07-12); 2026 commits are maintenance |
| [Gaussian-Splat-Lite](https://github.com/WilliamLiu-1997/Gaussian-Splat-Lite), three.js | Apache-2.0 | `onFrame` for object transforms; SDF edits; no per-splat shader hook documented | Sorted alpha blend or stochastic | Its denoiser supports WebXR | pushed 2026-11-16 |
| [Visionary](https://github.com/Visionary-Laboratory/visionary), WebGPU + ONNX Runtime Web | Apache-2.0 | Yes: a "Gaussian Generator contract" lets an ONNX model "generate or update Gaussians each frame"; plays 4DGS and avatars | GPU sort on WebGPU | Not mentioned | 2026-10-15 |
| [web-splat](https://github.com/KeKsBoTer/web-splat), Rust/WebGPU | Apache-2.0 | Not checked | Not checked | Not checked | 2026-10-23 ("webgl2 support") |

Sources for the table, all READ: Spark [README](https://github.com/sparkjsdev/spark), cloned docs
(`dyno-overview.md`, `splat-mesh.md`, `system-design.md`), [Spark 2.0 post](https://worldlabs.ai/blog/spark-2.0)
(2026-04-14); PlayCanvas [vertex stage](https://developer.playcanvas.com/user-manual/gaussian-splatting/building/custom-shaders/vertex/),
[procedural splats](https://developer.playcanvas.com/user-manual/gaussian-splatting/building/procedural-splats/),
[renderers](https://developer.playcanvas.com/user-manual/gaussian-splatting/rendering-architecture/renderers/),
`compute-gsplat-project-common.js` (GitHub code search), [WebGPU post](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins/)
(2026-06-03); Babylon [docs](https://doc.babylonjs.com/features/featuresDeepDive/mesh/gaussianSplatting); the
repositories' READMEs; licences and dates from the GitHub API on 2026-11-16.

Notes:

- **PlayCanvas culls on the original opacity** before the modifier in the GPU-sort path; a splat faded to 0 by
  `modifySplatColor` was still sorted until a fix closed on 2026-11-06. READ,
  [engine issue #9961 Cull splats faded out by modifySplatColor before the GPU sort](https://github.com/playcanvas/engine/issues/9961).
  Matters for dissolves on many splats. Whether the CPU-sort path sees moved centres was not established.
- **Spark's packed format is 16 bytes a splat**, scales stored as log values with a min/max range
  (`rgbMinMaxLnScaleMinMax`); `ExtSplats` keeps float32 x/y/z. READ, source. INFERRED: for morph paths that leave the
  object's bounds (explosions), check for quantisation steps; `ExtSplats` is the fallback.
- **Spark's sort lags**, so its docs ask for "a reasonably stable correspondence between each frame's splat output
  for the same `index`". READ, `procedural-splats.md`. A morph keyed by index satisfies this by construction.

## Techniques

### Splat to splat (two objects)

1. **Pairing (correspondence).** Options, cheapest first:
   - **Index or rank along a space-filling curve.** Sort both sets by Morton or Hilbert code, pair by rank. O(n log n),
     bijective, local neighbourhoods stay roughly together; artefacts where the curve jumps. INFERRED. TripoSplat
     output is already in Morton order of its anchors (Verdict). Hilbert is smoother than Morton. INFERRED.
   - **Nearest neighbour** (k-d tree, position plus colour weights). Not one-to-one: many splats crowd onto one
     target. The [Gaussian Splat Morpher](https://github.com/feel3x/Gaussian_Splat_Morpher) (Felix Hirt, MIT by its
     README though GitHub shows no SPDX, PyTorch, last push 2025-10-06) weights space 0.7 and colour 0.3 and fades the
     unmatched in and out; slerps rotations. READ, [Radiance Fields article](https://radiancefields.com/gaussian-splatting-morphing-tool-to-blend-between-3dgs-captures)
     and README.
   - **Sliced optimal transport.** Project both sets onto random directions, sort each 1-D projection, move points
     along the matches, repeat. Near-OT quality at sort cost; Bonneel's line of work uses it to advect one 3-D point
     set onto another. READ, [SPOT: Sliced Partial Optimal Transport](https://perso.liris.cnrs.fr/david.coeurjolly/publication/bonneel-19-spot/bonneel-19-spot-lowres.pdf)
     and [the OT survey for graphics](https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.14778). INFERRED: the best
     fit for a browser or the pool: only sorts, fits WebGPU compute, no n² matrix.
   - **Entropic OT (Sinkhorn).** Dense Sinkhorn at 262,144 a side needs a 262,144² cost matrix (6.9 × 10¹⁰ entries):
     not possible dense. KeOps/GeomLoss keeps memory O(N+M) and "scales up to 100,000 points in fractions of a
     second" on CUDA. READ, [GeomLoss benchmark](https://www.kernel-operations.io/geomloss/_auto_examples/performances/plot_benchmarks_ot_3D.html).
     No WebGPU Sinkhorn library was found. [splatmorph](https://github.com/AmeerJ97/splatmorph) (MIT for its own code,
     2 commits, offline, renders MP4 on CUDA) uses "banded entropic Sinkhorn over position, elevation, appearance, and
     neighborhood context", quadratic Bézier paths and a displacement field during the crossover. READ, README.
   - **Two-level for TripoSplat.** Match the 8,192 anchors (an 8,192² matrix, 67 M entries, fine for Sinkhorn in Node
     or WebGPU), then pair the 32 children of each anchor pair by slot. INFERRED. Run once in visualia (pool job or
     at upload), ship a permutation (262,144 × uint32 = 1 MB) with the pair. Positron only reads it.
2. **Different counts.** Pad the smaller set: duplicate splats (halve opacity of both copies) or add zero-opacity,
   zero-scale splats that grow in; or use the transport plan's barycentric map both ways (splatmorph's "symmetric
   two-set formulation"). READ for splatmorph; the rest INFERRED. Spark's own morph example skips pairing altogether:
   object A scatters to a random disk while shrinking to 0.2× scale and fading, then B gathers from the same disk.
   READ, `examples/splat-transitions/effects/morph.js`. That is the zero-preparation fallback.
3. **Interpolation per splat** (INFERRED, standard practice):
   - centre: linear, or a curved path (Bézier through a lifted midpoint, or curl noise added as `sin(πt)·noise`) so
     the two shapes do not pass through a grey blob;
   - scale: interpolate log-scales (PLY's `scale_*` are already logs; Spark stores ln scale), `exp(mix(lnA, lnB, t))`,
     so splats don't swell midway;
   - rotation: slerp, after flipping B's quaternion if `dot(qA, qB) < 0` (q and −q are the same rotation); nlerp is
     cheaper and fine for small steps;
   - colour: linear in RGB (TripoSplat has only the DC term, `f_dc`, no higher spherical harmonics, READ in
     `triposplat.mjs`, so nothing view-dependent to blend); opacity: linear, or dip mid-morph to hide crossings;
   - stagger: per-splat delay from a hash of the index or from height, so the change sweeps across the object.

### Point cloud to splat, splat to point cloud

- **Point to splat:** a point is a splat with a small isotropic scale, identity rotation and opacity 1; Spark
  (`PackedSplats.pushSplat`) and PlayCanvas (`GSplatContainer`) both build splats from code. READ. A morph from a
  point cloud is then a splat morph where A's scales start tiny. INFERRED.
- **Splat to point cloud:** drive scales to a fixed small value, rotation to identity, opacity to 1. Spark's morph
  already shrinks to 0.2× (READ, above); GaussianSplats3D has a point-cloud display mode (filled circles). READ,
  search summary of its README. Anything with points in it (TripoSR mesh vertices, a depth map, a LiDAR scan) can
  join through this state. INFERRED.

### Papers and projects on morphing or animated splats

- **4D Gaussian Splatting** (Wu et al., CVPR 2024): Gaussians plus a HexPlane-style deformation field; 82 FPS at
  800×800 on an RTX 3090. READ, [project page](https://guanjunwu.github.io/4dgs/). For captured motion, not for
  morphing between unrelated objects. INFERRED. Visionary plays 4DGS exported to ONNX in the browser. READ.
- **SemMorph3D / GaussianMorphing** (arXiv 2510.02034, revised 2026-04-20): mesh-guided Gaussians with
  unsupervised semantic correspondence, learned morph flow. Offline, multi-view input. READ,
  [arXiv](https://arxiv.org/abs/2510.02034).
- **GaussianCube**: places Gaussians on a fixed voxel grid by solving OT between Gaussians and the grid, for
  generative modelling. READ (title and abstract in search), [arXiv 2403.19655](https://arxiv.org/html/2403.19655v1).
  INFERRED: two objects fitted onto the same grid are paired cell by cell, the idea TripoSplat's anchors give us.
- **4D playback in the browser** (flipbooks, not morphs): [Chronosplat](https://github.com/tcwilsonart/Chronosplat)
  (GPL-3.0), [.splat4d](https://adamraudonis.github.io/splats4D/), SuperSplat's timeline since 1.13. READ, search
  results and GitHub API.

## Effects people make (examples)

| Example | What | Renderer | Licence | Source |
|---|---|---|---|---|
| Spark `splat-transitions` | spherical, explosion (gravity, bounce, re-form), flow, morph | Spark | MIT | READ, cloned repo |
| Spark `splat-dissolve-effects`, `splat-reveal-effects`, `splat-flow`, `particle-animation` (10k–30k), `particle-simulation` (snow), `interactive-ripples`, `interactive-deform` | dissolve, reveal, flow between objects, particles | Spark | MIT | READ, cloned repo |
| PlayCanvas `reveal-rain`, `reveal-radial`, `reveal-grid-eruption`, glyph-rain effect ([engine PR #9982 Add a glyph rain gaussian splat shader effect](https://github.com/playcanvas/engine/pull/9982)) | reveals as shader chunks | PlayCanvas | MIT | READ, GitHub code search |
| [gsplat-text-demo](https://splat.niccolofanton.dev/) (Niccolò Fanton) | "twenty reveal, dissolve, twist and unroll transitions" | Spark | not stated; GitHub repo returned 404 on 2026-11-16 | READ, demo page |
| [3DGS_Morphlab](https://github.com/VibrantNebula/3DGS_Morphlab) | morph and displacement effects, Quest 3 WebXR, 72 fps target, fixed foveation on, LoD above 750k splats | Spark | MIT | READ, README and `performanceDefaults.ts` |
| [Synth Splat](https://www.worldlabs.ai/labs/showcase/synth-splat) ([code](https://github.com/ylchen333/synth_splat_web)) | audio-reactive splat worlds for DJ sets; Meyda.js analysis, Morphlab shaders | Spark | none on GitHub | READ |
| [Splatsonia](https://flyar.fi/splatsonia) | upload PLY/SOG, react to mic, tab or file audio | not stated | not stated | READ, [XR AI Spotlight article](https://xraispotlight.substack.com/p/create-audio-reactive-3dgs-on-web) (2026-10-04, renderer behind paywall) |
| [splat-spatial-engine](https://github.com/ER-brocode/splat-spatial-engine) | spatial audio and splats, WGSL compute | three.js/WebGPU | none on GitHub | READ, search summary |
| [Three.js point cloud morphing effect](https://github.com/Kshitij978/Three.js-Point-cloud-morphing-effect) | particles morphing between shapes (points, not splats) | three.js + GSAP | no SPDX | READ, search summary |

INFERRED: Spark has become the place where splat effects are made: most examples above build on it, and Morphlab's
shaders are already reused by another project. Audio-reactive is uniform-driven (band energies into `dynoFloat`s),
which matches positron's "data in, pixels live" split.

## Performance (as reported)

| Number | Device | Source |
|---|---|---|
| Quest 3: "1 million splats or less, not too many splats concentrated in a small area"; Android 1–2 M; iPhone 1–3 M; computer 1–5 M (10–20+ M on some desktops); VR `maxStdDev` `Math.sqrt(5)` | Spark | READ, [Spark performance docs](https://sparkjs.dev/docs/performance/) |
| "500K splats from a Trellis object at a small screen scale" can bottleneck GPU blending | Spark | READ, same page |
| Fixed per-frame budget 500K–2.5M splats depending on device; sort "pretty much every frame with approx 1 frame latency" on newer devices | Spark | READ, [Spark 2.0 post](https://worldlabs.ai/blog/spark-2.0), [HN](https://news.ycombinator.com/item?id=44254194) |
| Quest 3: "each million splats cost about 18 ms per frame"; 9.7 fps before, 30.7 fps (Quality), 40.3 fps (Performance); foveation 15–20%; XR budget 1 M, 72 Hz, 0.8× resolution | PlayCanvas viewer | READ, [supersplat-viewer PR #322 Render XR sessions on standalone headsets within their GPU budget](https://github.com/playcanvas/supersplat-viewer/pull/322) (merged 2026-10-01) |
| WebGPU compute renderer 1.1× to 5.7× faster (5.7× at 35 M) on M4 Max; 2.1× on iPhone 13 Pro Max at 1–4 M | PlayCanvas | READ, [PlayCanvas blog](https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins/) |
| Native Quest 3 / 3S apps: "avoid using Gaussian splats with a splat count greater than 150k" | Meta Spatial SDK | READ, [Meta docs](https://developers.meta.com/vr/documentation/spatial-sdk/spatial-sdk-splats/) |
| 90 FPS on Quest 3 (small splat, after a fix); ~1 fps on Quest 2 at 857,805 splats | GaussianSplats3D | READ, [issue #65 WebXR support for Quest 3](https://github.com/mkkellogg/GaussianSplats3D/issues/65) |

INFERRED from the above:

- No source gives a number for *moving* splats specifically. In Spark and in PlayCanvas's GPU path the modifier is
  one more pass over every splat each frame and the sort runs every frame anyway, so moving splats should cost about
  what static ones cost plus the modifier's ALU. Measure it.
- Quest 3S has the same chip as Quest 3 with lower-resolution displays (general knowledge, not checked here), so the
  Quest 3 numbers are a fair upper bound. At ~18 ms per million (PlayCanvas), 524,288 splats is ~9.4 ms, close to the
  13.9 ms frame at 72 Hz before anything else. 2 × 65,536 leaves room.
- A laptop (M1/M2 class) should hold two 262,144 objects with a modifier at 60 fps given the 1–5 M "computer" budget;
  the risk is fill rate when the object fills the screen, not the count.

## Open questions

1. Does TripoSplat's anchor order survive our `.splat` writer and the pool's y-up turn? (It should: the turn is per
   splat.) Check that two chairs from different noise give a clean index morph before building any matching.
2. How bad is a plain index morph between unrelated shapes (chair → flamingo)? Morton jumps may tear. If so, add the
   two-level anchor Sinkhorn or sliced OT as a pool step.
3. Spark's 16-byte packing: visible stepping on long paths? Compare with `ExtSplats`.
4. Spark on WebGPU: Spark is WebGL2 today; PlayCanvas is the WebGPU option if compute-based effects (real particle
   simulation with state, not stateless hash effects) are wanted.
5. Quest 3S: measure frame time with two objects at 65,536, 131,072 and 262,144, foveation on, `maxStdDev` √5.
6. Who owns the pairing format: a 1 MB permutation file next to the two splats, made in visualia, read by positron.
   Fits "positron receives data, not media" (`CLAUDE.md`). Decide in positron.
