import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // The catalog JSON and sample resolver are part of the public
      // surface for AI agents (documented in llms.txt); the rest of
      // /api/ stays out of crawlers.
      allow: ["/", "/api/catalog", "/api/sample"],
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
