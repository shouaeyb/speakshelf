// The hand-written language labels, and the English region shortenings, as
// data. Two consumers read this file and neither may hold a copy: lib/lang.ts
// renders the site from it, and scripts/check-langnames.mjs asserts it against
// the real catalog under bare node, which is why the data lives in plain
// JavaScript instead of the library's TypeScript. The fixture used to keep its
// own transcription of every map, so a label could be fixed in one place and
// pass the guard from the other; that copy is gone.
//
// Each map answers specific provider codes and says which source proves it.
// The owner ruled on 2026-08-16 that every label carries a bracket and that
// bracket text stays short, so every name here is bracketed in all fourteen
// locales.

// Polly's en-GB-WLS region code makes Intl.DisplayNames throw, in every
// locale, so it is hand-localized like the other exceptions below. There
// is deliberately no English fallback layer: a code Intl cannot render
// gets its own hand map, so an English string can never leak into the
// other thirteen locales (an earlier English-only fallback did exactly
// that for this code, caught in review 2026-08-16).
/** @type {Record<string, string>} */
export const WLS_NAMES = {
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
/** @type {Record<string, string>} */
export const ARB_NAMES = {
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
// Russian names the register the Russian way, "современный литературный"
// (modern literary), the established term for MSA in Russian Arabic
// studies; a word-for-word "стандартный" reads as a calque (round-5
// translation review, 2026-08-16). Hindi and Bengali likewise use their
// native language names for Javanese below, जावानी and জাভানি, not the
// English-derived transliterations.
// One register, so one name: the owner ruled on 2026-08-16 that both
// codes read the same, with the codes themselves doing the disambiguation
// wherever the two meet (the mono code chip on group heads and language
// pages, the dropdown suffix in the Explorer, the twin page titles). The
// fixture asserts the twins equal in every locale, and distinct from arb
// and from ar-EG, so the shelf never shows two identical rows with no way
// to tell them apart.
/** @type {Record<string, string>} */
export const MSA_NAMES = {
  en: "Arabic (Modern Standard)",
  es: "árabe (estándar moderno)",
  fr: "arabe (standard moderne)",
  pt: "árabe (padrão moderno)",
  ru: "арабский (современный литературный)",
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
/** @type {Record<string, string>} */
export const JAVA_NAMES = {
  en: "Javanese (Java)",
  es: "javanés (Java)",
  fr: "javanais (Java)",
  pt: "javanês (Java)",
  ru: "яванский (Ява)",
  zh: "爪哇语（爪哇）",
  hi: "जावानी (जावा)",
  bn: "জাভানি (জাভা)",
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
/** @type {Array<[string, string]>} */
export const EN_SHORT_REGIONS = [
  ["(United States)", "(US)"],
  ["(United Kingdom)", "(GB)"],
  ["(Hong Kong SAR China)", "(Hong Kong)"],
  ["(Myanmar [Burma])", "(Myanmar)"],
  ["(United Arab Emirates)", "(UAE)"],
];
