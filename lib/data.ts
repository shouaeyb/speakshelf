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
  hasSample: boolean;
  styles: string[];
}

// Tuple: [lang, family, name, gender, tier, hasSample, styles]
export type PackedVoice = [string, string, string, string, string, number, string];

export interface PackedCatalog {
  version: number;
  updated: string;
  voices: PackedVoice[];
}

const GENDERS: Record<string, Gender> = {
  f: "female",
  m: "male",
  n: "neutral",
  u: "unknown",
};

export function unpack(catalog: PackedCatalog): Voice[] {
  return catalog.voices.map(([lang, family, name, gender, tier, hasSample, styles]) => ({
    id: `google:${lang}-${family}-${name}`,
    lang,
    family,
    name,
    gender: GENDERS[gender] ?? "unknown",
    tier: tier === "u" ? "ultra" : "premium",
    hasSample: hasSample === 1,
    styles: styles ? styles.split(",") : [],
  }));
}
