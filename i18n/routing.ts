import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

// as-needed: English stays byte-for-byte at the original unprefixed URLs
// (an invariant since the /google migration); other locales get a path
// prefix. /en variants explicitly redirect to the clean path in
// next.config. This file must stay importable by the proxy, so it keeps
// no navigation helpers (see i18n/navigation.ts) and pulls nothing that
// would drag the request config into the middleware bundle.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  // The suggestion banner owns language switching; the proxy must never
  // redirect by Accept-Language or cookie (crawler safety, decisions).
  localeDetection: false,
});
