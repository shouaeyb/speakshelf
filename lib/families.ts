// Family identity per provider: keys, protected display labels, display
// order, and which families carry an honesty note. All prose (blurbs,
// notes) lives in messages/*.json under families.<provider>.<key>, one
// entry per locale. Family keys are only unique within a provider:
// google and polly both ship a "Standard".

export interface FamilyMeta {
  key: string;
  /** Product name. Protected: never translated. */
  label: string;
  /** True when messages carry families.<provider>.<key>.note. */
  hasNote?: boolean;
}

export const PROVIDER_FAMILIES: Record<string, FamilyMeta[]> = {
  google: [
    { key: "Gemini", label: "Gemini", hasNote: true },
    { key: "Chirp3HD", label: "Chirp 3: HD" },
    { key: "Standard", label: "Standard" },
    { key: "Wavenet", label: "WaveNet" },
    { key: "Neural2", label: "Neural2" },
    { key: "ChirpHD", label: "Chirp HD" },
    { key: "News", label: "News" },
    { key: "Studio", label: "Studio" },
    { key: "Polyglot", label: "Polyglot" },
    { key: "Casual", label: "Casual" },
  ],
  polly: [
    { key: "Neural", label: "Neural" },
    { key: "Standard", label: "Standard" },
    { key: "Generative", label: "Generative" },
    { key: "LongForm", label: "Long-Form" },
  ],
  kokoro: [{ key: "Kokoro", label: "Kokoro" }],
};

export function familyLabel(provider: string, key: string): string {
  return PROVIDER_FAMILIES[provider]?.find((f) => f.key === key)?.label ?? key;
}

export function familyMeta(provider: string, key: string): FamilyMeta | undefined {
  return PROVIDER_FAMILIES[provider]?.find((f) => f.key === key);
}

/** Display rank of each family within a provider; unknown families sort last. */
export function familyRank(provider: string): Map<string, number> {
  return new Map((PROVIDER_FAMILIES[provider] ?? []).map((f, i) => [f.key, i]));
}

// Sub-model lists come from the catalog data (available_models on each
// voice), so new sub-models appear without a code change. Only the labels
// live here: exact names for the sub-models known today, and a formatter
// that turns any future id into something presentable. Model names are
// product terms and never translate.
const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash-tts": "2.5 Flash",
  "gemini-2.5-pro-tts": "2.5 Pro",
  "gemini-2.5-flash-lite-preview-tts": "2.5 Flash-Lite",
  "gemini-3.1-flash-tts-preview": "3.1 Flash preview",
};

export function modelLabel(id: string): string {
  const known = MODEL_LABELS[id];
  if (known) return known;
  // e.g. "gemini-3.2-flash-tts-preview" turns into "3.2 Flash preview"
  return id
    .replace(/^gemini-/, "")
    .split("-")
    .filter((part) => part !== "tts")
    .map((part) => (part === "preview" || /\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
