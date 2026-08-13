"use client";

import type { ComponentProps, MouseEvent } from "react";
import { BaseLink } from "@/i18n/navigation-base";
import { glideTo, setGlideIntent } from "@/lib/glide";

type Props = ComponentProps<typeof BaseLink>;

function recordGlide(e: MouseEvent<HTMLAnchorElement>, scrollProp: Props["scroll"]) {
  // scroll={true} is an explicit opt-in to Next's own instant scroll.
  if (scrollProp === true) return;
  // Only plain primary-button clicks navigate this tab.
  if (e.defaultPrevented) return;
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const anchor = e.currentTarget;
  if (anchor.target && anchor.target !== "_self") return;
  // currentTarget.href is the final localized destination, unlike the raw
  // href prop, which next-intl still needs to prefix.
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    // Same document (wordmark at home, the active masthead tab, a re-clicked
    // family tile): no route commit will follow, so glide right away.
    glideTo(url.hash);
    return;
  }
  setGlideIntent({ pathname: url.pathname, search: url.search, hash: url.hash, at: Date.now() });
}

// The house Link: Next's navigation scroll is off (it can only jump), and
// ScrollGlide animates to the recorded destination once the route commits.
export default function GlideLink({ onClick, scroll, ...rest }: Props) {
  return (
    <BaseLink
      {...rest}
      scroll={scroll ?? false}
      onClick={(e) => {
        onClick?.(e);
        recordGlide(e, scroll);
      }}
    />
  );
}
