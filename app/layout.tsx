import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import MastNav from "@/components/MastNav";
import { getSite } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/providers";
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

function listNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

// The static fallback list comes from the bless config; generateMetadata
// narrows it to providers actually present in the data, so the title never
// names a shelf the site is not showing.
const providerList = listNames(PROVIDERS.map((p) => p.label));

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const present = listNames(PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => p.label));
  const title = `Speakshelf · text to speech voices from ${present}`;
  const description = `Browse and play ${site.stats.voices.toLocaleString(
    "en-US",
  )} text to speech voices from ${present} in ${site.stats.languages} languages, every one with a playable sample.`;
  return {
    ...metadata,
    title: { template: "%s · Speakshelf", default: title },
    description,
    openGraph: { ...metadata.openGraph, title, description },
    twitter: { ...metadata.twitter, title, description },
  };
}

const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Speakshelf · text to speech voices from ${providerList}`,
    template: "%s · Speakshelf",
  },
  applicationName: "Speakshelf",
  keywords: [
    "text to speech voices",
    "TTS samples",
    "Google Cloud TTS",
    "Gemini TTS",
    "Chirp 3 HD",
    "WaveNet",
    "Amazon Polly voices",
    "Polly neural voices",
    "Kokoro TTS",
    "voice samples",
  ],
  openGraph: {
    type: "website",
    siteName: "Speakshelf",
    title: `Speakshelf · text to speech voices from ${providerList}`,
    description: `Browse and play the text to speech catalogs of ${providerList}. Every voice with a playable sample.`,
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Speakshelf · text to speech voices from ${providerList}`,
    description: `Browse and play the text to speech catalogs of ${providerList}. Every voice with a playable sample.`,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { stats, updated: catalogUpdated } = await getSite();
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <header className="masthead">
          <div className="shell masthead-in">
            <Link href="/" className="wordmark">
              {/* The masthead carries the favicon itself, tile and all, so
                  the header matches the browser tab above it. The footer
                  keeps the bare squares on its own dark ground. */}
              <img className="wordmark-icon" src="/icon.svg" alt="" width={20} height={20} />
              Speakshelf
            </Link>
            <MastNav />
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="shell footer-in">
            <span className="wordmark">
              <span className="wordmark-sq"></span>Speakshelf
            </span>
            <p className="footer-note">
              Catalog updated {catalogUpdated} · {stats.voices.toLocaleString("en-US")} voices from{" "}
              {stats.providers} providers in {stats.languages} languages
              <br />
              Samples served by the <a href="https://aitts.theproductivepixel.com">AI TTS Microservice</a> ·
              Independent, not affiliated with Google, Amazon or the Kokoro project
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
