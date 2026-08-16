// Language display names from BCP 47 codes, localized to any UI locale
// via Intl.DisplayNames in its "standard" form: "English (United States)",
// "French (Canada)", "Norwegian Bokmål (Norway)". The English display
// shortens a few long region names (see EN_SHORT_REGIONS); other locales
// keep their full localized CLDR region names. Hand maps cover the codes
// where CLDR misfires on our real catalog; anything new a provider ships
// renders through Intl with the raw code as last resort.
//
// The maps themselves live in lib/lang-data.mjs, each with the source that
// proves it, because scripts/check-langnames.mjs reads the same file under
// bare node: the fixture that guards these labels must never grade a copy
// of them.
//
// The owner ruled on 2026-08-16 that every label carries a bracket and
// that bracket text stays short. So every hand-written name is bracketed
// in all fourteen locales, and the fixture asserts that rule across the
// whole catalog. Note what it asserts and what it cannot: shape,
// uniqueness and the exact English labels, never the wording of a
// non-English hand translation, which passes as long as its brackets
// balance and it collides with nothing. That ruling supersedes the 2026-08-15 choices of a plain
// "Arabic" for ar-XA and a plain Javanese for jv-JV; both rounds are
// recorded in docs/decisions.md.

import { ARB_NAMES, EN_SHORT_REGIONS, JAVA_NAMES, MSA_NAMES, WLS_NAMES } from "./lang-data.mjs";

const cache = new Map<string, string>();
const displays = new Map<string, Intl.DisplayNames>();

function displayNames(locale: string): Intl.DisplayNames {
  let d = displays.get(locale);
  if (!d) {
    d = new Intl.DisplayNames([locale], { type: "language", languageDisplay: "standard" });
    displays.set(locale, d);
  }
  return d;
}

function rawName(code: string, displayLocale: string): string | undefined {
  if (code === "arb") return ARB_NAMES[displayLocale] ?? ARB_NAMES.en;
  // The Google twins: one register, one name, in every locale.
  if (code === "ar-001" || code === "ar-XA") return MSA_NAMES[displayLocale] ?? MSA_NAMES.en;
  if (code === "jv-JV") return JAVA_NAMES[displayLocale] ?? JAVA_NAMES.en;
  if (code === "en-GB-WLS") return WLS_NAMES[displayLocale] ?? WLS_NAMES.en;
  try {
    return displayNames(displayLocale).of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

export function languageName(code: string, displayLocale = "en"): string {
  const cacheKey = `${displayLocale}|${code}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  // A code neither Intl nor a hand map can render stays the raw code,
  // which is bracketless by construction, so the fixture flags it as
  // needing a hand map of its own.
  let name = rawName(code, displayLocale) ?? code;
  if (displayLocale === "en") {
    for (const [long, short] of EN_SHORT_REGIONS) {
      if (name.endsWith(long)) name = name.slice(0, -long.length) + short;
    }
  }
  cache.set(cacheKey, name);
  return name;
}

/** The localized name of a code's primary language alone: "English",
 * "inglés". For whole-language statements where a region would lie. */
export function baseLanguageName(code: string, displayLocale = "en"): string {
  const primary = code === "arb" ? "ar" : code.split("-")[0];
  return languageName(primary, displayLocale);
}
