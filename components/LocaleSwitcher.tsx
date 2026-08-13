"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/locales";

// Footer language select. Navigation keeps the current page including
// its query string and hash: /polly?family=Neural#voices in Spanish is
// /es/polly?family=Neural#voices. The selection is stored as the
// visitor's language choice, which the suggestion banner honors.
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
          const next = e.target.value as Locale;
          try {
            localStorage.setItem("ss-lang-choice", next);
            localStorage.setItem("ss-lang-dismissed", "1");
          } catch {}
          const href = pathname + window.location.search + window.location.hash;
          router.replace(href, { locale: next });
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
