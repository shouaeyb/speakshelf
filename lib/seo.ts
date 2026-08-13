// Canonical + hreflang alternates for one page path across every locale.
// English is unprefixed (the frozen original URLs); x-default points at
// English. Every locale page emits the complete reciprocal set.

import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function localeUrl(path: string, locale: string): string {
  const clean = path === "/" ? "" : path;
  return locale === DEFAULT_LOCALE ? `${SITE_URL}${clean || "/"}` : `${SITE_URL}/${locale}${clean}`;
}

export function localeAlternates(path: string, locale: string) {
  return {
    canonical: localeUrl(path, locale),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, localeUrl(path, l)])),
      "x-default": localeUrl(path, DEFAULT_LOCALE),
    },
  };
}
