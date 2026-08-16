// Language display names from BCP 47 codes, localized to any UI locale
// via Intl.DisplayNames in its "standard" form: "English (United States)",
// "French (Canada)", "Norwegian Bokmål (Norway)". The English display
// shortens a few long region names (see EN_SHORT_REGIONS); other locales
// keep their full localized CLDR region names. Hand maps cover the codes
// where CLDR misfires on our real catalog, and each one says which
// provider code it answers and which source proves it; anything new a
// provider ships renders through Intl with the raw code as last resort.
//
// The owner ruled on 2026-08-16 that every label carries a bracket and
// that bracket text stays short. So every hand-written name below is
// bracketed in all fourteen locales, and scripts/check-langnames.mjs
// asserts the rule across the whole catalog. That ruling supersedes the
// 2026-08-15 choices of a plain "Arabic" for ar-XA and a plain Javanese
// for jv-JV; both rounds are recorded in docs/decisions.md.

// Polly's en-GB-WLS region code makes Intl.DisplayNames throw, in every
// locale, so it is hand-localized like the other exceptions below. There
// is deliberately no English fallback layer: a code Intl cannot render
// gets its own hand map, so an English string can never leak into the
// other thirteen locales (an earlier English-only fallback did exactly
// that for this code, caught in review 2026-08-16).
const WLS_NAMES: Record<string, string> = {
  en: "English (Wales)",
  es: "inglés (Gales)",
  fr: "anglais (pays de Galles)",
  pt: "inglês (País de Gales)",
  ru: "английский (Уэльс)",
  zh: "英语（威尔士）",
  hi: "अंग्रेज़ी (वेल्स)",
  bn: "ইংরেজি (ওয়েলস)",
  ar: "الإنجليزية (ويلز)",
  ja: "英語 (ウェールズ)",
  de: "Englisch (Wales)",
  it: "inglese (Galles)",
  id: "Inggris (Wales)",
  sw: "Kiingereza (Wales)",
};

// Polly's arb (Standard Arabic) collapses to the bare Arabic name in this
// runtime's CLDR in every locale, colliding with Google's Arabics; the
// fixture (scripts/check-langnames.mjs) guards this. Localized by hand
// instead, and kept distinct from the Google twins below because the
// umbrella home page quotes it by name as a Polly-versus-Google variant.
// Arabic itself uses the language's own word for its standard register,
// bracketed like every other label.
const ARB_NAMES: Record<string, string> = {
  en: "Arabic (Standard)",
  es: "árabe (estándar)",
  fr: "arabe (standard)",
  pt: "árabe (padrão)",
  ru: "арабский (стандартный)",
  zh: "阿拉伯语（标准）",
  hi: "अरबी (मानक)",
  bn: "আরবি (প্রমিত)",
  ar: "العربية (الفصحى)",
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
// reader picking a voice. CLDR's ar-XA is worse still, a "Pseudo-Accents"
// label for what Google runs as its pan-Arabic register.
// https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
// One register, so one name: the owner ruled on 2026-08-16 that both
// codes read the same, with the codes themselves doing the disambiguation
// wherever the two meet (the mono code chip on group heads and language
// pages, the dropdown suffix in the Explorer, the twin page titles). The
// fixture asserts the twins equal in every locale, and distinct from arb
// and from ar-EG, so the shelf never shows two identical rows with no way
// to tell them apart.
const MSA_NAMES: Record<string, string> = {
  en: "Arabic (Modern Standard)",
  es: "árabe (estándar moderno)",
  fr: "arabe (standard moderne)",
  pt: "árabe (padrão moderno)",
  ru: "арабский (современный стандартный)",
  zh: "阿拉伯语（现代标准）",
  hi: "अरबी (आधुनिक मानक)",
  bn: "আরবি (আধুনিক প্রমিত)",
  ar: "العربية (الفصحى الحديثة)",
  ja: "アラビア語 (現代標準)",
  de: "Arabisch (Modernes Hocharabisch)",
  it: "arabo (standard moderno)",
  id: "Arab (Standar Modern)",
  sw: "Kiarabu (Sanifu cha Kisasa)",
};

// Google's jv-JV is its own code for Javanese, not a CLDR region: the
// Gemini-TTS table row reads "Javanese (Java) | jv-JV", while CLDR prints
// the unknown region verbatim as "Javanese (JV)".
// https://docs.cloud.google.com/text-to-speech/docs/gemini-tts
// The owner adopted Google's "(Java)" on 2026-08-16, so the island rides
// in the bracket, hand-localized like the Arabics above because the
// island has its own name in every locale. Indonesian reads "Jawa (Jawa)"
// for the same reason CLDR itself reads "Indonesia (Indonesia)" there:
// the language and its place share one word.
const JAVA_NAMES: Record<string, string> = {
  en: "Javanese (Java)",
  es: "javanés (Java)",
  fr: "javanais (Java)",
  pt: "javanês (Java)",
  ru: "яванский (Ява)",
  zh: "爪哇语（爪哇）",
  hi: "जावानीज़ (जावा)",
  bn: "জাভানিজ (জাভা)",
  ar: "الجاوية (جاوة)",
  ja: "ジャワ語 (ジャワ)",
  de: "Javanisch (Java)",
  it: "giavanese (Giava)",
  id: "Jawa (Jawa)",
  sw: "Kijava (Java)",
};

// English keeps the two mega-regions short, plus three CLDR region names
// that are correct and unreadable in a voice row: "(Hong Kong SAR China)",
// "(Myanmar [Burma])" and "(United Arab Emirates)". Short bracket text is
// the owner's 2026-08-16 rule; the fixture caps English bracket contents
// so a future CLDR long form cannot slip back in. Other locales keep
// their full CLDR names.
const EN_SHORT_REGIONS: Array<[string, string]> = [
  ["(United States)", "(US)"],
  ["(United Kingdom)", "(GB)"],
  ["(Hong Kong SAR China)", "(Hong Kong)"],
  ["(Myanmar [Burma])", "(Myanmar)"],
  ["(United Arab Emirates)", "(UAE)"],
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
