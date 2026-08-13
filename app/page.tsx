import type { Metadata } from "next";
import Link from "next/link";
import { getSite } from "@/lib/catalog";
import { jsonLdSafe } from "@/lib/jsonld";
import { PROVIDERS } from "@/lib/providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// The catalog refreshes itself from the live API once a day.
export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const site = await getSite();
  const { stats } = site;
  const fmt = (n: number) => n.toLocaleString("en-US");
  // Scale cap: the hero sentence names at most three shelves, then counts
  // the rest, so twenty providers never turn it into a paragraph.
  const providerNames = PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => p.label);
  const nameList =
    providerNames.length > 3
      ? `${providerNames.slice(0, 3).join(", ")} and ${providerNames.length - 3} more`
      : providerNames.length > 1
        ? `${providerNames.slice(0, -1).join(", ")} and ${providerNames[providerNames.length - 1]}`
        : (providerNames[0] ?? "");

  // "Coverage adds up" derives from data, and stays modest by design:
  // compare by primary language subtag so two codes for the same language
  // (Polly's arb vs Google's ar-XA, yue-CN vs yue-HK) can never fake a
  // gap, name whole-language gaps as gaps and variants as variants, and
  // keep prose slots to names that read cleanly (no commas, and no
  // parentheses for the variant examples). If the data thins out, the
  // cell falls back to its generic sentence rather than reaching.
  const google = site.providers.get("google");
  const polly = site.providers.get("polly");
  const primary = (code: string) => (code === "arb" ? "ar" : code.split("-")[0]);
  const googleCodes = new Set(google?.languages.map((l) => l.code) ?? []);
  const googlePrimaries = new Set((google?.languages ?? []).map((l) => primary(l.code)));
  const pollyLangs = polly?.languages ?? [];
  const gapName = pollyLangs
    .filter((l) => !googlePrimaries.has(primary(l.code)))
    .map((l) => l.name.split(" (")[0])
    .find((n) => !n.includes(","));
  const variantExamples = pollyLangs
    .filter((l) => !googleCodes.has(l.code) && googlePrimaries.has(primary(l.code)))
    .map((l) => l.name)
    .filter((n) => !n.includes(",") && !n.includes("("))
    .slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Speakshelf",
    url: SITE_URL,
    description: `A catalog of text to speech voices from ${nameList}, with samples you can play in the browser.`,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <section className="hero">
        <div className="shell">
          <div className="hero-rule rise"></div>
          <p className="eyebrow rise">TEXT TO SPEECH CATALOG</p>
          <h1 className="rise rise-2">{fmt(stats.voices)} voices. One shelf.</h1>
          <p className="hero-sub rise rise-3">
            Speakshelf catalogs the text to speech voices of {nameList}, each with a sample you can
            play in the browser. No account, no setup, just the voices.
          </p>
          <nav className="hero-jumps rise rise-3" aria-label="Sections">
            <a href="#providers">PROVIDERS</a>
            <a href="#about">ABOUT</a>
          </nav>
          <div className="stats rise rise-4">
            <div className="stat">
              <div className="stat-num">{fmt(stats.voices)}</div>
              <div className="stat-label">VOICES</div>
            </div>
            <div className="stat">
              <div className="stat-num">{stats.providers}</div>
              <div className="stat-label">PROVIDERS</div>
            </div>
            <div className="stat">
              <div className="stat-num">{stats.languages}</div>
              <div className="stat-label">LANGUAGES</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.samples)}</div>
              <div className="stat-label">PLAYABLE SAMPLES</div>
            </div>
          </div>
        </div>
      </section>

      <section className="providers" id="providers">
        <div className="shell">
          <h2 className="sec-title">
            {stats.providers} {stats.providers === 1 ? "provider" : "providers"}
          </h2>
          <p className="sec-sub">
            Every provider keeps a full shelf: the complete voice list with filters and playback, notes
            on each model family, and a page per language. The shelf grows: the AI TTS Microservice
            unifies more providers, and new shelves open here once verified.
          </p>
          <div className="prov-grid">
            {PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => {
              const c = site.providers.get(p.key)!;
              return (
                <Link key={p.key} className="prov-card" href={`/${p.key}`}>
                  <span className="prov-key">/{p.key.toUpperCase()}</span>
                  <span className="prov-name">{p.label}</span>
                  <span className="prov-count">
                    {fmt(c.stats.voices)}
                    <small>voices</small>
                  </span>
                  <span className="prov-meta">
                    {c.stats.languages} languages · {c.stats.families}{" "}
                    {c.stats.families === 1 ? p.familyWord.one : p.familyWord.many} ·{" "}
                    {fmt(c.stats.samples)} samples
                  </span>
                  <span className="prov-desc">{p.cardBlurb}</span>
                  <span className="prov-go">BROWSE →</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="why">
        <div className="shell">
          <h2 className="sec-title">Why one shelf</h2>
          <p className="sec-sub">
            Catalogs differ in more than size. Keeping them side by side shows the gaps, the overlaps
            and the character of each.
          </p>
          <div className="why-grid">
            <div className="why-cell">
              <h3>Coverage adds up</h3>
              <p>
                {gapName
                  ? `Amazon Polly brings ${gapName}, which Google Cloud doesn't carry at all` +
                    (variantExamples.length === 2
                      ? `, plus regional variants like ${variantExamples[0]} and ${variantExamples[1]}. `
                      : ". ")
                  : variantExamples.length === 2
                    ? `Amazon Polly adds regional variants like ${variantExamples[0]} and ${variantExamples[1]}. `
                    : ""}
                One shelf shows what each provider has that the others lack.
              </p>
            </div>
            <div className="why-cell">
              <h3>One way to listen</h3>
              <p>
                Same filters, same player, same voice id scheme on every shelf. Comparing voices across
                providers is two clicks, not two consoles.
              </p>
            </div>
            <div className="why-cell">
              <h3>Fresh on its own</h3>
              <p>
                Every shelf refreshes from the AI TTS Microservice daily. New voices, languages and
                sub-models appear here without anyone editing the site.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="shell">
          <h2 className="sec-title">About this catalog</h2>
          <div className="about-cols">
            <p>
              Speakshelf is a reference catalog for text to speech voices. Today it carries{" "}
              {fmt(stats.voices)} voices from {stats.providers} providers in {stats.languages}{" "}
              languages, every one with a sample you can play. Voices are grouped the way their
              providers group them, into model families and engines, so what you hear maps onto what
              you would deploy.
            </p>
            <p>
              Speakshelf is independent and not affiliated with Google, Amazon or the Kokoro project.
              Voice data and audio come from the <a href="https://aitts.theproductivepixel.com">AI TTS Microservice</a>,
              a service that unifies Google, Amazon, Azure and other speech providers behind a single
              endpoint. Samples stream on demand, so listening is free.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
