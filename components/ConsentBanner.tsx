"use client";

import { useEffect, useState } from "react";
import { applyConsent, readConsentMode, writeConsentMode, type ConsentMode } from "@/lib/consent";

// Shown until the visitor acts, then never again. Both choices store the
// visitor's actual answer and dismiss; gating is applyConsent's problem
// on the day it gains a body.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

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
        <p className="consent-text">
          Speakshelf uses cookies and analytics to understand how the catalog is used.
        </p>
        <div className="consent-actions">
          <button type="button" className="consent-btn consent-ghost" onClick={() => decide("necessary")}>
            Necessary only
          </button>
          <button type="button" className="consent-btn consent-primary" onClick={() => decide("all")}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
