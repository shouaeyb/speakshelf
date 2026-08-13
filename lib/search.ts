// Client-side voice search. One document per voice: every current field
// is enumerated here, and the TRAITS map is folded in generically, so a
// new trait is searchable with no edit; a brand-new top-level Voice
// field would still need adding below. Queries tokenize and AND together.
// Plain tokens match at word starts ("fem" finds female, "male" does not
// match female); tokens carrying separators (":", "-") match as
// substrings of the whole document, so a full or partial voice id still
// resolves. Diacritics are stripped on both sides ("penelope" finds
// Penélope). No API and no dependency: fuzzy matching is deliberately
// deferred until search_used analytics show real zero-result typos (see
// docs/decisions.md).
//
// When locales land, the document must also carry the localized language
// name next to the English one, and rebuild on locale change.

import type { Voice } from "./data";
import { familyLabel } from "./families";
import { languageName } from "./lang";
import { getProvider } from "./providers";

export interface SearchDoc {
  /** Normalized words, for prefix-at-word-start matching. */
  words: string[];
  /** The whole normalized document, for separator-token substrings. */
  text: string;
}

export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(text: string): string {
  return stripDiacritics(text).toLowerCase();
}

/** Everything searchable about one voice. The language name goes in
 *  twice when a locale is active: localized (what the reader sees) and
 *  English (what they may still type). extraTerms lets the caller add
 *  localized words the lib cannot know (translated gender, tier and
 *  trait labels from the message files), so a Spanish reader typing
 *  "femenino" matches exactly like an English reader typing "female". */
export function buildSearchDoc(
  voice: Voice,
  provider: string,
  locale = "en",
  extraTerms: string[] = [],
): SearchDoc {
  const meta = getProvider(provider);
  const parts: string[] = [
    voice.id,
    voice.name,
    voice.family,
    familyLabel(provider, voice.family),
    voice.lang,
    languageName(voice.lang, locale),
    ...(locale !== "en" ? [languageName(voice.lang, "en")] : []),
    voice.gender,
    voice.tier,
    provider,
    meta?.label ?? "",
    ...voice.styles,
  ];
  for (const [key, value] of Object.entries(voice.traits)) {
    if (Array.isArray(value)) {
      parts.push(...value);
    } else if (value) {
      // Value and key both: "child" finds it, and so does "age".
      parts.push(String(value), key);
    }
  }
  parts.push(...extraTerms);
  const text = normalize(parts.join(" "));
  return { text, words: text.split(/\s+/).filter(Boolean) };
}

export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/** Every token must match: word-start for plain tokens, substring of the
 *  whole document for separator-carrying tokens (ids, "long-form"). */
export function matchesTokens(doc: SearchDoc, tokens: string[]): boolean {
  return tokens.every((token) =>
    /[:\-._]/.test(token)
      ? doc.text.includes(token)
      : doc.words.some((word) => word.startsWith(token)),
  );
}
