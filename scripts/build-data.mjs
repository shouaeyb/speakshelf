// Rebuilds data/voices.packed.json from the AI TTS API.
//
// Usage: TTS_API_KEY=tts_... node scripts/build-data.mjs
//
// One free API call: the voice listing. Samples resolve on demand at
// runtime (the API generates a missing sample and answers 202 while it
// works), so there is no per-voice probing here.

import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.TTS_API_KEY;
if (!KEY) {
  console.error("Set TTS_API_KEY in the environment first.");
  process.exit(1);
}

const BASE = "https://aitts.theproductivepixel.com/api/v1";

// Mirrors GEMINI_MODELS in lib/families.ts. If the API starts reporting a
// different set, update that file too; this script only warns.
const KNOWN_GEMINI_MODELS = [
  "gemini-2.5-flash-tts",
  "gemini-2.5-pro-tts",
  "gemini-2.5-flash-lite-preview-tts",
  "gemini-3.1-flash-tts-preview",
];

const res = await fetch(`${BASE}/voices?provider=google`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
if (!res.ok) throw new Error(`voices list failed: ${res.status}`);
const voices = (await res.json()).data.voices;
console.log(`fetched ${voices.length} voices`);

const seen = new Set(voices.flatMap((v) => v.available_models ?? []));
const known = new Set(KNOWN_GEMINI_MODELS);
const drift = [
  ...[...seen].filter((m) => !known.has(m)),
  ...[...known].filter((m) => !seen.has(m)),
];
if (drift.length) {
  console.warn(`Gemini sub-model list changed, update lib/families.ts: ${drift.join(", ")}`);
}

const GENDER_CODE = { female: "f", male: "m", neutral: "n", unknown: "u" };

const packed = {
  version: 2,
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
      (v.characteristics?.styles ?? []).slice(0, 2).join(","),
    ];
  }),
};

mkdirSync("data", { recursive: true });
writeFileSync("data/voices.packed.json", JSON.stringify(packed));
console.log(`wrote data/voices.packed.json: ${packed.voices.length} voices`);
