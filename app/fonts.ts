// The four IBM Plex faces, defined once and shared by the two entry points
// that own an <html> element: the locale layout and app/global-not-found.tsx
// (which bypasses every layout and therefore has to load its own fonts).
// next/font generates one class and one set of files per call site, so a
// second copy of these calls would ship the same faces twice under two
// variable names. Keep them here, import them there.
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Sans_Arabic, IBM_Plex_Sans_JP } from "next/font/google";

export const plexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

export const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-mono",
});

// Script fonts activate per locale through the token overrides in
// styles/base.css (html[lang="ar"], html[lang="ja"]); preload stays off so
// only their own pages fetch them.
export const plexArabic = IBM_Plex_Sans_Arabic({
  weight: ["300", "400", "500", "600"],
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-arabic",
  preload: false,
});

export const plexJP = IBM_Plex_Sans_JP({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jp",
  preload: false,
});

/** The four font variable classes, in the order the layout wrote them. */
export const FONT_VARS = `${plexSans.variable} ${plexMono.variable} ${plexArabic.variable} ${plexJP.variable}`;
