// Server side catalog access. Reads the packed data once and memoizes
// the useful derived views.

import packed from "@/data/voices.packed.json";
import { unpack, type Voice, type PackedCatalog } from "./data";
import { languageName } from "./lang";
import { FAMILIES, GEMINI_MODELS } from "./families";

const catalog = packed as PackedCatalog;

let all: Voice[] | null = null;
export function allVoices(): Voice[] {
  if (!all) all = unpack(catalog);
  return all;
}

export const catalogUpdated = catalog.updated;

let byId: Map<string, Voice> | null = null;
export function getVoice(id: string): Voice | undefined {
  if (!byId) byId = new Map(allVoices().map((v) => [v.id, v]));
  return byId.get(id);
}

// Samples resolve on demand upstream, so every voice is playable. Gemini
// voices carry one sample per sub-model, everything else has one.
export function sampleCount(voices: Voice[]): number {
  const gemini = voices.reduce((n, v) => n + (v.family === "Gemini" ? 1 : 0), 0);
  return voices.length + gemini * (GEMINI_MODELS.length - 1);
}

export interface LanguageSummary {
  code: string;
  name: string;
  voices: number;
  samples: number;
  families: number;
}

let langs: LanguageSummary[] | null = null;
export function languages(): LanguageSummary[] {
  if (!langs) {
    const map = new Map<string, Voice[]>();
    for (const v of allVoices()) {
      const list = map.get(v.lang);
      if (list) list.push(v);
      else map.set(v.lang, [v]);
    }
    langs = [...map.entries()]
      .map(([code, list]) => ({
        code,
        name: languageName(code),
        voices: list.length,
        samples: sampleCount(list),
        families: new Set(list.map((v) => v.family)).size,
      }))
      .sort((a, b) => b.voices - a.voices || a.code.localeCompare(b.code));
  }
  return langs;
}

export function voicesForLanguage(code: string): Voice[] {
  return allVoices().filter((v) => v.lang === code);
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

let fams: FamilySummary[] | null = null;
export function familySummaries(): FamilySummary[] {
  if (!fams) {
    const map = new Map<string, { voices: number; langs: Set<string>; tier: "premium" | "ultra" }>();
    for (const v of allVoices()) {
      let e = map.get(v.family);
      if (!e) {
        e = { voices: 0, langs: new Set(), tier: v.tier };
        map.set(v.family, e);
      }
      e.voices++;
      e.langs.add(v.lang);
    }
    fams = FAMILIES.filter((f) => map.has(f.key)).map((f) => {
      const e = map.get(f.key)!;
      return {
        key: f.key,
        label: f.label,
        blurb: f.blurb,
        tier: e.tier,
        voices: e.voices,
        languages: e.langs.size,
        ...(f.key === "Gemini" ? { models: GEMINI_MODELS.length } : {}),
      };
    });
  }
  return fams;
}

export interface CatalogStats {
  voices: number;
  languages: number;
  families: number;
  samples: number;
}

let stats: CatalogStats | null = null;
export function catalogStats(): CatalogStats {
  if (!stats) {
    const v = allVoices();
    stats = {
      voices: v.length,
      languages: new Set(v.map((x) => x.lang)).size,
      families: new Set(v.map((x) => x.family)).size,
      samples: sampleCount(v),
    };
  }
  return stats;
}
