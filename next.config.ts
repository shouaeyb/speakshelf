import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Google lived at the root before the umbrella homepage existed. Every old
// URL keeps working through permanent redirects (Next answers 308, the
// method-preserving permanent code). "has" entries AND together, so the
// old filter links need one rule per query key. "q" is deliberately not
// redirected: it is too generic a name to bind to /google forever with a
// permanently cached redirect, and no pre-umbrella links were ever public.
const EXPLORER_PARAMS = ["family", "language", "gender", "gmodel"];

// Production CSP. Dev is exempt (HMR needs unsafe-eval and websockets).
// script-src 'unsafe-inline' is load-bearing for the JSON-LD blocks the
// pages inline, not only for analytics; style-src 'unsafe-inline' covers
// next/font's injected font-face styles. Mixpanel session replay loads
// its recorder from cdn.mxpnl.com and runs a worker, hence worker-src.
// storage.googleapis.com is the signed sample audio (fetch warm + <audio>).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.mxpnl.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://www.google.com https://api-js.mixpanel.com https://*.mixpanel.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com",
  "media-src 'self' blob: https://storage.googleapis.com https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "microphone=(), camera=(), geolocation=()" },
  ...(isProd
    ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy", value: CSP },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
      // The default locale is always served unprefixed; a direct /en URL
      // must not become a duplicate page.
      {
        source: "/en",
        destination: "/",
        permanent: true,
      },
      {
        source: "/en/:path*",
        destination: "/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
