// Display metadata for voice model families, per provider. Order is the
// display order (largest catalog first). Family keys are only unique
// within a provider: google and polly both ship a "Standard".
//
// Blurbs follow the house copy rules: every qualitative claim traces to
// the provider's own documentation or to catalog data checked on the
// date the blurb was written; counts always come from live data in the
// page code, never from here.

export interface FamilyMeta {
  key: string;
  label: string;
  blurb: string;
  /** Optional honesty note about a family's known quirk, surfaced quietly
   *  in the explorer while that family is filtered or playing. */
  note?: string;
}

export const PROVIDER_FAMILIES: Record<string, FamilyMeta[]> = {
  google: [
    {
      key: "Gemini",
      label: "Gemini",
      blurb:
        "Native speech from Gemini. Each voice can be rendered by every sub-model, and delivery follows a written style prompt.",
      note:
        'Samples show each voice honestly, quirks included. Some Gemini voices can render a different accent than their locale label, an en-US voice sounding en-IN for instance. In your own generation prompt, a plain instruction like "say this in an American accent" usually corrects it.',
    },
    {
      key: "Chirp3HD",
      label: "Chirp 3: HD",
      blurb: "The current HD generation, tuned for natural conversation.",
    },
    {
      key: "Standard",
      label: "Standard",
      blurb: "Parametric voices with the widest language coverage at the lowest price.",
    },
    {
      key: "Wavenet",
      label: "WaveNet",
      blurb: "The DeepMind model that made neural speech mainstream.",
    },
    {
      key: "Neural2",
      label: "Neural2",
      blurb: "Second generation neural voices, the default for many products.",
    },
    {
      key: "ChirpHD",
      label: "Chirp HD",
      blurb: "The first Chirp generation, still widely deployed.",
    },
    {
      key: "News",
      label: "News",
      blurb: "Broadcast style voices tuned for reading the news.",
    },
    {
      key: "Studio",
      label: "Studio",
      blurb: "Narration grade voices for long form reading.",
    },
    {
      key: "Polyglot",
      label: "Polyglot",
      blurb: "One voice identity that speaks several languages.",
    },
    {
      key: "Casual",
      label: "Casual",
      blurb: "A conversational voice built for informal replies.",
    },
  ],
  polly: [
    {
      key: "Neural",
      label: "Neural",
      blurb: "Neural voices, the machine learning generation that lifted Polly's speech quality.",
    },
    {
      key: "Standard",
      label: "Standard",
      blurb: "The standard engine, Polly's baseline voices with wide language coverage.",
    },
    {
      key: "Generative",
      label: "Generative",
      blurb: "The newest Polly engine, built on generative AI for conversational speech.",
    },
    {
      key: "LongForm",
      label: "Long-Form",
      blurb: "Made for long listening: articles, training material and narration.",
    },
  ],
  kokoro: [
    {
      key: "Kokoro",
      label: "Kokoro",
      blurb: "Every Kokoro voice: one open-weight model, 82 million parameters, Apache 2.0.",
    },
  ],
};

export function familyLabel(provider: string, key: string): string {
  return PROVIDER_FAMILIES[provider]?.find((f) => f.key === key)?.label ?? key;
}

/** Display rank of each family within a provider; unknown families sort last. */
export function familyRank(provider: string): Map<string, number> {
  return new Map((PROVIDER_FAMILIES[provider] ?? []).map((f, i) => [f.key, i]));
}

// Sub-model lists come from the catalog data (available_models on each
// voice), so new sub-models appear without a code change. Only the labels
// live here: exact names for the sub-models known today, and a formatter
// that turns any future id into something presentable.
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
