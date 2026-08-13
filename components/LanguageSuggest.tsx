"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { INVITES, LOCALES, type Locale } from "@/i18n/locales";

// The owner's decision (docs/decisions.md): browser language never hard
// redirects. This quiet strip offers a one-tap switch in the visitor's
// own language. The stored value is the CHOICE, not a dismissal: someone
// who picked Spanish and later lands on an English page is offered
// Spanish again instead of being stranded; someone who dismissed is
// treated as having chosen the page they were on.
export default function LanguageSuggest() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("suggest");
  const [target, setTarget] = useState<Locale | null>(null);

  useEffect(() => {
    try {
      const chosen = localStorage.getItem("ss-lang-choice");
      if (chosen && (LOCALES as readonly string[]).includes(chosen)) {
        if (chosen !== locale) setTarget(chosen as Locale);
        return;
      }
      const preferred = navigator.languages ?? [navigator.language];
      for (const pref of preferred) {
        const primary = pref.toLowerCase().split("-")[0];
        const match = LOCALES.find((l) => l === primary);
        if (match) {
          if (match !== locale) setTarget(match);
          return; // first supported preference decides, matching or not
        }
      }
    } catch {}
  }, [locale]);

  if (!target) return null;

  const remember = (choice: Locale) => {
    try {
      localStorage.setItem("ss-lang-choice", choice);
      localStorage.setItem("ss-lang-dismissed", "1");
    } catch {}
  };

  // Filters live in the query string and #voices in the hash: a language
  // switch must not throw either away.
  const currentHref = () =>
    typeof window !== "undefined" ? pathname + window.location.search + window.location.hash : pathname;

  return (
    <div className="lang-suggest" role="region" aria-label={INVITES[target].invite}>
      <div className="shell lang-suggest-in">
        <span className="lang-suggest-text">{INVITES[target].invite}</span>
        <button
          type="button"
          className="lang-suggest-cta"
          onClick={() => {
            remember(target);
            // Same page in another language: keep the reader's place.
            router.replace(currentHref(), { locale: target, scroll: false });
            setTarget(null);
          }}
        >
          {INVITES[target].cta}
        </button>
        <button
          type="button"
          className="lang-suggest-close"
          aria-label={t("dismissAria")}
          onClick={() => {
            remember(locale as Locale);
            setTarget(null);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
