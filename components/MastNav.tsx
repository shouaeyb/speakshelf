"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROVIDERS } from "@/lib/providers";
import { EVENTS, track } from "@/lib/analytics";

// The masthead is global chrome: it always shows the provider shelves,
// with the current one underlined. Section-level wayfinding lives in each
// page's hero jump links instead, so the masthead never has to know what
// sections a page has.

// Scale cap: names fit only while the shelf list is short. Past this many
// providers the masthead shows the largest ones (config order is display
// order) plus one link to the full list on the umbrella, so twenty
// providers can never overflow the chrome.
const MAX_NAMED = 4;

export default function MastNav() {
  const pathname = usePathname();
  let named = PROVIDERS.length > MAX_NAMED ? PROVIDERS.slice(0, MAX_NAMED - 1) : PROVIDERS;
  // The active shelf must always be visible and underlined, even when the
  // roster is collapsed: swap it in for the last named slot if hidden.
  const activeMeta = PROVIDERS.find(
    (p) => pathname === `/${p.key}` || pathname.startsWith(`/${p.key}/`),
  );
  if (activeMeta && !named.includes(activeMeta)) {
    named = [...named.slice(0, -1), activeMeta];
  }
  return (
    <nav className="mast-nav" aria-label="Providers">
      {named.map((p) => {
        const active = pathname === `/${p.key}` || pathname.startsWith(`/${p.key}/`);
        return (
          <Link
            key={p.key}
            className={`mast-link${active ? " mast-active" : ""}`}
            aria-current={active ? "page" : undefined}
            href={`/${p.key}`}
            onClick={() => track(EVENTS.PROVIDER_OPENED, { provider: p.key, source: "masthead" })}
          >
            <span className="mast-long">{p.label}</span>
            <span className="mast-short">{p.short}</span>
          </Link>
        );
      })}
      {named.length < PROVIDERS.length && (
        <Link className="mast-link" href="/#providers">
          <span className="mast-long">All providers</span>
          <span className="mast-short">All</span>
        </Link>
      )}
    </nav>
  );
}
