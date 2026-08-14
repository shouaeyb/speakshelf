// Language display names from BCP 47 codes, localized to any UI locale
// via Intl.DisplayNames in its "standard" form: "English (United States)",
// "French (Canada)", "Norwegian Bokmål (Norway)". The English display
// shortens the two mega-regions to the owner's chosen "(US)" and "(GB)";
// other locales keep their full localized CLDR region names. Overrides
// exist only where CLDR misfires on our real catalog codes; anything new
// a provider ships renders through Intl with the raw code as last resort.

// English-only fixes. ar-XA is Google's pan-Arabic pseudo-region (CLDR
// says "Pseudo-Accents"); it renders as the localized base Arabic name
// through the rawName path below, so this entry is the en fallback only.
const OVERRIDES: Record<string, string> = {
  "ar-XA": "Arabic",
  // Polly's Welsh English region code makes Intl.DisplayNames throw.
  "en-GB-WLS": "English (Wales)",
  "jv-JV": "Javanese",
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

const EN_SHORT_REGIONS: Array<[string, string]> = [
  ["(United States)", "(US)"],
  ["(United Kingdom)", "(GB)"],
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
  try {
    // ar-XA renders as the localized base Arabic name instead of CLDR's
    // pseudo-region label.
    if (code === "ar-XA") return displayNames(displayLocale).of("ar") ?? undefined;
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
