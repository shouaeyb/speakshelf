import type { NextConfig } from "next";

// Google lived at the root before the umbrella homepage existed. Every old
// URL keeps working through permanent redirects (Next answers 308, the
// method-preserving permanent code). "has" entries AND together, so the
// old filter links need one rule per query key. "q" is deliberately not
// redirected: it is too generic a name to bind to /google forever with a
// permanently cached redirect, and no pre-umbrella links were ever public.
const EXPLORER_PARAMS = ["family", "language", "gender", "gmodel"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/voices/:lang",
        destination: "/google/voices/:lang",
        permanent: true,
      },
      ...EXPLORER_PARAMS.map((key) => ({
        source: "/",
        has: [{ type: "query" as const, key }],
        destination: "/google",
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
