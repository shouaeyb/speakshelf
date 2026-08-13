"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { glideTo, takeGlideIntent } from "@/lib/glide";

// Consumes the intent a GlideLink click recorded once the router commits the
// matching URL, then animates there. Renders nothing. Needs a Suspense
// boundary around it (useSearchParams) or prerendering de-opts.
export default function ScrollGlide() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const intent = takeGlideIntent();
    if (!intent) return;
    // Generous cleanup only, never a latency boundary: a slow cold
    // navigation must still glide, since Next's own scroll is off.
    if (Date.now() - intent.at > 30000) return;
    if (intent.pathname !== window.location.pathname || intent.search !== window.location.search)
      return;
    glideTo(intent.hash);
  }, [pathname, search]);

  return null;
}
