import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";
import { getSite } from "@/lib/catalog";
import { localeUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// One entry per page per locale, each carrying the full alternate set so
// crawlers see the reciprocal hreflang picture from the sitemap alone.
//
// This route is dynamic on purpose. Next's ISR state is local to each
// Cloud Run instance. Once a build artifact is old enough, a recycled
// instance can serve that artifact to its first sitemap requester while
// regeneration runs in the background. Sitemap requests are too sparse
// for the health probe to hide that stale-first behavior.
//
// Rendering on every request removes the per-instance sitemap cache.
// getSite() still holds the built catalog in process for six hours and
// coalesces refreshes, so this does not fetch the upstream catalog on
// every sitemap request.
//
// No lastModified, deliberately. The only date available is
// `site.updated`, which `lib/catalog.ts` stamps when a refresh SUCCEEDS,
// not when the voices actually change, so an unchanged catalog still
// moves it and every one of the 2,072 URLs would claim to have changed on
// the same day. A page modification date crawlers can trust would need
// real per-page change detection. lastmod is optional and an absent
// signal beats a misleading one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();

  const paths: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
  ];
  for (const [key, catalog] of site.providers) {
    paths.push({ path: `/${key}`, priority: 0.9, changeFrequency: "weekly" });
    for (const l of catalog.languages) {
      paths.push({ path: `/${key}/voices/${l.code}`, priority: 0.7, changeFrequency: "monthly" });
    }
  }

  const entries: MetadataRoute.Sitemap = [];
  for (const { path, priority, changeFrequency } of paths) {
    const languages = {
      ...Object.fromEntries(LOCALES.map((l) => [l, localeUrl(path, l)])),
      "x-default": localeUrl(path, "en"),
    };
    for (const locale of LOCALES) {
      entries.push({
        url: localeUrl(path, locale),
        changeFrequency,
        priority: locale === "en" ? priority : priority * 0.9,
        alternates: { languages },
      });
    }
  }
  return entries;
}
