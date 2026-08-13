// Server side catalog access. The live voice list is fetched from the
// AI TTS Microservice at most once a day (Next data cache); the packed
// file committed with the repo is the seed and the fallback, so the site
// keeps working when the API is unreachable. New voices, languages and
// sub-models therefore show up on their own, with no code change. New
// PROVIDERS do not: the bare /voices endpoint reports every provider the
// service carries, and anything not blessed in lib/providers.ts is
// console-logged and dropped, so going live stays a human decision.

import fallbackJson from "@/data/voices.packed.json";
import { unpack, type Voice, type PackedCatalog, type PackedProvider } from "./data";
import { languageName } from "./lang";
import { PROVIDER_FAMILIES } from "./families";
import { PROVIDERS, getProvider, isBlessed } from "./providers";

const UPSTREAM = "https://aitts.theproductivepixel.com/api/v1/voices";

const FALLBACK = fallbackJson as unknown as PackedCatalog;

interface ApiVoice {
  voice_id: string;
  provider?: string;
  language: string;
  family: string;
  name: string;
  gender: string;
  model_type: string;
  characteristics?: {
    styles?: string[];
    roles?: string[];
    age?: string | null;
    accent?: string | null;
    pitch?: string | null;
    use_case?: string | null;
  };
  available_models?: string[];
}

const GENDER_CODE: Record<string, string> = { female: "f", male: "m", neutral: "n", unknown: "u" };

// Non-style characteristics worth keeping (Polly's child voices carry
// age; Azure will bring roles). Packed only when non-empty.
function packTraits(c: ApiVoice["characteristics"]): string {
  if (!c) return "";
  const traits: Record<string, unknown> = {};
  if (c.age) traits.age = c.age;
  if (c.accent) traits.accent = c.accent;
  if (c.pitch) traits.pitch = c.pitch;
  if (c.use_case) traits.use_case = c.use_case;
  if (c.roles && c.roles.length > 0) traits.roles = c.roles;
  return Object.keys(traits).length > 0 ? JSON.stringify(traits) : "";
}

function toPackedProvider(key: string, list: ApiVoice[]): PackedProvider | null {
  const models: Record<string, string[]> = {};
  for (const v of list) {
    // The voice id must stay reconstructable from its parts; if the API
    // ever changes that layout, the fallback data is safer than guesses.
    if (`${key}:${v.language}-${v.family}-${v.name}` !== v.voice_id) return null;
    for (const m of v.available_models ?? []) {
      const l = models[v.family] ?? (models[v.family] = []);
      if (!l.includes(m)) l.push(m);
    }
  }
  return {
    models,
    voices: list.map((v) => {
      const base: string[] = [
        v.language,
        v.family,
        v.name,
        GENDER_CODE[v.gender] ?? "u",
        v.model_type === "ultra" ? "u" : "p",
        (v.characteristics?.styles ?? []).slice(0, 2).join(","),
      ];
      const traits = packTraits(v.characteristics);
      if (traits) base.push(traits);
      return base as PackedProvider["voices"][number];
    }),
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
    if (!Array.isArray(list) || list.length === 0) {
      console.warn("catalog refresh: got no voices, using fallback data");
      return null;
    }

    const byProvider = new Map<string, ApiVoice[]>();
    for (const v of list) {
      const p = v.provider ?? v.voice_id.split(":")[0];
      const l = byProvider.get(p);
      if (l) l.push(v);
      else byProvider.set(p, [v]);
    }

    const providers: Record<string, PackedProvider> = {};
    for (const [p, voices] of byProvider) {
      if (!isBlessed(p)) {
        console.warn(
          `catalog refresh: unblessed provider "${p}" upstream with ${voices.length} voices; ignored until blessed in lib/providers.ts`,
        );
        continue;
      }
      const packed = toPackedProvider(p, voices);
      if (!packed) {
        console.warn(`catalog refresh: voice id layout changed upstream (${p}), using fallback data`);
        return null;
      }
      providers[p] = packed;
    }

    // A truncated response must not shrink the site. The committed data is
    // the yardstick, per provider: each blessed provider in the fallback
    // must come back at 80% strength or the whole fallback is used. A
    // provider blessed before its first data refresh has no yardstick yet
    // and passes on live data alone.
    for (const meta of PROVIDERS) {
      const before = FALLBACK.providers[meta.key]?.voices.length;
      if (!before) continue;
      const after = providers[meta.key]?.voices.length ?? 0;
      if (after < before * 0.8) {
        console.warn(
          `catalog refresh: ${meta.key} came back with ${after} voices, expected about ${before}, using fallback data`,
        );
        return null;
      }
    }

    return {
      version: 4,
      updated: new Date().toISOString().slice(0, 10),
      providers,
    };
  } catch (err) {
    console.warn(`catalog refresh failed, using fallback data: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Packed slice for one provider, served by /api/catalog/[provider]. */
export async function getPackedProvider(key: string): Promise<PackedProvider | null> {
  const packed = (await livePacked()) ?? FALLBACK;
  return packed.providers[key] ?? null;
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

export interface ProviderCatalog {
  provider: string;
  updated: string;
  voices: Voice[];
  /** Sub-model ids per family, first entry is the API default. */
  models: Record<string, string[]>;
  languages: LanguageSummary[];
  families: FamilySummary[];
  stats: CatalogStats;
}

export interface SiteStats {
  voices: number;
  providers: number;
  /** Union of language codes across providers. */
  languages: number;
  samples: number;
}

export interface Site {
  updated: string;
  /** Blessed providers present in the data, in display order. */
  providers: Map<string, ProviderCatalog>;
  /** Every voice of every provider, for /api/sample lookups. */
  byId: Map<string, Voice>;
  stats: SiteStats;
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

// A voice is one entry in the provider's own published voice list; a
// sample is one playable render of it. Google's list counts every
// language+family+name row; AWS's table counts language+name once with
// engines as capability columns, so Polly's per-engine rows collapse.
// See voiceIdentity in lib/providers.ts.
export function voiceCount(voices: Voice[], identity: "row" | "langName"): number {
  if (identity === "row") return voices.length;
  const seen = new Set<string>();
  for (const v of voices) seen.add(`${v.lang}|${v.name}`);
  return seen.size;
}

function buildProviderCatalog(provider: string, updated: string, packed: PackedProvider): ProviderCatalog {
  const voices = unpack(provider, packed);
  const models = packed.models ?? {};
  const identity = getProvider(provider)?.voiceIdentity ?? "row";

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
      voices: voiceCount(list, identity),
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
  const known = PROVIDER_FAMILIES[provider] ?? [];
  const families = known.filter((f) => byFamily.has(f.key)).map((f) => summarize(f.key, f.label, f.blurb));
  // A family this code has never heard of still gets a tile.
  for (const key of byFamily.keys()) {
    if (!known.some((f) => f.key === key)) {
      families.push(summarize(key, key, getProvider(provider)?.unknownFamilyBlurb ?? ""));
    }
  }

  return {
    provider,
    updated,
    voices,
    models,
    languages,
    families,
    stats: {
      voices: voiceCount(voices, identity),
      languages: byLang.size,
      families: byFamily.size,
      samples: sampleCount(voices, models),
    },
  };
}

function buildSite(packed: PackedCatalog): Site {
  const providers = new Map<string, ProviderCatalog>();
  // Display order comes from the bless config, not the payload.
  for (const meta of PROVIDERS) {
    const slice = packed.providers[meta.key];
    if (!slice || slice.voices.length === 0) continue;
    providers.set(meta.key, buildProviderCatalog(meta.key, packed.updated, slice));
  }

  const byId = new Map<string, Voice>();
  const langUnion = new Set<string>();
  let voices = 0;
  let samples = 0;
  for (const c of providers.values()) {
    voices += c.stats.voices;
    samples += c.stats.samples;
    for (const v of c.voices) byId.set(v.id, v);
    for (const l of c.languages) langUnion.add(l.code);
  }

  return {
    updated: packed.updated,
    providers,
    byId,
    stats: { voices, providers: providers.size, languages: langUnion.size, samples },
  };
}

// The all-provider voice list is about 2.9MB, which is over the Next data
// cache's 2MB item limit (it logs "items over 2MB can not be cached" and
// stores nothing), so fetch's revalidate window cannot do the daily
// caching here. This process memo is the effective cache instead: six
// hours bounds both the upstream traffic and the JSON parse cost, and the
// pages' own daily ISR still sets the visible refresh cadence. The key
// separates live from fallback data, so a fallback served during an
// outage is replaced as soon as the live fetch works again.
const MEMO_TTL_MS = 6 * 60 * 60 * 1000;
// A forced refresh (unknown voice id on /api/sample) still respects this
// floor, so id-guessing traffic cannot turn into an upstream fetch storm.
const FRESH_FLOOR_MS = 60 * 1000;
let memo: { key: string; at: number; site: Site } | null = null;

function totalVoices(packed: PackedCatalog): number {
  return Object.values(packed.providers).reduce((n, p) => n + p.voices.length, 0);
}

// Concurrent callers at a memo boundary share one refresh instead of each
// fetching the 2.9MB list themselves.
let loading: Promise<Site> | null = null;

function loadSite(): Promise<Site> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const live = await livePacked();
      const packed = live ?? FALLBACK;
      const key = `${live ? "live" : "fallback"}:${packed.updated}:${totalVoices(packed)}`;
      if (memo?.key === key) {
        memo.at = Date.now();
      } else {
        memo = { key, at: Date.now(), site: buildSite(packed) };
      }
      return memo.site;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export async function getSite(): Promise<Site> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.site;
  return loadSite();
}

/** For lookups that just missed: refetches unless the memo is fresh, so a
 *  voice that appeared upstream after the last refresh becomes playable
 *  without waiting out the full memo window. */
export async function getSiteFresh(): Promise<Site> {
  if (memo && Date.now() - memo.at < FRESH_FLOOR_MS) return memo.site;
  return loadSite();
}

export async function getProviderCatalog(key: string): Promise<ProviderCatalog | null> {
  const site = await getSite();
  return site.providers.get(key) ?? null;
}
