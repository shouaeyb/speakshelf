import type { MetadataRoute } from "next";
import { getSite } from "@/lib/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
  for (const [key, catalog] of site.providers) {
    entries.push({
      url: `${SITE_URL}/${key}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    for (const l of catalog.languages) {
      entries.push({
        url: `${SITE_URL}/${key}/voices/${l.code}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }
  return entries;
}
