// Rebuilds the committed fallback catalog, data/voices.packed.json.
//
// Usage: TTS_API_KEY=tts_... node scripts/build-data.mjs
//
// The running site refreshes its catalog from the API by itself once a
// day; this file is only the seed and the offline fallback, so running
// this script occasionally keeps that fallback close to reality. One free
// API call, no per-voice probing (samples resolve on demand at runtime).
//
// The bare /voices endpoint returns every provider the AI TTS Microservice
// carries. Only blessed providers are packed; anything else is reported so
// a human can decide whether to bless it in lib/providers.ts.

import { writeFileSync, mkdirSync } from "node:fs";

// Keep in step with the keys in lib/providers.ts. Blessing a provider is a
// deliberate act: add it there (copy, family metadata), add it here, rerun.
const BLESSED = ["google", "polly", "kokoro"];

const KEY = process.env.TTS_API_KEY;
if (!KEY) {
  console.error("Set TTS_API_KEY in the environment first.");
  process.exit(1);
}

const BASE = "https://aitts.theproductivepixel.com/api/v1";

const res = await fetch(`${BASE}/voices`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
if (!res.ok) throw new Error(`voices list failed: ${res.status}`);
const voices = (await res.json()).data.voices;
console.log(`fetched ${voices.length} voices`);

const GENDER_CODE = { female: "f", male: "m", neutral: "n", unknown: "u" };

const byProvider = new Map();
for (const v of voices) {
  const p = v.provider ?? v.voice_id.split(":")[0];
  const list = byProvider.get(p) ?? [];
  list.push(v);
  byProvider.set(p, list);
}

const providers = {};
for (const key of BLESSED) {
  const list = byProvider.get(key) ?? [];
  if (list.length === 0) {
    console.warn(`blessed provider "${key}" returned no voices; leaving it out of the pack`);
    continue;
  }
  const models = {};
  for (const v of list) {
    for (const m of v.available_models ?? []) {
      const l = (models[v.family] ??= []);
      if (!l.includes(m)) l.push(m);
    }
  }
  providers[key] = {
    models,
    voices: list.map((v) => {
      const rebuilt = `${key}:${v.language}-${v.family}-${v.name}`;
      if (rebuilt !== v.voice_id) {
        throw new Error(`voice id does not match packed layout: ${v.voice_id}`);
      }
      const row = [
        v.language,
        v.family,
        v.name,
        GENDER_CODE[v.gender] ?? "u",
        v.model_type === "ultra" ? "u" : "p",
        (v.characteristics?.styles ?? []).slice(0, 2).join(","),
      ];
      // Non-style characteristics ride an optional seventh slot, keyed
      // as the API keys them (age, accent, pitch, use_case, roles).
      const c = v.characteristics ?? {};
      const traits = {};
      if (c.age) traits.age = c.age;
      if (c.accent) traits.accent = c.accent;
      if (c.pitch) traits.pitch = c.pitch;
      if (c.use_case) traits.use_case = c.use_case;
      if (c.roles?.length) traits.roles = c.roles;
      if (Object.keys(traits).length > 0) row.push(JSON.stringify(traits));
      return row;
    }),
  };
}

for (const [key, list] of byProvider) {
  if (!BLESSED.includes(key)) {
    console.warn(
      `unblessed provider "${key}" upstream with ${list.length} voices; ignored until blessed in lib/providers.ts`,
    );
  }
}

const packed = {
  version: 4,
  updated: new Date().toISOString().slice(0, 10),
  providers,
};

mkdirSync("data", { recursive: true });
writeFileSync("data/voices.packed.json", JSON.stringify(packed));
const summary = Object.entries(providers)
  .map(([key, p]) => {
    const models = Object.entries(p.models)
      .map(([f, list]) => `${f}: ${list.length} sub-models`)
      .join(", ");
    return `${key} ${p.voices.length}${models ? ` (${models})` : ""}`;
  })
  .join("; ");
console.log(`wrote data/voices.packed.json: ${summary}`);
