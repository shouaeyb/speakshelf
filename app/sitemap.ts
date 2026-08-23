import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";
import { getSite } from "@/lib/catalog";
import { localeUrl } from "@/lib/seo";

export const revalidate = 86400;

// One entry per page per locale, each carrying the full alternate set so
// crawlers see the reciprocal hreflang picture from the sitemap alone.
//
// The daily window is declared here rather than inherited. A generated
// sitemap is a route handler that Next caches, and with no revalidate of
// its own it is prerendered once and served from that artifact until the
// next deploy: the URL set would then be frozen to whatever catalog the
// build saw, and a language appearing upstream would never enter the
// sitemap. Such a page stays reachable through the daily provider index,
// so this is delayed discovery rather than a lost page, but every other
// catalog-derived route already says 86400 and this one is no exception.
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
