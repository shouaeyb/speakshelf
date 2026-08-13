// Server side catalog access. The live voice list is fetched from the
// AI TTS Microservice at most once a day (Next data cache); the packed
// file committed with the repo is the seed and the fallback, so the site
// keeps working when the API is unreachable. New voices, languages and
// sub-models therefore show up on their own, with no code change.

import fallbackJson from "@/data/voices.packed.json";
import { unpack, type Voice, type PackedCatalog } from "./data";
import { languageName } from "./lang";
import { FAMILIES } from "./families";

const UPSTREAM = "https://aitts.theproductivepixel.com/api/v1/voices?provider=google";

const FALLBACK = fallbackJson as unknown as PackedCatalog;

interface ApiVoice {
  voice_id: string;
  language: string;
  family: string;
  name: string;
  gender: string;
  model_type: string;
  characteristics?: { styles?: string[] };
  available_models?: string[];
}

const GENDER_CODE: Record<string, string> = { female: "f", male: "m", neutral: "n", unknown: "u" };

function toPacked(list: ApiVoice[]): PackedCatalog | null {
  const models: Record<string, string[]> = {};
  for (const v of list) {
    // The voice id must stay reconstructable from its parts; if the API
    // ever changes that layout, the fallback data is safer than guesses.
    if (`google:${v.language}-${v.family}-${v.name}` !== v.voice_id) return null;
    for (const m of v.available_models ?? []) {
      const l = models[v.family] ?? (models[v.family] = []);
      if (!l.includes(m)) l.push(m);
    }
  }
  return {
    version: 3,
    updated: new Date().toISOString().slice(0, 10),
    models,
    voices: list.map((v) => [
      v.language,
      v.family,
      v.name,
      GENDER_CODE[v.gender] ?? "u",
      v.model_type === "ultra" ? "u" : "p",
      (v.characteristics?.styles ?? []).slice(0, 2).join(","),
    ]),
  };
}

async function livePacked(): Promise<PackedCatalog | null> {
  const key = process.env.TTS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(UPSTREAM, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.warn(`catalog refresh: upstream answered ${res.status}, using fallback data`);
      return null;
    }
    const body = (await res.json()) as { data?: { voices?: ApiVoice[] } };
    const list = body.data?.voices;
    // A truncated response must not shrink the site. The committed data
    // is the yardstick: anything well below it is treated as broken.
    if (!Array.isArray(list) || list.length < FALLBACK.voices.length * 0.8) {
      console.warn(
        `catalog refresh: got ${Array.isArray(list) ? list.length : "no"} voices, expected about ${FALLBACK.voices.length}, using fallback data`,
      );
      return null;
    }
    const packed = toPacked(list);
    if (!packed) {
      console.warn("catalog refresh: voice id layout changed upstream, using fallback data");
    }
    return packed;
  } catch (err) {
    console.warn(`catalog refresh failed, using fallback data: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function getPacked(): Promise<PackedCatalog> {
  return (await livePacked()) ?? FALLBACK;
}

export interface LanguageSummary {
  code: string;
  name: string;
  voices: number;
  samples: number;
  families: number;
}

export interface FamilySummary {
  key: string;
  label: string;
  blurb: string;
  tier: "premium" | "ultra";
  voices: number;
  languages: number;
  /** Sub-model count when the family has more than one, e.g. Gemini. */
  models?: number;
}

export interface CatalogStats {
  voices: number;
  languages: number;
  families: number;
  samples: number;
}

export interface Catalog {
  updated: string;
  voices: Voice[];
  byId: Map<string, Voice>;
  /** Sub-model ids per family, first entry is the API default. */
  models: Record<string, string[]>;
  languages: LanguageSummary[];
  families: FamilySummary[];
  stats: CatalogStats;
}

// Every voice is playable on demand; families with sub-models carry one
// sample per sub-model, everything else has one.
export function sampleCount(voices: Voice[], models: Record<string, string[]>): number {
  let n = voices.length;
  for (const v of voices) {
    const extra = (models[v.family]?.length ?? 1) - 1;
    if (extra > 0) n += extra;
  }
  return n;
}

function buildCatalog(packed: PackedCatalog): Catalog {
  const voices = unpack(packed);
  const models = packed.models ?? {};

  const byLang = new Map<string, Voice[]>();
  for (const v of voices) {
    const l = byLang.get(v.lang);
    if (l) l.push(v);
    else byLang.set(v.lang, [v]);
  }
  const languages = [...byLang.entries()]
    .map(([code, list]) => ({
      code,
      name: languageName(code),
      voices: list.length,
      samples: sampleCount(list, models),
      families: new Set(list.map((v) => v.family)).size,
    }))
    .sort((a, b) => b.voices - a.voices || a.code.localeCompare(b.code));

  const byFamily = new Map<string, { voices: number; langs: Set<string>; tier: "premium" | "ultra" }>();
  for (const v of voices) {
    let e = byFamily.get(v.family);
    if (!e) {
      e = { voices: 0, langs: new Set(), tier: v.tier };
      byFamily.set(v.family, e);
    }
    e.voices++;
    e.langs.add(v.lang);
  }
  const summarize = (key: string, label: string, blurb: string): FamilySummary => {
    const e = byFamily.get(key)!;
    return {
      key,
      label,
      blurb,
      tier: e.tier,
      voices: e.voices,
      languages: e.langs.size,
      ...(models[key] && models[key].length > 1 ? { models: models[key].length } : {}),
    };
  };
  const families = FAMILIES.filter((f) => byFamily.has(f.key)).map((f) => summarize(f.key, f.label, f.blurb));
  // A family this code has never heard of still gets a tile.
  for (const key of byFamily.keys()) {
    if (!FAMILIES.some((f) => f.key === key)) {
      families.push(summarize(key, key, "A recent addition to the Google catalog."));
    }
  }

  return {
    updated: packed.updated,
    voices,
    byId: new Map(voices.map((v) => [v.id, v])),
    models,
    languages,
    families,
    stats: {
      voices: voices.length,
      languages: byLang.size,
      families: byFamily.size,
      samples: sampleCount(voices, models),
    },
  };
}

// The data cache re-parses two megabytes of JSON on every read, which is
// too much for request-path callers like /api/sample. The built catalog is
// therefore held for a few minutes per process; the daily data cache only
// gets consulted when that window lapses. The key separates live from
// fallback data, so a fallback served during an outage is replaced as
// soon as the live fetch works again.
const MEMO_TTL_MS = 5 * 60 * 1000;
let memo: { key: string; at: number; catalog: Catalog } | null = null;

export async function getCatalog(): Promise<Catalog> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.catalog;
  const live = await livePacked();
  const packed = live ?? FALLBACK;
  const key = `${live ? "live" : "fallback"}:${packed.updated}:${packed.voices.length}`;
  if (memo?.key === key) {
    memo.at = Date.now();
  } else {
    memo = { key, at: Date.now(), catalog: buildCatalog(packed) };
  }
  return memo.catalog;
}
