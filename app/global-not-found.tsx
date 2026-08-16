import type { Metadata, Viewport } from "next";
import { DEFAULT_LOCALE, LOCALES, RTL_LOCALES } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";
import ar from "@/messages/ar.json";
import bn from "@/messages/bn.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import hi from "@/messages/hi.json";
import id from "@/messages/id.json";
import it from "@/messages/it.json";
import ja from "@/messages/ja.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import sw from "@/messages/sw.json";
import zh from "@/messages/zh.json";
import { FONT_VARS } from "./fonts";
import "./globals.css";

// The site's 404 for URLs that match no route, answered at the routing
// level: with experimental.globalNotFound on, Next serves this file
// without rendering a layout, a provider or a page. That is what makes it
// the one 404 a reader without JavaScript can actually see, and it is why
// nothing in here may depend on next-intl, on the catalog or on any
// request state. Bypassing the layouts also means carrying its own <html>,
// its own fonts and its own stylesheet import (the manifest,
// app/globals.css, exactly as the locale layout imports it).
//
// A notFound() thrown by a route that has already started rendering does
// not arrive here in 16.3.0; that case still belongs to
// app/[locale]/not-found.tsx, which says so at its top.
//
// One document serves fourteen locales. All fourteen translations are
// server-rendered as sibling blocks and the stylesheet shows the one whose
// data-l matches the html element's; the head script below sets that
// attribute from the URL before the first paint. Without JavaScript the
// server default stands and every reader gets the English block, branded
// and readable, which is the whole point of the change.

type NotFoundCopy = { title: string; body: string; home: string };

// The message files read as data at build time, not through next-intl.
const COPY: Record<Locale, NotFoundCopy> = {
  en: en.notFound,
  es: es.notFound,
  zh: zh.notFound,
  hi: hi.notFound,
  fr: fr.notFound,
  bn: bn.notFound,
  pt: pt.notFound,
  ru: ru.notFound,
  id: id.notFound,
  ar: ar.notFound,
  sw: sw.notFound,
  ja: ja.notFound,
  de: de.notFound,
  it: it.notFound,
};

// Parser-blocking and tiny, so the reader's own locale is on the html
// element before the first paint and no English block ever flashes. Its
// only data are the thirteen prefixed locale codes and the one RTL code,
// written out longhand: no translated string, no interpolated value and
// nothing derived from the request may ever enter a script tag, whatever
// the temptation to generate this list. That leaves three hand-kept copies
// of the locale set: this code list, the "ar" in the rtl test below (which
// is RTL_LOCALES written out), and the .nf-v rules in app/styles/site.css.
// The blocks in the body come from LOCALES itself and cannot drift, and
// scripts/check-404-locales.mjs fails on any of the three drifting, because
// the failure they cause is silent: a locale in LOCALES that the script
// does not know renders as English, and one that the stylesheet does not
// know renders as nothing at all.
const LOCALE_BOOT = `(function () {
  var c = location.pathname.split("/")[1];
  if (["es","zh","hi","fr","bn","pt","ru","id","ar","sw","ja","de","it"].indexOf(c) < 0) return;
  var e = document.documentElement;
  e.setAttribute("data-l", c);
  e.setAttribute("lang", c);
  e.setAttribute("dir", c === "ar" ? "rtl" : "ltr");
})();`;

// Next injects noindex on any page that answers 404, so the title is the
// only metadata this page adds. It reads the English message rather than
// repeating it, and it stays English in all fourteen: one document has one
// title, and the head script may not carry a translated string to swap it.
export const metadata: Metadata = {
  title: en.notFound.title,
};

// The layout's theme color, repeated because this page bypasses the layout.
// Without it Android Chrome lightens its own chrome on the 404 and darkens
// it again on the next page.
export const viewport: Viewport = {
  themeColor: "#161616",
};

/** One locale's whole page: the part of the masthead that needs no client,
 *  over the same 404 body the locale-scoped page renders. Left out on
 *  purpose: provider tabs, the language suggestion strip, the locale
 *  switcher, analytics, the consent bar and the footer.
 *
 *  Thirteen of these fourteen blocks are display:none, so the document
 *  carries fourteen <main> elements. Checked in Chromium rather than
 *  assumed: the accessibility tree exposes exactly one main, one banner
 *  and one h1, because display:none drops the rest. The alternative, a
 *  hidden attribute on every block, would validate more strictly and blank
 *  the page outright if the stylesheet ever failed to load. */
function Variant({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const home = locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
  return (
    <div
      className="nf-v"
      data-l={locale}
      lang={locale}
      dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}
    >
      <header className="masthead">
        <div className="shell masthead-in">
          <a href={home} className="wordmark">
            {/* eslint-disable-next-line @next/next/no-img-element -- /icon.svg is the favicon, a 20px vector already in the tab: next/image cannot optimize SVG and would only add a loader hop. */}
            <img className="wordmark-icon" src="/icon.svg" alt="" width={20} height={20} />
            Speakshelf
          </a>
        </div>
      </header>
      <main>
        <section className="subhead">
          <div className="shell">
            <h1>{copy.title}</h1>
            <p className="subhead-meta">{copy.body}</p>
          </div>
        </section>
        <section className="shell" style={{ paddingTop: 32, paddingBottom: 96 }}>
          <a className="crumb" href={home}>
            {copy.home}
          </a>
        </section>
      </main>
    </div>
  );
}

export default function GlobalNotFound() {
  return (
    // The server defaults are English; the head script rewrites all three
    // attributes for the other thirteen, which is a deliberate mismatch
    // for hydration to ignore.
    <html lang="en" dir="ltr" data-l="en" className={FONT_VARS} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT }} />
      </head>
      <body>
        {LOCALES.map((locale) => (
          <Variant key={locale} locale={locale} />
        ))}
      </body>
    </html>
  );
}
