// The provider bless config: the one place a provider becomes real.
//
// The AI TTS Microservice can start carrying a new provider at any time.
// The machinery (data, routing, playback, sitemaps) is generic, but a
// provider only goes live on this site once a human adds it here, writes
// honest copy for it in messages/*.json (namespaces providers.<key> and
// families.<key>, every locale), refreshes the packed data
// (scripts/build-data.mjs, keep its BLESSED list in step), regenerates
// public/og.png, and passes a real browser playback check. Unblessed
// providers appearing upstream are console-logged by lib/catalog.ts and
// stay invisible.
//
// Copy lives in the message files; this config keeps only identity and
// data semantics. Display names are protected terms and never translate.

import { LOCALES } from "@/i18n/locales";

export interface ProviderMeta {
  /** Provider key from the API, also the URL segment (/google). */
  key: string;
  /** Full display name. Protected: never translated. */
  label: string;
  /** Short name for tight spots (mobile masthead). Protected. */
  short: string;
  /** What counts as one voice, following the provider's own published
   *  voice list. "row" counts every catalog entry (google lists each
   *  language+family+name as its own voice; kokoro is flat). "langName"
   *  counts distinct language+name pairs (AWS's table lists a voice once
   *  per language with engines as capability columns, so Polly's
   *  per-engine rows are renders of one voice). Samples always count
   *  renders. Cross-language name reuse stays counted per language,
   *  because both providers' own tables do exactly that. */
  voiceIdentity: "row" | "langName";
}

export const PROVIDERS: ProviderMeta[] = [
  { key: "google", label: "Google Cloud", short: "Google", voiceIdentity: "row" },
  { key: "polly", label: "Amazon Polly", short: "Polly", voiceIdentity: "langName" },
  { key: "kokoro", label: "Kokoro", short: "Kokoro", voiceIdentity: "row" },
];

// A provider key that collides with a locale prefix would shadow a whole
// language tree. Blessing must never create that.
for (const p of PROVIDERS) {
  if ((LOCALES as readonly string[]).includes(p.key)) {
    throw new Error(`provider key "${p.key}" collides with a locale prefix`);
  }
}

export function getProvider(key: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

export function isBlessed(key: string): boolean {
  return PROVIDERS.some((p) => p.key === key);
}
