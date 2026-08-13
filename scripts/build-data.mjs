// Rebuilds data/voices.packed.json from the AI TTS API.
//
// Usage: TTS_API_KEY=tts_... node scripts/build-data.mjs
//
// Listing voices and resolving sample URLs are free API calls, but the
// sample probe sends one request per voice, so the full run takes a few
// minutes at the polite request rate used here.

import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.TTS_API_KEY;
if (!KEY) {
  console.error("Set TTS_API_KEY in the environment first.");
  process.exit(1);
}

const BASE = "https://aitts.theproductivepixel.com/api/v1";
const HEADERS = { Authorization: `Bearer ${KEY}` };

async function listVoices() {
  const res = await fetch(`${BASE}/voices?provider=google`, { headers: HEADERS });
  if (!res.ok) throw new Error(`voices list failed: ${res.status}`);
  const body = await res.json();
  return body.data.voices;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hasSample(voiceId, attempt = 0) {
  const url = `${BASE}/voices/${encodeURIComponent(voiceId)}/sample-url`;
  const res = await fetch(url, { headers: HEADERS }).catch(() => null);
  if (!res || res.status === 429 || res.status >= 500) {
    if (attempt >= 6) return null; // unknown, treat as no sample
    const retryAfter = res?.headers?.get("retry-after");
    await sleep(retryAfter ? Number(retryAfter) * 1000 : 2000 * (attempt + 1));
    return hasSample(voiceId, attempt + 1);
  }
  const body = await res.json().catch(() => null);
  return Boolean(body?.data?.sample_url);
}

const GENDER_CODE = { female: "f", male: "m", neutral: "n", unknown: "u" };

const voices = await listVoices();
console.log(`fetched ${voices.length} voices`);

const coverage = new Map();
let done = 0;
const queue = [...voices];
async function worker() {
  for (;;) {
    const v = queue.shift();
    if (!v) return;
    coverage.set(v.voice_id, await hasSample(v.voice_id));
    done++;
    if (done % 250 === 0) console.log(`probed ${done}/${voices.length}`);
    await sleep(150);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const packed = {
  version: 1,
  updated: new Date().toISOString().slice(0, 10),
  voices: voices.map((v) => {
    const rebuilt = `google:${v.language}-${v.family}-${v.name}`;
    if (rebuilt !== v.voice_id) {
      throw new Error(`voice id does not match packed layout: ${v.voice_id}`);
    }
    return [
      v.language,
      v.family,
      v.name,
      GENDER_CODE[v.gender] ?? "u",
      v.model_type === "ultra" ? "u" : "p",
      coverage.get(v.voice_id) ? 1 : 0,
      (v.characteristics?.styles ?? []).slice(0, 2).join(","),
    ];
  }),
};

mkdirSync("data", { recursive: true });
writeFileSync("data/voices.packed.json", JSON.stringify(packed));
const samples = packed.voices.filter((v) => v[5] === 1).length;
console.log(`wrote data/voices.packed.json: ${packed.voices.length} voices, ${samples} with samples`);
