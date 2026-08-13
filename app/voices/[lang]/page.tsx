import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerList } from "@/components/Explorer";
import { getCatalog, sampleCount } from "@/lib/catalog";
import { languageName } from "@/lib/lang";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Params {
  lang: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const { languages } = await getCatalog();
  return languages.map((l) => ({ lang: l.code }));
}

// The catalog refreshes itself from the live API once a day; a language
// that appears upstream gets its page rendered on first request.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const { voices } = await getCatalog();
  const name = languageName(lang);
  const count = voices.filter((v) => v.lang === lang).length;
  return {
    title: `${name} voices`,
    description: `All ${count} Google Cloud text to speech voices for ${name} (${lang}), with samples you can play in the browser.`,
    alternates: { canonical: `/voices/${lang}` },
    openGraph: {
      title: `${name} voices · Speakshelf`,
      description: `All ${count} Google text to speech voices for ${name}, with playable samples.`,
      images: ["/og.png"],
    },
  };
}

export default async function LanguagePage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  const catalog = await getCatalog();
  const voices = catalog.voices.filter((v) => v.lang === lang);
  if (voices.length === 0) notFound();
  const name = languageName(lang);
  const families = new Set(voices.map((v) => v.family)).size;
  const samples = sampleCount(voices, catalog.models);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${name} text to speech voices`,
    url: `${SITE_URL}/voices/${lang}`,
    description: `Google Cloud text to speech voices for ${name} (${lang}).`,
    isPartOf: { "@type": "WebSite", name: "Speakshelf", url: SITE_URL },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="subhead">
        <div className="shell">
          <Link className="crumb" href="/#languages">
            ← All languages
          </Link>
          <h1>{name}</h1>
          <p className="subhead-meta">
            {lang} · {voices.length} {voices.length === 1 ? "voice" : "voices"} · {families} model{" "}
            {families === 1 ? "family" : "families"} · {samples} playable{" "}
            {samples === 1 ? "sample" : "samples"}
          </p>
        </div>
      </section>
      <section className="explorer shell">
        <ExplorerList voices={voices} lockLanguage={lang} models={catalog.models} />
      </section>
    </main>
  );
}
