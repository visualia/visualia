// A tiny tintinnabuli generator: no dependencies, writes a MIDI file and a WAV file.
//
// The rule (Paul Hillier, "Arvo Pärt", Oxford Studies of Composers, OUP 1997, the chapter on
// tintinnabuli; Wikipedia's "Tintinnabuli" cites pp. 99–100):
//   - the M-voice ("melodic") moves mostly by step, to and from a central pitch;
//   - the T-voice ("tintinnabuli") only ever sounds notes of the tonic triad;
//   - which triad note is fixed by its position relative to the M-voice: "first position"
//     is the nearest triad note, "second position" the next one out; "superior" is above,
//     "inferior" below, "alternating" switches between the two note by note.
// Checked against Hillier via secondary sources (Wikipedia, UNT thesis, ResearchGate papers),
// not the book itself. Read the book before quoting page numbers.
//
// This is the rule, not Pärt's music: no piece of his is quoted, and his name does not go on
// the audio. Any public use of the idea with his name: ask the Arvo Pärt Centre first.
//
// Usage: node research/music-drift/tintinnabuli.mjs [--position 1|2] [--mode superior|inferior|alternating] [--out dir]

import { writeFileSync, mkdirSync } from "node:fs";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const POSITION = Number(arg("position", 1));
const MODE = arg("mode", "superior");
const OUT = arg("out", new URL("./out/", import.meta.url).pathname);

// A minor (Aeolian), A4 = MIDI 69 as the central pitch.
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // semitones above A
const TRIAD = new Set([9, 0, 4]); // pitch classes A, C, E
const step = (deg) => 69 + 12 * Math.floor(deg / 7) + SCALE[((deg % 7) + 7) % 7]; // scale degree to MIDI

// The T-voice: the n-th triad note strictly above (or below) the M note.
function tNote(m, dir, pos) {
  let t = m;
  for (let found = 0; found < pos; ) {
    t += dir;
    if (TRIAD.has(((t % 12) + 12) % 12)) found++;
  }
  return t;
}

// The M-voice: phrase k walks k steps away from A and comes home, alternating down and up.
// A plain additive plan, the kind of process the style is built on; not taken from any piece.
const BEAT = 0.8; // seconds
const notes = []; // { voice, pitch, start, dur }
let time = 0;
let alt = 1;
for (let k = 1; k <= 6; k++) {
  const dir = k % 2 ? -1 : 1;
  const path = [];
  for (let i = 0; i <= k; i++) path.push(dir * i);
  for (let i = k - 1; i >= 0; i--) path.push(dir * i);
  path.forEach((deg, i) => {
    const last = i === path.length - 1;
    const dur = (last ? 3 : 1) * BEAT;
    const m = step(deg);
    const tDir = MODE === "inferior" ? -1 : MODE === "alternating" ? (alt = -alt) : 1;
    notes.push({ voice: 0, pitch: m, start: time, dur });
    notes.push({ voice: 1, pitch: tNote(m, tDir, POSITION), start: time, dur });
    time += dur;
  });
  time += BEAT; // breath between phrases
}
notes.push({ voice: 2, pitch: 45, start: 0, dur: time }); // A2 drone under everything
const LENGTH = time + 3;

// --- MIDI (format 1, one track per voice, 480 ticks per beat, 75 bpm = 0.8 s a beat) ---
const TPQ = 480;
const vlq = (n) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
function track(events, program, channel) {
  const ev = [];
  for (const n of events) {
    ev.push({ t: Math.round((n.start / BEAT) * TPQ), b: [0x90 | channel, n.pitch, 70] });
    ev.push({ t: Math.round(((n.start + n.dur) / BEAT) * TPQ), b: [0x80 | channel, n.pitch, 0] });
  }
  ev.sort((a, b) => a.t - b.t || a.b[0] - b.b[0]); // note-offs before note-ons at the same tick
  const bytes = [0, 0xc0 | channel, program];
  let last = 0;
  for (const e of ev) {
    bytes.push(...vlq(e.t - last), ...e.b);
    last = e.t;
  }
  bytes.push(0, 0xff, 0x2f, 0);
  return [...Buffer.from("MTrk"), ...u32(bytes.length), ...bytes];
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const tempo = [...Buffer.from("MTrk"), ...u32(11), 0, 0xff, 0x51, 3, ...u32(BEAT * 1e6).slice(1), 0, 0xff, 0x2f, 0];
const midi = Buffer.from([
  ...Buffer.from("MThd"), ...u32(6), ...u16(1), ...u16(4), ...u16(TPQ),
  ...tempo,
  ...track(notes.filter((n) => n.voice === 0), 19, 0), // church organ: M-voice
  ...track(notes.filter((n) => n.voice === 1), 14, 1), // tubular bells: T-voice
  ...track(notes.filter((n) => n.voice === 2), 19, 2), // organ drone
]);

// --- WAV (44.1 kHz, mono, 16-bit): soft organ for M and the drone, a bell for T ---
const SR = 44100;
const buf = new Float32Array(Math.ceil(LENGTH * SR));
const hz = (p) => 440 * 2 ** ((p - 69) / 12);
const PARTIALS = {
  0: [[1, 0.5], [2, 0.25], [3, 0.12], [4, 0.06]],
  1: [[1, 0.5], [2.0, 0.3], [3.0, 0.15], [4.2, 0.1], [5.4, 0.05]],
  2: [[1, 0.35], [2, 0.15], [3, 0.05]],
};
for (const n of notes) {
  const f = hz(n.pitch);
  const s0 = Math.floor(n.start * SR);
  const len = Math.floor((n.dur + (n.voice === 1 ? 2 : 0.3)) * SR);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / SR;
    let env;
    if (n.voice === 1) env = Math.exp(-t * 1.6) * Math.min(1, t / 0.004); // struck, rings on
    else {
      const rel = Math.max(0, t - n.dur);
      env = Math.min(1, t / 0.08) * (rel ? Math.exp(-rel * 12) : 1); // swells, stops
    }
    let s = 0;
    for (const [mul, amp] of PARTIALS[n.voice]) {
      const decay = n.voice === 1 ? Math.exp(-t * mul * 0.5) : 1; // upper partials of a bell die first
      s += amp * decay * Math.sin(2 * Math.PI * f * mul * t);
    }
    buf[s0 + i] += s * env * (n.voice === 1 ? 0.35 : 0.22);
  }
}
// A little room: three feedback delays.
for (const [d, g] of [[0.031, 0.35], [0.047, 0.3], [0.067, 0.25]]) {
  const n = Math.floor(d * SR);
  for (let i = n; i < buf.length; i++) buf[i] += buf[i - n] * g * 0.5;
}
const peak = buf.reduce((p, x) => Math.max(p, Math.abs(x)), 0) || 1;
const pcm = Buffer.alloc(44 + buf.length * 2);
pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + buf.length * 2, 4); pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
pcm.write("data", 36); pcm.writeUInt32LE(buf.length * 2, 40);
buf.forEach((x, i) => pcm.writeInt16LE(Math.round((x / peak) * 0.9 * 32767), 44 + i * 2));

mkdirSync(OUT, { recursive: true });
const name = `tintinnabuli-${POSITION}-${MODE}`;
writeFileSync(`${OUT}/${name}.mid`, midi);
writeFileSync(`${OUT}/${name}.wav`, pcm);

// Print the score so the rule can be checked by eye.
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const nm = (p) => NAMES[p % 12] + (Math.floor(p / 12) - 1);
const M = notes.filter((n) => n.voice === 0), T = notes.filter((n) => n.voice === 1);
console.log(`${name}: ${LENGTH.toFixed(1)} s, ${M.length} M notes`);
console.log("M:", M.map((n) => nm(n.pitch)).join(" "));
console.log("T:", T.map((n) => nm(n.pitch)).join(" "));
