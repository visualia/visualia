// Estonian nature sounds through ElevenLabs Music v2 (no sound-effects model in the catalog, 2026-11-16).
// Usage: CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/nature.mjs [id ...]
// Writes out/nature/<id>.mp3 and <id>.json. Skips ids that exist. $0.0025 per output second.
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const TOKEN = process.env.CF_TOKEN;
const OUT = new URL("./out/nature/", import.meta.url);

const FR = "Field recording, no music, no instruments, no melody, only natural ambient sound recorded with a stereo microphone:";
const el = (scene) => ({ model: "elevenlabs/music-v2", input: { prompt: `${FR} ${scene}`, music_length_ms: 25000, force_instrumental: true, output_format: "mp3_44100_128" } });

// Each Estonian scene has a twin without the place, so the place word is the only change.
const JOBS = {
  "bog-ee": el("spring dawn on an Estonian raised bog (Viru raba), cranes calling, black grouse lekking, a curlew, wind over the bog."),
  "bog-plain": el("spring dawn on a raised bog, cranes calling, black grouse lekking, a curlew, wind over the bog."),
  "meadow-ee": el("a June night in an Estonian meadow, a corncrake calling and a thrush nightingale singing."),
  "meadow-plain": el("a June night in a meadow, a corncrake calling and a nightingale singing."),
  "alvar-ee": el("an Estonian coastal alvar on Saaremaa in May, the Baltic Sea nearby, birds singing."),
  "alvar-plain": el("a coastal limestone meadow by the sea in May, birds singing."),
  "spruce-ee": el("an Estonian spruce forest at dusk, birds singing."),
  "spruce-plain": el("a spruce forest at dusk, birds singing."),
  // The open one: no species named, only the country. What does "Estonian nature" sound like to the model?
  "estonia-open": el("Estonian nature in spring."),
  // For the nature slides (2026-11-17): one clip per subject that had none, the named version only (the place in the
  // prompt, as the pictures' named prompts). rye-ee serves the rye and the cornflower slides.
  "klint-ee": el("the Pakri klint on the north coast of Estonia in early spring, waves breaking against the limestone cliff, drift ice cracking at the shore, strong wind, gulls calling."),
  "peipsi-ee": el("a summer morning in an onion-growing Old Believer village on the Estonian shore of Lake Peipus, small waves on the sandy shore, a rowing boat knocking at the jetty, a cockerel, a dog far away, swallows."),
  // for the intro's Matsalu scene (asked 2026-11-18: "cranes for matsalu?", "generate matsalu sound")
  "matsalu-ee": el("an October evening at Matsalu bay in western Estonia, large flocks of common cranes calling overhead and on the wet meadows, barnacle geese, reeds rustling in the wind, shallow water lapping at the reed bed."),
  "setomaa-ee": el("a summer afternoon in a village in Setomaa, south-east Estonia, no singing and no voices, wind in the old lime trees, hens, a cowbell, a tractor far away, swallows."),
  "lighthouse-ee": el("at Kõpu lighthouse on the island of Hiiumaa, Estonia, strong wind from the Baltic Sea, waves on the shore below, gulls calling."),
  "oldtown-ee": el("a summer morning in Tallinn Old Town, Estonia, church bells ringing from the towers, footsteps on cobblestones, quiet voices far away in a narrow street, pigeons."),
  "juniper-ee": el("a juniper meadow on an Estonian limestone alvar in July, crickets and grasshoppers, bees humming in the flowers, a light wind in the junipers."),
  "rye-ee": el("a summer rye field with cornflowers in Estonia, a skylark singing high above, wind moving through the ripe rye."),
  "eyebright-ee": el("a fen meadow on the island of Saaremaa, Estonia, in July, insects humming, a light wind in the sedges, a curlew calling far away."),
  "ashhills-ee": el("on top of the oil shale ash hill at Kiviõli, Estonia, wind blowing over the bare hill, the low hum of the oil shale plant far below, a freight train far away."),
  "lasnamae-ee": el("Lasnamäe, a Soviet-era district of concrete panel blocks in Tallinn, Estonia, traffic on the main road, children playing in the yard between the blocks, wind between the tall buildings."),
  "birch-ee": el("an Estonian birch forest in spring, wind in the young birch leaves, a chaffinch and a song thrush singing, a cuckoo calling far away."),
};

async function run(id, job) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
    body: JSON.stringify(job),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  await writeFile(new URL(`${id}.json`, OUT), JSON.stringify({ job, status: res.status, body }, null, 2));
  const url = body?.result?.result?.audio ?? body?.result?.audio;
  if (!url) return console.log(id, res.status, "no audio", text.slice(0, 300));
  const audio = await fetch(url);
  await writeFile(new URL(`${id}.mp3`, OUT), Buffer.from(await audio.arrayBuffer()));
  console.log(id, "ok");
}

await mkdir(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
await Promise.all(ids.filter((id) => !existsSync(new URL(`${id}.mp3`, OUT))).map((id) => run(id, JOBS[id]).catch((e) => console.log(id, "error", e.message))));
