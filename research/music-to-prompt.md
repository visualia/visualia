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
6. **A small model writes the prompt.** The prompt step needs a language model, not a large one: vrch uses a local
   Qwen-family model. A pool computer could do it while the image model runs elsewhere. Where: `plans/pool.md`,
   `plans/local-models.md`.

## Not known

vrch's latency from sound to picture, the size of the Qwen model, how often a prompt is rewritten, and how "Music to
Emotion" is trained.
