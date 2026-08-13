// Rebuilds the committed fallback catalog, data/voices.packed.json.
//
// Usage: TTS_API_KEY=tts_... node scripts/build-data.mjs
//
// The running site refreshes its catalog from the API by itself once a
// day; this file is only the seed and the offline fallback, so running
// this script occasionally keeps that fallback close to reality. One free
// API call, no per-voice probing (samples resolve on demand at runtime).

import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.TTS_API_KEY;
if (!KEY) {
  console.error("Set TTS_API_KEY in the environment first.");
  process.exit(1);
}

const BASE = "https://aitts.theproductivepixel.com/api/v1";

const res = await fetch(`${BASE}/voices?provider=google`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
if (!res.ok) throw new Error(`voices list failed: ${res.status}`);
const voices = (await res.json()).data.voices;
console.log(`fetched ${voices.length} voices`);

const GENDER_CODE = { female: "f", male: "m", neutral: "n", unknown: "u" };

const models = {};
for (const v of voices) {
  for (const m of v.available_models ?? []) {
    const list = (models[v.family] ??= []);
    if (!list.includes(m)) list.push(m);
  }
}

const packed = {
  version: 3,
  updated: new Date().toISOString().slice(0, 10),
  models,
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
      (v.characteristics?.styles ?? []).slice(0, 2).join(","),
    ];
  }),
};

mkdirSync("data", { recursive: true });
writeFileSync("data/voices.packed.json", JSON.stringify(packed));
const families = Object.entries(models)
  .map(([f, list]) => `${f}: ${list.length} sub-models`)
  .join(", ");
console.log(`wrote data/voices.packed.json: ${packed.voices.length} voices${families ? ` (${families})` : ""}`);
