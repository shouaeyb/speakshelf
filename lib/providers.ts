// The provider bless config: the one place a provider becomes real.
//
// The AI TTS Microservice can start carrying a new provider at any time.
// The machinery (data, routing, playback, sitemaps) is generic, but a
// provider only goes live on this site once a human adds it here, writes
// honest copy for it, refreshes the packed data (scripts/build-data.mjs,
// keep its BLESSED list in step) and passes a real browser playback check.
// Unblessed providers appearing upstream are console-logged by
// lib/catalog.ts and stay invisible.

export interface ProviderMeta {
  /** Provider key from the API, also the URL segment (/google). */
  key: string;
  /** Full display name. */
  label: string;
  /** Short name for tight spots (mobile masthead). */
  short: string;
  /** Mono eyebrow over the provider hero. */
  eyebrow: string;
  /** Hero heading. */
  heroTitle: string;
  /** Hero paragraph. Mentions the filter set in the provider's own words. */
  heroSub: string;
  /** What this provider calls its voice groupings. */
  familyWord: { one: string; many: string; jump: string };
  /** What counts as one voice, following the provider's own published
   *  voice list. "row" counts every catalog entry (google lists each
   *  language+family+name as its own voice; kokoro is flat). "langName"
   *  counts distinct language+name pairs (AWS's table lists a voice once
   *  per language with engines as capability columns, so Polly's
   *  per-engine rows are renders of one voice). Samples always count
   *  renders. Cross-language name reuse stays counted per language,
   *  because both providers' own tables do exactly that. */
  voiceIdentity: "row" | "langName";
  /** Line under the families section title. */
  familiesIntro: string;
  /** Umbrella card paragraph. */
  cardBlurb: string;
  /** Provider-specific first paragraph of the About section, built from
   *  live counts so prose cannot go stale. The shared attribution
   *  paragraph lives in the page template. */
  about: (c: AboutFacts) => string;
  /** Blurb given to a family tile the metadata has never heard of. */
  unknownFamilyBlurb: string;
}

/** The slice of a provider catalog the about copy may lean on. */
export interface AboutFacts {
  stats: { voices: number; languages: number; families: number; samples: number };
  models: Record<string, string[]>;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    key: "google",
    label: "Google Cloud",
    short: "Google",
    voiceIdentity: "row" as const,
    eyebrow: "GOOGLE CLOUD TEXT TO SPEECH",
    heroTitle: "Every Google voice, on one page.",
    heroSub:
      "Play a sample of every voice in the Google Cloud catalog. Filter by model family, language and gender. No account, no setup, just the voices.",
    familyWord: { one: "model family", many: "model families", jump: "MODELS" },
    familiesIntro:
      "Google keeps shipping new speech architectures and every generation is still in service. The catalog runs from compact parametric voices to models you can direct with a sentence.",
    cardBlurb:
      "The deepest shelf here: model families from Standard and WaveNet to Chirp 3 and Gemini voices that follow a written style prompt.",
    about: (c) =>
      `Google Cloud runs one of the largest text to speech catalogs of any cloud provider. It spans ${c.stats.families} model families, from the WaveNet voices that made neural speech mainstream to Gemini voices that change their delivery when you describe the tone you want. Gemini is really ${c.models.Gemini?.length ?? "several"} models in one: every Gemini voice can be rendered by any of its sub-models, and each render has its own sample here. Every other voice in the catalog has a sample too.`,
    unknownFamilyBlurb: "A recent addition to the Google catalog.",
  },
  {
    key: "polly",
    label: "Amazon Polly",
    short: "Polly",
    voiceIdentity: "langName" as const,
    eyebrow: "AMAZON POLLY TEXT TO SPEECH",
    heroTitle: "Every Amazon Polly voice, on one page.",
    heroSub:
      "Play a sample of every voice in the Amazon Polly catalog. Filter by engine, language and gender. No account, no setup, just the voices.",
    familyWord: { one: "engine", many: "engines", jump: "ENGINES" },
    familiesIntro:
      "Polly groups its voices by engine. The catalog runs from the standard voices to the generative engine, with a long-form tier built for extended listening.",
    cardBlurb:
      "AWS's text to speech service: standard, neural, generative and long-form engines.",
    about: (c) =>
      `Amazon Polly is the text to speech service on AWS, converting text into lifelike speech. Its ${c.stats.voices} voices here span ${c.stats.families} engines: standard and neural, a generative engine built with generative AI techniques, and long-form voices designed for longer content like articles and training material. Every voice has a playable sample.`,
    unknownFamilyBlurb: "A recent addition to the Amazon Polly catalog.",
  },
  {
    key: "kokoro",
    label: "Kokoro",
    short: "Kokoro",
    voiceIdentity: "row" as const,
    eyebrow: "KOKORO TEXT TO SPEECH",
    heroTitle: "Every Kokoro voice, on one page.",
    heroSub:
      "Play a sample of every voice of the open-weight Kokoro model. Filter by language and gender. No account, no setup, just the voices.",
    familyWord: { one: "model family", many: "model families", jump: "MODEL" },
    familiesIntro:
      "Kokoro is a single model rather than a stable of engines, so its whole catalog sits in one family.",
    cardBlurb:
      "An open-weight model, 82 million parameters under the Apache 2.0 license.",
    about: (c) =>
      `Kokoro is an open-weight text to speech model: 82 million parameters, released under the Apache 2.0 license. The AI TTS Microservice serves it alongside the cloud catalogs, so its ${c.stats.voices} voices in ${c.stats.languages} languages play here like any other shelf. Every voice has a playable sample.`,
    unknownFamilyBlurb: "A recent addition to the Kokoro catalog.",
  },
];

export function getProvider(key: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

export function isBlessed(key: string): boolean {
  return PROVIDERS.some((p) => p.key === key);
}
