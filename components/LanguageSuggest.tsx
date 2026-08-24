"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { INVITES, LOCALES, type Locale, RTL_LOCALES } from "@/i18n/locales";

/** The locale worth offering on this page, or null for silence. Reads
 *  localStorage and navigator, so it may only run on the client, after
 *  hydration: see the effect below. The order is the settled one and does
 *  not change. A stored choice decides, and is offered again when it
 *  differs from the page. Otherwise the first SUPPORTED browser preference
 *  ends the scan, whether or not it matches the page. */
function pickTarget(locale: string): Locale | null {
  try {
    const chosen = localStorage.getItem("ss-lang-choice");
    if (chosen && (LOCALES as readonly string[]).includes(chosen)) {
      return chosen !== locale ? (chosen as Locale) : null;
    }
    const preferred = navigator.languages ?? [navigator.language];
    for (const pref of preferred) {
      const primary = pref.toLowerCase().split("-")[0];
      const match = LOCALES.find((l) => l === primary);
      if (match) {
        return match !== locale ? match : null; // first supported preference decides
      }
    }
  } catch {}
  return null;
}

// The owner's decision (docs/decisions.md): browser language never hard
// redirects. This quiet offer, a notification rather than anything in the
// page flow, gives a one-tap switch in the visitor's own language. The
// stored value is the CHOICE, not a dismissal: someone who picked Spanish
// and later lands on an English page is offered Spanish again instead of
// being stranded; someone who dismissed is treated as having chosen the
// page they were on.
export default function LanguageSuggest() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("suggest");
  const [target, setTarget] = useState<Locale | null>(null);

  // The server renders nothing here, and so does the first client render:
  // localStorage and navigator have no server counterpart, so reading them
  // any earlier (a lazy state initializer, say) would make the two renders
  // disagree. The read is deferred by one macrotask and the timer is
  // cancellable, so a locale change or an unmount cannot land a stale
  // suggestion. The state is REPLACED on every run, offer or silence, so
  // the no-stale-suggestion guarantee is this component's own and never
  // leans on the subtree happening to remount across locales.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTarget(pickTarget(locale));
    }, 0);
    return () => clearTimeout(timer);
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
    // dir belongs on the inner row, not here. This element is positioned
    // with logical properties, and those resolve against the direction of
    // the element that carries them: an Arabic offer marked rtl put itself
    // in the top LEFT corner of an English page, opposite every other
    // overlay. The card follows the PAGE, the words inside follow the
    // language being offered. lang stays out here so the accessible name
    // is announced in that language.
    <div className="lang-suggest" role="region" lang={target} aria-label={INVITES[target].invite}>
      {/* No .shell: this is a fixed notification and manages its own
          padding, not a full-width band inside the page grid. */}
      <div className="lang-suggest-in" dir={RTL_LOCALES.has(target) ? "rtl" : "ltr"}>
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
          // The only string here that is NOT in the offered language: it
          // comes from the page's own catalogue. Without this it would
          // inherit lang from the region and a screen reader would read the
          // page's words with the offered language's voice.
          lang={locale}
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
