"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { initAnalytics, pageView, setAnalyticsLocale } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Mounted once in the locale layout. Initializes both vendors, keeps the
// locale dimension current, and fires a GA page view per route change;
// everything else goes through lib/analytics.ts. The pathname here is
// the real one (locale prefix included), which is what page analytics
// should see.
export default function Analytics() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    setAnalyticsLocale(locale);
  }, [locale]);

  useEffect(() => {
    pageView();
  }, [pathname]);

  if (!GA_ID) return null;
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
      strategy="afterInteractive"
    />
  );
}
