"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/locales";

// Footer language select. Navigation keeps the current page: /polly in
// Spanish is /es/polly. Choosing a language here also quiets the
// suggestion banner for good.
export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("footer");

  return (
    <label className="locale-switch">
      <span className="locale-switch-label">{t("languageLabel")}</span>
      <select
        className="locale-switch-select"
        value={locale}
        onChange={(e) => {
          try {
            localStorage.setItem("ss-lang-dismissed", "1");
          } catch {}
          router.replace(pathname, { locale: e.target.value as Locale });
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
