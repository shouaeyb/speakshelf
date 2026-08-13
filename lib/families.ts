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
    blurb: "Native speech from Gemini. Four sub-models share every voice, and delivery follows a written style prompt.",
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

// Every Gemini voice can render its sample with any of these sub-models.
// The API defaults to 2.5 Flash when no model is passed, so the first
// entry doubles as the default. Other families have a single model.
export interface GeminiModel {
  id: string;
  label: string;
}

export const GEMINI_MODELS: GeminiModel[] = [
  { id: "gemini-2.5-flash-tts", label: "2.5 Flash" },
  { id: "gemini-2.5-pro-tts", label: "2.5 Pro" },
  { id: "gemini-2.5-flash-lite-preview-tts", label: "2.5 Flash-Lite" },
  { id: "gemini-3.1-flash-tts-preview", label: "3.1 Flash preview" },
];
