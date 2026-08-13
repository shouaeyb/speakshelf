import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { catalogStats, catalogUpdated } from "@/lib/catalog";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Voice Atlas · every Google Cloud text to speech voice",
    template: "%s · Voice Atlas",
  },
  description:
    "Play samples of the full Google Cloud text to speech catalog: Gemini, Chirp 3 HD, Neural2, WaveNet, Studio and Standard voices in 93 languages.",
  applicationName: "Voice Atlas",
  keywords: [
    "Google text to speech",
    "Google TTS voices",
    "Google Cloud TTS",
    "Gemini TTS",
    "Chirp 3 HD",
    "WaveNet",
    "Neural2",
    "voice samples",
  ],
  openGraph: {
    type: "website",
    siteName: "Voice Atlas",
    title: "Voice Atlas · every Google Cloud text to speech voice",
    description:
      "Browse and play the complete Google Cloud text to speech catalog. Filter by model family, language and gender.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voice Atlas · every Google Cloud text to speech voice",
    description:
      "Browse and play the complete Google Cloud text to speech catalog. Filter by model family, language and gender.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#161616",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const stats = catalogStats();
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <header className="masthead">
          <div className="shell masthead-in">
            <Link href="/" className="wordmark">
              <span className="wordmark-sq"></span>Voice Atlas
            </Link>
            <nav className="mast-nav" aria-label="Main">
              <Link className="mast-link" href="/#models">
                Models
              </Link>
              <Link className="mast-link" href="/#voices">
                Voices
              </Link>
              <Link className="mast-link" href="/#languages">
                Languages
              </Link>
              <Link className="mast-link" href="/#about">
                About
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="shell footer-in">
            <span className="wordmark">
              <span className="wordmark-sq"></span>Voice Atlas
            </span>
            <p className="footer-note">
              Catalog updated {catalogUpdated} · {stats.voices.toLocaleString("en-US")} voices across{" "}
              {stats.languages} languages
              <br />
              Samples served by the <a href="https://aitts.theproductivepixel.com">AI TTS API</a> · Not
              affiliated with Google
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
