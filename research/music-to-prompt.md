# Music to prompt: vrch's Agentic VJ System, and what Visualia could do with the idea

2026-11-14. Moved here from positron's `research/vrch-synth-2026-11.md`, which keeps vrch's pocket box (Vibing
Synth) and its generated shaders. Nothing was built or measured here. **READ** means read on the cited page,
**INFERRED** means reasoned from it.

## What vrch does

- **A live VJ rig that turns music into pictures through words.** Inputs are "Live Audio Input", "Camera Input" and
  "User Prompt Input". It "runs fully on-device with extremely low latency" (no number given) and also drives stage
  lights over DMX. READ, [vrch.io/aivj](https://www.vrch.io/aivj).
- **The machine.** A backpack computer with an RTX 4080-class GPU runs a diffusion image model. A local
  Qwen-family language model turns the music analysis into prompts for it. READ, the description of
  [the demo video](https://www.youtube.com/watch?v=PJtupyq1R6g) (2026-01-05), titled "real-time audio-to-diffusion
  visuals on local GPU + MIDI control".
- **The analysis.** Their open ComfyUI nodes include an audio tempo (BPM) detector, a "Music to Emotion" detector and
  a frequency band analyser, plus MIDI, OSC, gamepad and keyboard input. READ,
  [comfyui-web-viewer audio nodes](https://github.com/VrchStudio/comfyui-web-viewer/blob/main/docs/audio_nodes.md),
  MIT licence, 358 stars.
- **The output.** Frames go to a browser page as JPEG (or PNG) over a WebSocket, 1280x960 by default. READ,
  [websocket nodes](https://github.com/VrchStudio/comfyui-web-viewer/blob/main/docs/websocket_nodes.md).
- **Who decides.** Their SIGGRAPH Asia 2025 Real-Time Live entry describes Full Auto, Semi-Auto and Manual modes: the
  model leads, or a person does, or both. READ only as a search engine summary; the abstract itself did not open.

The chain, as far as it is public:

```
music in -> tempo, bands, "emotion" -> a local language model writes a prompt
         -> a diffusion model draws a frame on the GPU -> JPEG over WebSocket -> a browser page on the screen
         (MIDI, OSC, gamepad and a typed prompt steer it; DMX lights follow)
```

## What to know before copying it

- **Tempo detection fails on slow music.** positron measured an ambient station: 78 % of its loudness movement sat
  below 0.1 Hz, and a tempo detector scored 0.169 on it against 0.992 on a 120 BPM control (positron
  `research/vr-sound-visual-2026-09.md`). A BPM number says nothing about that kind of music; a slow loudness envelope
  does. INFERRED: a prompt built from tempo would be confidently wrong on half of what a class might play.
- **"Music to emotion" is a label, not a reading.** INFERRED: it is a classifier's guess, and a prompt built from it
  carries the guess as fact. Worth showing as a guess.
- **It needs a large GPU in the room.** A diffusion frame per beat is the expensive half. Visualia's pool shares
  students' computers for AI work (`plans/pool.md`) and plans local models (`plans/local-models.md`,
  `plans/local-images.md`); whether any of them can draw a frame fast enough to follow music is not measured.

## Ideas for Visualia

All INFERRED, none tried. Each names the plan it would go into.

1. **Listen, then write the prompt where everyone can see it.** Music playing in the room becomes a prompt on the
   shared board, and the picture follows it. The interesting part for a class is the text in the middle: what the
   model heard, in words, which people can disagree with and edit. Where: `plans/board.md`, `plans/class-space.md`.
2. **Your words against the model's.** Everyone writes what a piece of music looks like, the model writes its own
   prompt from the analysis, and both are drawn side by side. A lesson in what a model "hears" and what it cannot.
   Where: `schools/eka/docs/` as an exercise.
3. **Slow change, not beats.** Rewrite the prompt on each slow swell of the music (tens of seconds), not on every
   beat, so the pictures can actually be looked at and the image model is asked a few times a minute, not a few
   times a second. Fits a pool of ordinary computers better than vrch's GPU backpack.
4. **Auto, hand, or both.** The model changes the picture until someone touches the prompt, then waits for them, as
   in vrch's semi-auto mode. Where: `plans/studio-core.md`.
5. **The other way round.** A picture on the board becomes a prompt for music, and a sound model plays it. positron
   already has a model writing sound from a wish (positron.studio/code/wish/).
6. **A small model writes the prompt, on the pool as it is.** The prompt step needs a language model, not a large
   one: vrch uses a local Qwen-family model (size not published). The pool already serves the same family
   (`plans/pool.md`, READ): Qwen2.5 1.5B and Qwen3-4B in browser tabs through WebLLM, larger ones (14 to 30B) through
   the worker app on the GeForce lab PCs. The step is text in, text out (analysis words and numbers in, a prompt
   out), which is exactly a pool job, a chat completion, so it needs no change to the pool. What the pool cannot do
   is the step before or after it: hearing the sound (no audio models, the pool carries text only) or drawing the
   picture (pool images are later). So: listening in the browser, the prompt on the pool, the picture through the
   gateway's image model for now. INFERRED and not measured: how fast a 1.5B or 4B tab writes a usable prompt, and
   whether it beats a fixed template filled from the analysis.

## The device's sound model, and the pool

vrch's pocket box has one app that makes sound with a model: VibeLive Synth, "A Stable Audio loop synth: your MacBook
renders, this device plays" (READ, [its app.json](https://github.com/VrchStudio/vrch-apps/blob/main/apps/vibelive-synth/src/app.json)).
The box asks, a laptop renders a loop, the box plays it.

- **The model** is most likely Stability's Stable Audio Open Small (INFERRED from "Stable Audio" and a laptop doing
  the work): 341 million parameters, text to up to 11 s of 44.1 kHz stereo, a T5 text encoder, a diffusion
  transformer and an autoencoder. Stability and Arm report 11 s rendered in under 8 s on a phone's Arm CPU, and 75 ms
  on an H100 (READ, [model card](https://huggingface.co/stabilityai/stable-audio-open-small),
  [TechCrunch](https://techcrunch.com/2025/05/14/stability-ai-releases-an-audio-generating-model-that-can-run-on-smartphones)).
  Its larger sibling, Stable Audio Open 1.0, has 1.1 billion.
- **It runs where the pool's machines are.** There is an MLX port for Apple silicon
  ([stable-audio-mlx](https://github.com/sandst1/stable-audio-mlx)), the PyTorch original for the GeForce lab PCs, and
  a write-up of a 683 MB quantised ONNX build running in a browser on WebGPU
  ([DEV](https://dev.to/martindelophy/running-ai-music-generation-entirely-in-the-browser-onnx-webgpu-samplers-and-long-audio-5b07)).
  READ, none tried here.
- **The pool cannot run it today, and the change is small in shape.** Its jobs are text in, text out (`plans/pool.md`).
  A sound job is the same shape, a prompt in and one result out, but the result is an audio clip, about 2 MB as WAV or
  under 200 KB as Opus for 11 s, and the worker needs a second engine beside llama.cpp or Ollama (MLX or PyTorch in
  the worker app; ONNX Runtime Web in a tab). Like the image models the plan already calls "later": a pinned file,
  checked by SHA-256, shown in the app while it runs. INFERRED.
- **It fits the way vrch uses it, not live sound.** A loop of up to 11 s, rendered in seconds and then played, not a
  stream that follows the room. So: the music analysis and a pool text model write the sound prompt (idea 6), a pool
  machine renders the loop, the class hears it. Idea 5 (picture to music) is the same pipeline the other way.
- **To settle by measuring:** seconds per 11 s loop on a student MacBook, the teacher's M1 and a lab GeForce, and in a
  WebGPU tab; memory used; and Stability's Community Licence terms for a school.

## Not known

vrch's latency from sound to picture, the size of the Qwen model, how often a prompt is rewritten, and how "Music to
Emotion" is trained.
