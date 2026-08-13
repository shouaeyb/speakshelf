import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerList } from "@/components/Explorer";
import { getProviderCatalog, sampleCount } from "@/lib/catalog";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { languageName } from "@/lib/lang";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Params {
  provider: string;
  lang: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  for (const p of PROVIDERS) {
    const catalog = await getProviderCatalog(p.key);
    for (const l of catalog?.languages ?? []) {
      params.push({ provider: p.key, lang: l.code });
    }
  }
  return params;
}

// The catalog refreshes itself from the live API once a day; a language
// that appears upstream gets its page rendered on first request. That
// same openness means routing alone cannot 404 an unknown provider here,
// so the page validates both params itself.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provider, lang } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) return {};
  const name = languageName(lang);
  const count = catalog.voices.filter((v) => v.lang === lang).length;
  if (count === 0) return {};
  return {
    title: `${meta.label} ${name} voices`,
    description: `All ${count} ${meta.label} text to speech voices for ${name} (${lang}), with samples you can play in the browser.`,
    alternates: { canonical: `/${provider}/voices/${lang}` },
    openGraph: {
      title: `${meta.label} ${name} voices · Speakshelf`,
      description: `All ${count} ${meta.label} text to speech voices for ${name}, with playable samples.`,
      images: ["/og.png"],
    },
  };
}

export default async function LanguagePage({ params }: { params: Promise<Params> }) {
  const { provider, lang } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) notFound();
  const voices = catalog.voices.filter((v) => v.lang === lang);
  if (voices.length === 0) notFound();
  const name = languageName(lang);
  const families = new Set(voices.map((v) => v.family)).size;
  const samples = sampleCount(voices, catalog.models);
  const famWord = families === 1 ? meta.familyWord.one : meta.familyWord.many;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.label} ${name} text to speech voices`,
    url: `${SITE_URL}/${provider}/voices/${lang}`,
    description: `${meta.label} text to speech voices for ${name} (${lang}).`,
    isPartOf: { "@type": "WebSite", name: "Speakshelf", url: SITE_URL },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="subhead">
        <div className="shell">
          <Link className="crumb" href={`/${provider}#languages`}>
            ← All {meta.label} languages
          </Link>
          <h1>{name}</h1>
          <p className="subhead-meta">
            {lang} · {voices.length} {voices.length === 1 ? "voice" : "voices"} · {families} {famWord} ·{" "}
            {samples} playable {samples === 1 ? "sample" : "samples"}
          </p>
        </div>
      </section>
      <section className="explorer shell">
        <ExplorerList provider={provider} voices={voices} lockLanguage={lang} models={catalog.models} />
      </section>
    </main>
  );
}
