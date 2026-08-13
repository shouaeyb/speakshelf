"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { initAnalytics, pageView } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Mounted once in the root layout. Initializes both vendors and fires a
// GA page view per route change; everything else goes through
// lib/analytics.ts.
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

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
