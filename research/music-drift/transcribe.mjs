// Transcribe the vocal clips with Whisper large-v3-turbo (Workers AI), once forced to Estonian
// and once with language detection. Writes out/transcripts.json.
// Usage: CF_TOKEN=... node research/music-drift/transcribe.mjs
import { readFile, writeFile, readdir } from "node:fs/promises";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const OUT = new URL("./out/", import.meta.url);
const MODEL = "@cf/openai/whisper-large-v3-turbo";

async function whisper(audio, language) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CF_TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
    body: JSON.stringify({ audio, ...(language && { language }), vad_filter: true, condition_on_previous_text: false }),
  });
  const body = await res.json();
  const r = body.result ?? body;
  return { text: r.text ?? JSON.stringify(body.errors), language: r.transcription_info?.language, probability: r.transcription_info?.language_probability };
}

const files = (await readdir(OUT)).filter((f) => f.endsWith(".mp3") && !/part|maamme/.test(f));
const out = {};
await Promise.all(files.map(async (f) => {
  const audio = (await readFile(new URL(f, OUT))).toString("base64");
  const [et, auto] = await Promise.all([whisper(audio, "et"), whisper(audio)]);
  out[f] = { et, auto };
  console.log(`\n## ${f}\n[et] ${et.text}\n[auto: ${auto.language} ${auto.probability?.toFixed?.(2)}] ${auto.text}`);
}));
await writeFile(new URL("transcripts.json", OUT), JSON.stringify(out, null, 2));
