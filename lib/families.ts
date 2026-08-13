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
    blurb: "Native speech from the Gemini models. Delivery follows a written style prompt.",
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
