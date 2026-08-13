"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { INVITES, LOCALES, type Locale } from "@/i18n/locales";

// The owner's decision (docs/decisions.md): browser language never hard
// redirects. This quiet strip offers a one-tap switch in the visitor's
// own language, remembers any answer forever, and stays out of the way
// of crawlers, which simply see the page they asked for.
export default function LanguageSuggest() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [target, setTarget] = useState<Locale | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("ss-lang-dismissed")) return;
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

  const remember = () => {
    try {
      localStorage.setItem("ss-lang-dismissed", "1");
    } catch {}
  };

  return (
    <div className="lang-suggest" role="region" aria-label={INVITES[target].invite}>
      <div className="shell lang-suggest-in">
        <span className="lang-suggest-text">{INVITES[target].invite}</span>
        <button
          type="button"
          className="lang-suggest-cta"
          onClick={() => {
            remember();
            router.replace(pathname, { locale: target });
          }}
        >
          {INVITES[target].cta}
        </button>
        <button
          type="button"
          className="lang-suggest-close"
          aria-label={INVITES[locale as Locale]?.invite ?? "Dismiss"}
          onClick={() => {
            remember();
            setTarget(null);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
