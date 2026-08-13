"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PROVIDERS } from "@/lib/providers";

// The masthead is global chrome: it always shows the provider shelves,
// with the current one underlined. Section-level wayfinding lives in each
// page's hero jump links instead, so the masthead never has to know what
// sections a page has.
export default function MastNav() {
  const pathname = usePathname();
  return (
    <nav className="mast-nav" aria-label="Providers">
      {PROVIDERS.map((p) => {
        const active = pathname === `/${p.key}` || pathname.startsWith(`/${p.key}/`);
        return (
          <Link
            key={p.key}
            className={`mast-link${active ? " mast-active" : ""}`}
            aria-current={active ? "page" : undefined}
            href={`/${p.key}`}
          >
            <span className="mast-long">{p.label}</span>
            <span className="mast-short">{p.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
