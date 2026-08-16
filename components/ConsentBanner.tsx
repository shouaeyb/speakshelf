"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyConsent, readConsentMode, writeConsentMode, type ConsentMode } from "@/lib/consent";

// Shown until the visitor acts, then never again; the stored choice is
// global across locales. Both choices store the visitor's actual answer
// and dismiss; gating is applyConsent's problem on the day it gains a
// body.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("consent");
  const ta = useTranslations("a11y");

  // Hidden on the server and through hydration, then shown only when the
  // stored mode is still "unknown". readConsentMode touches localStorage,
  // which the server does not have, so the read is deferred by one
  // macrotask rather than pulled into render; the cleanup cancels it if the
  // banner unmounts first.
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(readConsentMode() === "unknown");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const decide = (mode: ConsentMode) => {
    writeConsentMode(mode);
    applyConsent(mode);
    setVisible(false);
  };

  return (
    <div className="consent" role="region" aria-label={ta("cookies")}>
      <div className="shell consent-in">
        <p className="consent-text">{t("text")}</p>
        <div className="consent-actions">
          <button type="button" className="consent-btn consent-ghost" onClick={() => decide("necessary")}>
            {t("necessary")}
          </button>
          <button type="button" className="consent-btn consent-primary" onClick={() => decide("all")}>
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
