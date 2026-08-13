// Shared between server and client. Unpacks the compact catalog format
// produced by scripts/build-data.mjs (packed v4: one entry per provider).

export type Gender = "female" | "male" | "neutral" | "unknown";
export type Tier = "premium" | "ultra";

/** Extra voice characteristics beyond styles, keyed exactly as the API's
 *  `characteristics` object so richer providers (Azure ships roles) flow
 *  through without a format change. Only non-empty values are packed;
 *  Polly's child voices (age: "child") are the first real users. */
export interface VoiceTraits {
  age?: string;
  accent?: string;
  pitch?: string;
  use_case?: string;
  roles?: string[];
}

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
  traits: VoiceTraits;
}

// Tuple: [lang, family, name, gender, tier, styles, traitsJson?]
// The seventh slot appears only when a voice has traits, so the packed
// file stays compact and old readers that take six slots stay correct.
export type PackedVoice =
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string];

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
  return packed.voices.map(([lang, family, name, gender, tier, styles, traitsJson]) => {
    let traits: VoiceTraits = {};
    if (traitsJson) {
      try {
        traits = JSON.parse(traitsJson) as VoiceTraits;
      } catch {
        traits = {};
      }
    }
    return {
      id: `${provider}:${lang}-${family}-${name}`,
      provider,
      lang,
      family,
      name,
      gender: GENDERS[gender] ?? "unknown",
      tier: tier === "u" ? "ultra" : "premium",
      styles: styles ? styles.split(",") : [],
      traits,
    };
  });
}
