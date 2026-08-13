// Consent state, mirroring the tts-microutil V2 posture the owner chose:
// the banner is shown once and records the visitor's choice, but nothing
// gates on it yet. Analytics run always-on regardless (see
// lib/analytics.ts); the owner's legal team owns the real policy and
// applyConsent below is the single seam where their gating will land.
// There is deliberately no UI to reopen preferences today; resetConsent
// exists for when that day comes.

export type ConsentMode = "unknown" | "all" | "necessary";

const KEY = "ss-consent";

export function readConsentMode(): ConsentMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "necessary" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

export function writeConsentMode(mode: ConsentMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Storage unavailable: the banner will show again next visit.
  }
}

/** The seam for real consent gating. Pass-through today by the owner's
 *  decision; when legal specifies behavior, it lands here and nowhere
 *  else. The visitor's true choice is already stored for that moment. */
export function applyConsent(_mode: ConsentMode): void {
  // Intentionally empty.
}

/** Unused today (no reopen UI); kept so a future settings surface only
 *  has to call it. */
export function resetConsent(): void {
  writeConsentMode("unknown");
}
