import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Explorer from "@/components/Explorer";
import { getCatalog } from "@/lib/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// The catalog refreshes itself from the live API once a day.
export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const { stats, families, languages: langs, models } = await getCatalog();
  const fmt = (n: number) => n.toLocaleString("en-US");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Voice Atlas",
    url: SITE_URL,
    description:
      "A catalog of every Google Cloud text to speech voice, with samples you can play in the browser.",
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="hero">
        <div className="shell">
          <div className="hero-rule rise"></div>
          <p className="eyebrow rise">GOOGLE CLOUD TEXT TO SPEECH</p>
          <h1 className="rise rise-2">Every Google voice, on one page.</h1>
          <p className="hero-sub rise rise-3">
            Play a sample of every voice in the Google Cloud catalog. Filter by model family,
            language and gender. No account, no setup, just the voices.
          </p>
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
              <div className="stat-label">MODEL FAMILIES</div>
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
            {families.length} model {families.length === 1 ? "family" : "families"}
          </h2>
          <p className="sec-sub">
            Google has shipped a new speech architecture roughly every two years, and all of them are still
            in service. The catalog runs from compact parametric voices to models you can direct with a
            sentence.
          </p>
          <div className="fam-grid">
            {families.map((f) => (
              <Link key={f.key} className="fam-tile" href={`/?family=${f.key}#voices`}>
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
            to the Korean or Swiss German catalog.
          </p>
          <div className="lang-grid">
            {langs.map((l) => (
              <Link key={l.code} className="lang-cell" href={`/voices/${l.code}`}>
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
            <p>
              Google Cloud runs one of the largest text to speech catalogs of any cloud provider. It spans{" "}
              {stats.families} model families, from the WaveNet voices that made neural speech mainstream to Gemini voices that
              change their delivery when you describe the tone you want. Gemini is really{" "}
              {models.Gemini?.length ?? "several"} models in one: every Gemini voice can be rendered by
              any of its sub-models, and each render has its own sample here. Every other voice in the
              catalog has a sample too.
            </p>
            <p>
              Voice Atlas is an independent reference and is not affiliated with Google. Voice data and
              audio come from the <a href="https://aitts.theproductivepixel.com">AI TTS Microservice</a>, a service
              that unifies Google, Amazon and other speech providers behind a single endpoint. Samples
              stream on demand, so listening is free.
            </p>
          </div>
        </div>
      </section>

      {/* The voice list grows and re-measures as it renders, so it stays
          last: every anchor target above it keeps a stable position. */}
      <section className="explorer shell" id="voices">
        <h2 className="sec-title">All voices</h2>
        <Suspense fallback={<div className="results-line"><span className="results-count">Loading catalog</span></div>}>
          <Explorer models={models} />
        </Suspense>
      </section>
    </main>
  );
}
