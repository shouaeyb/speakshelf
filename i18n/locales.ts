// The locale registry, per the owner's picks. English is the default and
// lives unprefixed at the original URLs; every other locale is
// path-prefixed. Arabic is right-to-left: RTL_LOCALES drives the html dir
// attribute, and the stylesheet speaks logical properties where direction
// matters (docs/decisions.md).

export const LOCALES = [
  "en", "es", "zh", "hi", "fr", "bn", "pt", "ru",
  "id", "ar", "sw", "ja", "de", "it",
] as const;

export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar"]);
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Native-language names for the switcher and the suggestion banner. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  hi: "हिन्दी",
  fr: "Français",
  bn: "বাংলা",
  pt: "Português",
  ru: "Русский",
  id: "Bahasa Indonesia",
  ar: "العربية",
  sw: "Kiswahili",
  ja: "日本語",
  de: "Deutsch",
  it: "Italiano",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Locale-correct "A, B and C" without translating conjunctions. */
export function listNames(names: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** Bare "A, B, C" for lists the message finishes itself ("{names} and
 * more"). Not Intl.ListFormat: its unit type concatenates zh names with no
 * separator at all, and conjunction styles keep es "y"/hi "और" before the
 * last name, doubling the message's own closing conjunction. zh takes its
 * enumeration comma; extend here if a future locale needs another mark. */
export function listNamesPlain(names: string[], locale: string): string {
  return names.join(locale === "zh" ? "、" : ", ");
}

/** Suggestion-banner strings, written in the TARGET language on purpose:
 *  the invitation must be readable by the person it invites, and the
 *  active locale's messages cannot carry another locale's words. */
export const INVITES: Record<Locale, { invite: string; cta: string }> = {
  en: { invite: "Read Speakshelf in English?", cta: "Switch" },
  es: { invite: "¿Ver Speakshelf en español?", cta: "Cambiar" },
  zh: { invite: "用中文浏览 Speakshelf？", cta: "切换" },
  hi: { invite: "Speakshelf हिन्दी में देखें?", cta: "बदलें" },
  fr: { invite: "Voir Speakshelf en français ?", cta: "Changer" },
  bn: { invite: "Speakshelf বাংলায় দেখবেন?", cta: "পরিবর্তন করুন" },
  pt: { invite: "Ver o Speakshelf em português?", cta: "Mudar" },
  ru: { invite: "Смотреть Speakshelf на русском?", cta: "Переключить" },
  id: { invite: "Baca Speakshelf dalam bahasa Indonesia?", cta: "Ganti" },
  ar: { invite: "قراءة Speakshelf بالعربية؟", cta: "التبديل" },
  sw: { invite: "Soma Speakshelf kwa Kiswahili?", cta: "Badilisha" },
  ja: { invite: "Speakshelf を日本語で読みますか？", cta: "切り替える" },
  de: { invite: "Speakshelf auf Deutsch lesen?", cta: "Wechseln" },
  it: { invite: "Leggere Speakshelf in italiano?", cta: "Cambia" },
};
