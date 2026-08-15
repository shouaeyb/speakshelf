// Language display names from BCP 47 codes, localized to any UI locale
// via Intl.DisplayNames in its "standard" form: "English (United States)",
// "French (Canada)", "Norwegian Bokmål (Norway)". The English display
// shortens a few long region names (see EN_SHORT_REGIONS); other locales
// keep their full localized CLDR region names. Special cases exist only
// where CLDR misfires on our real catalog codes, and each one says which
// provider code it answers and which source proves it; anything new a
// provider ships renders through Intl with the raw code as last resort.

// English-only fixes, and only for codes Intl cannot render at all: this
// map is the last resort in languageName below, never a precedence layer,
// so an English string can never leak into the other thirteen locales.
// ar-XA is Google's pan-Arabic pseudo-region (CLDR says "Pseudo-Accents");
// it renders as the localized base Arabic name through the rawName path
// below, so this entry is the en fallback only.
const OVERRIDES: Record<string, string> = {
  "ar-XA": "Arabic",
  // Polly's Welsh English region code makes Intl.DisplayNames throw.
  "en-GB-WLS": "English (Wales)",
};

// Polly's arb (Standard Arabic) collapses to the bare Arabic name in this
// runtime's CLDR in every locale, colliding with ar-XA; the fixture
// (scripts/check-langnames.mjs) guards this. Localized by hand instead;
// Arabic itself uses the language's own name for its standard register.
const ARB_NAMES: Record<string, string> = {
  en: "Arabic (Standard)",
  es: "árabe (estándar)",
  fr: "arabe (standard)",
  pt: "árabe (padrão)",
  ru: "арабский (стандартный)",
  zh: "阿拉伯语（标准）",
  hi: "अरबी (मानक)",
  bn: "আরবি (প্রমিত)",
  ar: "العربية الفصحى",
  ja: "アラビア語 (標準)",
  de: "Arabisch (Standard)",
  it: "arabo (standard)",
  id: "Arab (Standar)",
  sw: "Kiarabu (Sanifu)",
};

// Google's ar-001 is the same register as its ar-XA. Google's voices doc
// says so in as many words: "ar-XA is Modern Standard Arabic (usually
// denoted as ar-001)."
// https://docs.cloud.google.com/text-to-speech/docs/voices
// Its Gemini-TTS table then lists the code as "Arabic (World) | ar-001",
// which CLDR renders "Arabic (world)": true to the subtag, useless to a
// reader picking a voice.
// https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
// So ar-001 carries the register in its name instead, hand-localized like
// arb below. Three Arabics ship side by side and every locale must keep
// them apart: ar-XA plain Arabic (Google's own table label for those
// rows), ar-001 Modern Standard, arb Standard. The fixture
// (scripts/check-langnames.mjs) asserts that pairwise, in all fourteen.
const MSA_NAMES: Record<string, string> = {
  en: "Arabic (Modern Standard)",
  es: "árabe (estándar moderno)",
  fr: "arabe (standard moderne)",
  pt: "árabe (padrão moderno)",
  ru: "арабский (современный стандартный)",
  zh: "阿拉伯语（现代标准）",
  hi: "अरबी (आधुनिक मानक)",
  bn: "আরবি (আধুনিক প্রমিত)",
  ar: "العربية الفصحى الحديثة",
  ja: "アラビア語 (現代標準)",
  de: "Arabisch (Modernes Hocharabisch)",
  it: "arabo (standard moderno)",
  id: "Arab (Standar Modern)",
  sw: "Kiarabu (Sanifu cha Kisasa)",
};

// English keeps the two mega-regions short, plus two CLDR region names
// that are correct and unreadable in a voice row: "(Hong Kong SAR China)"
// and "(Myanmar [Burma])". Other locales keep their full CLDR names.
const EN_SHORT_REGIONS: Array<[string, string]> = [
  ["(United States)", "(US)"],
  ["(United Kingdom)", "(GB)"],
  ["(Hong Kong SAR China)", "(Hong Kong)"],
  ["(Myanmar [Burma])", "(Myanmar)"],
];

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
  if (code === "ar-001") return MSA_NAMES[displayLocale] ?? MSA_NAMES.en;
  try {
    // ar-XA renders as the localized base Arabic name instead of CLDR's
    // pseudo-region label.
    if (code === "ar-XA") return displayNames(displayLocale).of("ar") ?? undefined;
    // jv-JV is Google's own code for Javanese, not a CLDR region: its
    // Gemini-TTS table row reads "Javanese (Java) | jv-JV". CLDR renders
    // the unknown region verbatim, "Javanese (JV)", so the base language
    // is rendered instead, localized in every locale for free. Google's
    // own "(Java)" bracket was read and deliberately not adopted: it
    // names the island, the owner never approved it, and it would need
    // fourteen hand translations to say what the plain name already says.
    // https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
    if (code === "jv-JV") return displayNames(displayLocale).of("jv") ?? undefined;
    return displayNames(displayLocale).of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

export function languageName(code: string, displayLocale = "en"): string {
  const cacheKey = `${displayLocale}|${code}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  let name = rawName(code, displayLocale);
  // A code Intl cannot render in this locale still gets its English fix.
  if (!name || name === code) {
    name = OVERRIDES[code] ?? name ?? code;
  }
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
