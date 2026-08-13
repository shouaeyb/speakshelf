import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";
import { getSite } from "@/lib/catalog";
import { localeUrl } from "@/lib/seo";

// One entry per page per locale, each carrying the full alternate set so
// crawlers see the reciprocal hreflang picture from the sitemap alone.
// lastModified is the catalog's own refresh date, not generation time,
// so routes do not all look freshly changed on every regeneration.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const lastModified = new Date(`${site.updated}T00:00:00Z`);

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
    const languages = Object.fromEntries(LOCALES.map((l) => [l, localeUrl(path, l)]));
    for (const locale of LOCALES) {
      entries.push({
        url: localeUrl(path, locale),
        lastModified,
        changeFrequency,
        priority: locale === "en" ? priority : priority * 0.9,
        alternates: { languages },
      });
    }
  }
  return entries;
}
