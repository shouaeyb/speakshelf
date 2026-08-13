import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Explorer from "@/components/Explorer";
import { getProviderCatalog } from "@/lib/catalog";
import { jsonLdSafe } from "@/lib/jsonld";
import { PROVIDERS, getProvider } from "@/lib/providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// The catalog refreshes itself from the live API once a day. Providers are
// the blessed set only: an unknown segment 404s at routing.
export const revalidate = 86400;
export const dynamicParams = false;

interface Params {
  provider: string;
}

export function generateStaticParams(): Params[] {
  return PROVIDERS.map((p) => ({ provider: p.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provider } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) return {};
  const description = `Play samples of the full ${meta.label} text to speech catalog: ${catalog.stats.voices.toLocaleString(
    "en-US",
  )} voices in ${catalog.stats.languages} languages, with filters for ${meta.familyWord.one}, language and gender.`;
  return {
    title: `${meta.label} text to speech voices`,
    description,
    alternates: { canonical: `/${provider}` },
    openGraph: {
      title: `${meta.label} text to speech voices · Speakshelf`,
      // No counts on share surfaces: platforms cache previews for weeks.
      description: `The full ${meta.label} text to speech catalog with a playable sample for every voice.`,
      images: ["/og.png"],
    },
  };
}

export default async function ProviderPage({ params }: { params: Promise<Params> }) {
  const { provider } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) notFound();
  const { stats, families, languages: langs, models } = catalog;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const famWord = stats.families === 1 ? meta.familyWord.one : meta.familyWord.many;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.label} text to speech voices`,
    url: `${SITE_URL}/${provider}`,
    description: `A catalog of every ${meta.label} text to speech voice, with samples you can play in the browser.`,
    isPartOf: { "@type": "WebSite", name: "Speakshelf", url: SITE_URL },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <section className="hero">
        <div className="shell">
          <div className="hero-rule rise"></div>
          <p className="eyebrow rise">{meta.eyebrow}</p>
          <h1 className="rise rise-2">{meta.heroTitle}</h1>
          <p className="hero-sub rise rise-3">{meta.heroSub}</p>
          <nav className="hero-jumps rise rise-3" aria-label="Sections">
            <a href="#models">{meta.familyWord.jump}</a>
            <a href="#voices">VOICES</a>
            <a href="#languages">LANGUAGES</a>
            <a href="#about">ABOUT</a>
          </nav>
          <div className="stats rise rise-4">
            <div className="stat">
              <div className="stat-num">{fmt(stats.voices)}</div>
              <div className="stat-label">VOICES</div>
            </div>
            <div className="stat">
              <div className="stat-num">{stats.languages}</div>
              <div className="stat-label">LANGUAGES</div>
            </div>
            <div className="stat">
              <div className="stat-num">{stats.families}</div>
              <div className="stat-label">{famWord.toUpperCase()}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.samples)}</div>
              <div className="stat-label">PLAYABLE SAMPLES</div>
            </div>
          </div>
        </div>
      </section>

      <section className="families" id="models">
        <div className="shell">
          <h2 className="sec-title">
            {families.length} {famWord}
          </h2>
          <p className="sec-sub">{meta.familiesIntro}</p>
          <div className={`fam-grid${families.length < 5 ? ` fam-grid-${families.length}` : ""}`}>
            {families.map((f) => (
              <Link key={f.key} className="fam-tile" href={`/${provider}?family=${f.key}#voices`}>
                <span className={`tag ${f.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
                  {f.tier.toUpperCase()}
                </span>
                <span className="fam-name">{f.label}</span>
                <span className="fam-desc">{f.blurb}</span>
                <span className="fam-meta">
                  {fmt(f.voices)} {f.voices === 1 ? "voice" : "voices"} ·{" "}
                  <span className="nowrap">
                    {f.languages} {f.languages === 1 ? "lang" : "langs"}
                  </span>
                  {f.models ? <span className="nowrap"> · {f.models} sub-models</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lang-band" id="languages">
        <div className="shell">
          <h2 className="sec-title">{stats.languages} languages</h2>
          <p className="sec-sub">
            Every language has its own page with the full list of voices, so you can link someone straight
            to one shelf of the catalog.
          </p>
          <div className="lang-grid">
            {langs.map((l) => (
              <Link key={l.code} className="lang-cell" href={`/${provider}/voices/${l.code}`}>
                <span>{l.name}</span>
                <span className="n">{l.voices}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="shell">
          <h2 className="sec-title">About this catalog</h2>
          <div className="about-cols">
            <p>{meta.about({ stats, models })}</p>
            <p>
              Speakshelf is independent and not affiliated with Google, Amazon or the Kokoro project.
              Voice data and audio come from the <a href="https://aitts.theproductivepixel.com">AI TTS Microservice</a>,
              a service that unifies Google, Amazon, Azure and other speech providers behind a single
              endpoint. Samples stream on demand, so listening is free.
            </p>
          </div>
        </div>
      </section>

      {/* The voice list grows and re-measures as it renders, so it stays
          last: every anchor target above it keeps a stable position. */}
      <section className="explorer shell" id="voices">
        <h2 className="sec-title">All voices</h2>
        <Suspense fallback={<div className="results-line"><span className="results-count">Loading catalog</span></div>}>
          <Explorer provider={provider} models={models} />
        </Suspense>
      </section>
    </main>
  );
}
