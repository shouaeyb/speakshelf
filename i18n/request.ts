import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

// The locale comes from the [locale] root param (next/root-params), the
// non-deprecated path that also keeps pages statically renderable. This
// module must never be imported by the proxy: navigation helpers live in
// i18n/navigation.ts for exactly that reason.
export default getRequestConfig(async () => {
  const requested = await rootLocale();
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
