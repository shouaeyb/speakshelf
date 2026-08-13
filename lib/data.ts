// Shared between server and client. Unpacks the compact catalog format
// produced by scripts/build-data.mjs.

export type Gender = "female" | "male" | "neutral" | "unknown";
export type Tier = "premium" | "ultra";

export interface Voice {
  /** Full id used by the API, e.g. "google:en-US-Chirp3HD-Charon" */
  id: string;
  lang: string;
  family: string;
  name: string;
  gender: Gender;
  tier: Tier;
  styles: string[];
}

// Tuple: [lang, family, name, gender, tier, styles]
export type PackedVoice = [string, string, string, string, string, string];

export interface PackedCatalog {
  version: number;
  updated: string;
  /** Sub-model ids per family, first entry is the API default. Only
   *  families with more than one model appear (Gemini today). */
  models?: Record<string, string[]>;
  voices: PackedVoice[];
}

const GENDERS: Record<string, Gender> = {
  f: "female",
  m: "male",
  n: "neutral",
  u: "unknown",
};

export function unpack(catalog: PackedCatalog): Voice[] {
  return catalog.voices.map(([lang, family, name, gender, tier, styles]) => ({
    id: `google:${lang}-${family}-${name}`,
    lang,
    family,
    name,
    gender: GENDERS[gender] ?? "unknown",
    tier: tier === "u" ? "ultra" : "premium",
    styles: styles ? styles.split(",") : [],
  }));
}
