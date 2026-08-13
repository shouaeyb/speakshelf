// The locale registry. Launch set per the owner: the world's most spoken
// languages minus right-to-left scripts, which wait for a dedicated RTL
// pass (docs/decisions.md). English is the default and lives unprefixed
// at the original URLs; every other locale is path-prefixed.

export const LOCALES = ["en", "es", "zh", "hi", "fr", "bn", "pt", "ru"] as const;
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
};
