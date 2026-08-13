// Client-side voice search. One document per voice, built automatically
// from every field and trait, so a characteristic added tomorrow is
// searchable today with no edit here. Queries tokenize and AND together.
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

/** Everything searchable about one voice. */
export function buildSearchDoc(voice: Voice, provider: string): SearchDoc {
  const meta = getProvider(provider);
  const parts: string[] = [
    voice.id,
    voice.name,
    voice.family,
    familyLabel(provider, voice.family),
    voice.lang,
    languageName(voice.lang),
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
