// Client-only scroll glide shared by GlideLink and ScrollGlide. A wrapped
// Link click records one intent; ScrollGlide consumes it when the router
// commits the matching URL. Back/forward, Explorer's replaceState writes
// and the locale switchers record no intent, so they never glide: browser
// restoration and keep-your-place behavior stay untouched.

export type GlideIntent = {
  pathname: string;
  search: string;
  hash: string;
  at: number;
};

let pending: GlideIntent | null = null;

export function setGlideIntent(intent: GlideIntent) {
  pending = intent;
}

// One-shot: any route commit consumes the intent, matching or not, so a
// stale intent can never fire on a later unrelated navigation.
export function takeGlideIntent(): GlideIntent | null {
  const intent = pending;
  pending = null;
  return intent;
}

export function glideTo(hash: string) {
  // "auto" resolves through the CSS rule, which prefers-reduced-motion
  // switches to instant; readers who ask for less motion get none.
  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  if (hash) {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) {
      el.scrollIntoView({ behavior, block: "start" });
      return;
    }
  }
  window.scrollTo({ top: 0, left: 0, behavior });
}
