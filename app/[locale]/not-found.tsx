import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// The 404 for a route that renders and then calls notFound(): today the
// language page, for a lang that is not in the catalog. Unmatched URLs
// never come here, they are answered before any render by
// app/global-not-found.tsx; the proxy matcher's exact exclusions
// (proxy.ts) make sure even dotted garbage like /foo.txt reaches the
// locale rewrite and is declined there rather than rendering a layout.
//
// Do not delete this file in favour of the global page. Measured against
// 16.3.0: globalNotFound only serves URLs that match no route, because
// createNotFoundLoaderTree in next/dist/server/app-render/app-render.js is
// reached from the server-action path alone. A notFound() thrown inside a
// render still produces Next's <html id="__next_error__"> document with the
// markup in the RSC payload, and without this file that payload carries
// Next's own unbranded "404: This page could not be found" instead of the
// translated page.
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main>
      <section className="subhead">
        <div className="shell">
          <h1>{t("title")}</h1>
          <p className="subhead-meta">{t("body")}</p>
        </div>
      </section>
      <section className="shell" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <Link className="crumb" href="/">
          {t("home")}
        </Link>
      </section>
    </main>
  );
}
