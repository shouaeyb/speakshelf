import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerList } from "@/components/Explorer";
import { languages, voicesForLanguage } from "@/lib/catalog";
import { languageName } from "@/lib/lang";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Params {
  lang: string;
}

export function generateStaticParams(): Params[] {
  return languages().map((l) => ({ lang: l.code }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const name = languageName(lang);
  const count = voicesForLanguage(lang).length;
  return {
    title: `${name} voices`,
    description: `All ${count} Google Cloud text to speech voices for ${name} (${lang}), with samples you can play in the browser.`,
    alternates: { canonical: `/voices/${lang}` },
    openGraph: {
      title: `${name} voices · Voice Atlas`,
      description: `All ${count} Google text to speech voices for ${name}, with playable samples.`,
      images: ["/og.png"],
    },
  };
}

export default async function LanguagePage({ params }: { params: Promise<Params> }) {
  const { lang } = await params;
  const voices = voicesForLanguage(lang);
  if (voices.length === 0) notFound();
  const name = languageName(lang);
  const families = new Set(voices.map((v) => v.family)).size;
  const samples = voices.filter((v) => v.hasSample).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${name} text to speech voices`,
    url: `${SITE_URL}/voices/${lang}`,
    description: `Google Cloud text to speech voices for ${name} (${lang}).`,
    isPartOf: { "@type": "WebSite", name: "Voice Atlas", url: SITE_URL },
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
            {lang} · {voices.length} voices · {families} model families · {samples} playable samples
          </p>
        </div>
      </section>
      <section className="explorer shell">
        <ExplorerList voices={voices} lockLanguage={lang} />
      </section>
    </main>
  );
}
