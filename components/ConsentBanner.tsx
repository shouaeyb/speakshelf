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

  useEffect(() => {
    setVisible(readConsentMode() === "unknown");
  }, []);

  if (!visible) return null;

  const decide = (mode: ConsentMode) => {
    writeConsentMode(mode);
    applyConsent(mode);
    setVisible(false);
  };

  return (
    <div className="consent" role="region" aria-label="Cookies">
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
