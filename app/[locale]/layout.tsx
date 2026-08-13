import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import Analytics from "@/components/Analytics";
import ConsentBanner from "@/components/ConsentBanner";
import LanguageSuggest from "@/components/LanguageSuggest";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import MastNav from "@/components/MastNav";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALES, listNames } from "@/i18n/locales";
import { getSite } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/providers";
import "../globals.css";

const plexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const site = await getSite();
  const names = PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => p.label);
  const present = listNames(names, locale);
  const title = t("siteTitle", { names: present });
  // Cached share surfaces name one provider fewer than the shelf carries
  // plus "and more", so the cached line stays true when the next provider
  // lands; a single-provider shelf claims nothing extra.
  const shareNames =
    names.length <= 1
      ? (names[0] ?? "Speakshelf")
      : t("andMore", { names: names.slice(0, Math.min(2, names.length - 1)).join(", ") });
  const shareTitle = t("siteTitle", { names: shareNames });
  const description = t("siteDescription", {
    voices: site.stats.voices,
    names: present,
    languages: site.stats.languages,
  });
  const shareDescription = t("shareDescription", { names: shareNames });
  return {
    metadataBase: new URL(SITE_URL),
    title: { template: "%s · Speakshelf", default: title },
    description,
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
      title: shareTitle,
      description: shareDescription,
      images: ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: ["/og.png"],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#161616",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "footer" });
  const ta = await getTranslations({ locale, namespace: "a11y" });
  const { stats, updated: catalogUpdated } = await getSite();
  const fmt = (n: number) => n.toLocaleString(locale);

  return (
    // data-scroll-behavior lets the router suppress the smooth rule in
    // globals.css while it scrolls to the top of a new page; without it,
    // Next 16 leaves the animation running and navigations land short.
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <LanguageSuggest />
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
          <Analytics />
          <ConsentBanner />
          <footer className="footer">
            <div className="shell footer-in">
              <div className="footer-brand">
                <span className="wordmark">
                  <span className="wordmark-sq"></span>Speakshelf
                </span>
                <LocaleSwitcher />
              </div>
              <p className="footer-note">
                {t("note", {
                  date: catalogUpdated,
                  voices: stats.voices,
                  providers: stats.providers,
                  languages: stats.languages,
                })}
                <br />
                {t.rich("served", {
                  link: (chunks) => <a href="https://aitts.theproductivepixel.com">{chunks}</a>,
                })}
              </p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
