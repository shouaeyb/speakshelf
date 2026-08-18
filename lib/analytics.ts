// The sole analytics boundary: every event any component sends goes
// through here, fanning out to Mixpanel and GA4. No other file imports
// mixpanel-browser or touches gtag. Always-on by the owner's decision
// (their legal owns the consent posture and will revisit); the ids are
// client-side public identifiers read from env.

import mixpanel from "mixpanel-browser";

export const EVENTS = {
  SAMPLE_PLAYED: "sample_played",
  SAMPLE_FAILED: "sample_failed",
  SAMPLE_GENERATING: "sample_generating",
  // A preparation step failed without costing the reader their sample: the
  // bytes fetch fell back to streaming, or a decode that only powers the
  // next replay did not finish. Deliberately NOT sample_failed, which means
  // the reader heard nothing; counting these there would report successful
  // plays as failures.
  SAMPLE_PREPARE_FAILED: "sample_prepare_failed",
  FILTER_CHANGED: "filter_changed",
  SEARCH_USED: "search_used",
  PROVIDER_OPENED: "provider_opened",
} as const;

type EventName = (typeof EVENTS)[keyof typeof EVENTS];
type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

let ready = false;

/** Idempotent; called once from the Analytics component on mount. */
export function initAnalytics(): void {
  if (typeof window === "undefined" || ready) return;
  ready = true;

  if (MIXPANEL_TOKEN) {
    // Autocapture (clicks, pageviews, forms) plus full session replay,
    // per the owner's Mixpanel setup. Precision events below add the
    // domain semantics autocapture cannot know. Pageviews fire on path
    // changes only: the explorer mirrors every filter and search
    // keystroke into the query string via replaceState, and the default
    // full-url granularity would count each keystroke as a pageview.
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: { pageview: "url-with-path" },
      record_sessions_percent: 100,
      persistence: "localStorage",
      ignore_dnt: true,
    });
    mixpanel.register({
      app: "speakshelf",
      env: process.env.NODE_ENV,
      device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    });
  }

  if (GA_ID) {
    // The stub queues into dataLayer until the external gtag.js arrives,
    // so nothing here needs an inline script tag.
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false });
  }
}

/** Origin + path only. Filter state lives in the query string here, so
 *  stripping keeps analytics page dimensions clean (and keeps any future
 *  query-carried token out of the vendors, the pattern this is copied
 *  from in tts-microutil). */
export function stripQueryAndHash(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

/** GA4 page view with its built-in param names; fired on every route
 *  change. Mixpanel autocapture records its own page views. */
export function pageView(): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "page_view", {
    page_location: stripQueryAndHash(window.location.href),
    page_path: window.location.pathname,
    page_title: document.title,
    page_referrer: stripQueryAndHash(document.referrer),
  });
}

/** Fan one event out to both vendors. Safe before init and without ids. */
export function track(name: EventName, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  if (ready && MIXPANEL_TOKEN) mixpanel.track(name, props);
  window.gtag?.("event", name, props);
}

/** UI locale as a standing dimension: a Mixpanel super property and a GA
 *  user property. Event names stay stable English identifiers. */
export function setAnalyticsLocale(locale: string): void {
  if (typeof window === "undefined") return;
  if (ready && MIXPANEL_TOKEN) mixpanel.register({ locale });
  window.gtag?.("set", "user_properties", { ui_locale: locale });
}
