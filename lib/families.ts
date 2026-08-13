// Display metadata for the ten Google voice model families.
// Order is fixed: largest catalog first.

export interface FamilyMeta {
  key: string;
  label: string;
  blurb: string;
}

export const FAMILIES: FamilyMeta[] = [
  {
    key: "Gemini",
    label: "Gemini",
    blurb: "Native speech from Gemini. Each voice can be rendered by every sub-model, and delivery follows a written style prompt.",
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
];

export function familyLabel(key: string): string {
  return FAMILIES.find((f) => f.key === key)?.label ?? key;
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
