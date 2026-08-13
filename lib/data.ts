// Shared between server and client. Unpacks the compact catalog format
// produced by scripts/build-data.mjs (packed v4: one entry per provider).

export type Gender = "female" | "male" | "neutral" | "unknown";
export type Tier = "premium" | "ultra";

export interface Voice {
  /** Full id used by the API, e.g. "polly:en-US-Neural-Joanna" */
  id: string;
  provider: string;
  lang: string;
  family: string;
  name: string;
  gender: Gender;
  tier: Tier;
  styles: string[];
}

// Tuple: [lang, family, name, gender, tier, styles]
export type PackedVoice = [string, string, string, string, string, string];

export interface PackedProvider {
  /** Sub-model ids per family, first entry is the API default. Only
   *  families with more than one model appear (google Gemini today). */
  models?: Record<string, string[]>;
  voices: PackedVoice[];
}

export interface PackedCatalog {
  version: number;
  updated: string;
  providers: Record<string, PackedProvider>;
}

const GENDERS: Record<string, Gender> = {
  f: "female",
  m: "male",
  n: "neutral",
  u: "unknown",
};

export function unpack(provider: string, packed: PackedProvider): Voice[] {
  return packed.voices.map(([lang, family, name, gender, tier, styles]) => ({
    id: `${provider}:${lang}-${family}-${name}`,
    provider,
    lang,
    family,
    name,
    gender: GENDERS[gender] ?? "unknown",
    tier: tier === "u" ? "ultra" : "premium",
    styles: styles ? styles.split(",") : [],
  }));
}
