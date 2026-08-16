import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Explorer from "@/components/Explorer";
import { Link } from "@/i18n/navigation";
import { getProviderCatalog } from "@/lib/catalog";
import { jsonLdSafe } from "@/lib/jsonld";
import { languageName } from "@/lib/lang";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { PROVIDERS, getProvider } from "@/lib/providers";

// The catalog refreshes itself from the live API once a day. Providers are
// the blessed set only, prerendered by generateStaticParams, and
// dynamicParams stays false so an unknown one-segment path never renders
// here and never writes a cached not-found entry (this route is ISR; a
// rendered notFound() would be persisted per garbage URL, on Cloud Run's
// tmpfs). Declining the segment is also what reaches the branded 404: an
// unmatched URL is answered at the routing level by app/global-not-found.tsx,
// which is prerendered, served no-store and readable without JavaScript,
// in English (the reader's own locale needs the head script there).
export const revalidate = 86400;
export const dynamicParams = false;

interface Params {
  locale: string;
  provider: string;
}

export function generateStaticParams(): { provider: string }[] {
  return PROVIDERS.map((p) => ({ provider: p.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, provider } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const tp = await getTranslations({ locale, namespace: `providers.${provider}` });
  return {
    title: t("providerTitle", { label: meta.label }),
    description: t("providerDescription", {
      label: meta.label,
      voices: catalog.stats.voices,
      languages: catalog.stats.languages,
      familyWord: tp("familyWord", { count: 1 }),
    }),
    alternates: localeAlternates(`/${provider}`, locale),
    openGraph: {
      title: `${t("providerTitle", { label: meta.label })} · Speakshelf`,
      // No counts on share surfaces: platforms cache previews for weeks.
      description: t("providerShareDescription", { label: meta.label }),
      images: ["/og.png"],
    },
  };
}

export default async function ProviderPage({ params }: { params: Promise<Params> }) {
  const { locale, provider } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) notFound();
  const { stats, families, languages: langs, models } = catalog;
  // Presentation order: the reader's alphabet over localized names; the
  // catalog array stays in its neutral code order and is never mutated.
  const langCollator = new Intl.Collator(locale);
  const sortedLangs = [...langs].sort(
    (a, b) =>
      langCollator.compare(languageName(a.code, locale), languageName(b.code, locale)) ||
      a.code.localeCompare(b.code),
  );
  // Twins, two codes that localize to one name (Google's ar-XA and
  // ar-001), carry their code in the grid cell so the two cells never
  // read as an inexplicable duplicate. Same generic rule as the
  // Explorer's dropdown.
  const langNameTimes = new Map<string, number>();
  for (const l of sortedLangs) {
    const n = languageName(l.code, locale);
    langNameTimes.set(n, (langNameTimes.get(n) ?? 0) + 1);
  }
  const t = await getTranslations({ locale });
  const fmt = (n: number) => n.toLocaleString(locale);
  const famWord = t(`providers.${provider}.familyWord`, { count: stats.families });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("meta.providerTitle", { label: meta.label }),
    url: localeUrl(`/${provider}`, locale),
    inLanguage: locale,
    description: t("meta.providerJsonLd", { label: meta.label }),
    isPartOf: { "@type": "WebSite", name: "Speakshelf", url: localeUrl("/", locale) },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <section className="hero">
        <div className="shell">
          <div className="hero-rule rise"></div>
          <p className="eyebrow rise">{t(`providers.${provider}.eyebrow`)}</p>
          <h1 className="rise rise-2">{t(`providers.${provider}.heroTitle`)}</h1>
          <p className="hero-sub rise rise-3">{t(`providers.${provider}.heroSub`)}</p>
          <nav className="hero-jumps rise rise-3" aria-label={t("a11y.sections")}>
            <a href="#models">{t(`providers.${provider}.jump`)}</a>
            <a href="#voices">{t("providerPage.jumpVoices")}</a>
            <a href="#languages">{t("providerPage.jumpLanguages")}</a>
            <a href="#about">{t("providerPage.jumpAbout")}</a>
          </nav>
          <div className="stats rise rise-4">
            <div className="stat">
              <div className="stat-num">{fmt(stats.voices)}</div>
              <div className="stat-label">{t("stats.voices")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.languages)}</div>
              <div className="stat-label">{t("stats.languages")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.families)}</div>
              <div className="stat-label upper">{famWord}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.samples)}</div>
              <div className="stat-label">{t("stats.samples")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="families" id="models">
        <div className="shell">
          <h2 className="sec-title">
            {t("providerPage.familiesTitle", { count: families.length, familyWord: famWord })}
          </h2>
          <p className="sec-sub">{t(`providers.${provider}.familiesIntro`)}</p>
          <div className={`fam-grid${families.length < 5 ? ` fam-grid-${families.length}` : ""}`}>
            {families.map((f) => (
              <Link key={f.key} className="fam-tile" href={`/${provider}?family=${f.key}#voices`}>
                <span className={`tag ${f.tier === "ultra" ? "tag-purple" : "tag-blue"}`}>
                  {t(`tags.${f.tier}`)}
                </span>
                <span className="fam-name">{f.label}</span>
                <span className="fam-desc">
                  {f.known
                    ? t(`families.${provider}.${f.key}.blurb`)
                    : t(`providers.${provider}.unknownFamily`)}
                </span>
                <span className="fam-meta">
                  {t("providerPage.famMeta", { voices: f.voices })} ·{" "}
                  <span className="nowrap">{t("providerPage.famLangs", { count: f.languages })}</span>
                  {f.models ? (
                    <span className="nowrap"> · {t("providerPage.famModels", { count: f.models })}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lang-band" id="languages">
        <div className="shell">
          <h2 className="sec-title">{t("providerPage.languagesTitle", { count: stats.languages })}</h2>
          <p className="sec-sub">{t("providerPage.languagesSub")}</p>
          <div className="lang-grid">
            {sortedLangs.map((l) => (
              <Link key={l.code} className="lang-cell" href={`/${provider}/voices/${l.code}`}>
                <span>
                  {languageName(l.code, locale)}
                  {(langNameTimes.get(languageName(l.code, locale)) ?? 0) > 1 && (
                    <span className="lang-cell-code" dir="ltr">
                      {l.code}
                    </span>
                  )}
                </span>
                <span className="n">{fmt(l.voices)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="shell">
          <h2 className="sec-title">{t("providerPage.aboutTitle")}</h2>
          <div className="about-cols">
            <p>
              {t(`providers.${provider}.about`, {
                voices: stats.voices,
                families: stats.families,
                languages: stats.languages,
                models: models.Gemini?.length ?? 0,
              })}
            </p>
            <p>
              {t("attribution.independenceNamed", { name: meta.label })}{" "}
              {t.rich("attribution.source", {
                link: (chunks) => <a href="https://aitts.theproductivepixel.com">{chunks}</a>,
              })}
            </p>
          </div>
        </div>
      </section>

      {/* The voice list grows and re-measures as it renders, so it stays
          last: every anchor target above it keeps a stable position. */}
      <section className="explorer shell" id="voices">
        <h2 className="sec-title">{t("providerPage.allVoices")}</h2>
        <Suspense
          fallback={
            <div className="results-line">
              <span className="results-count">{t("explorer.loading")}</span>
            </div>
          }
        >
          <Explorer provider={provider} models={models} />
        </Suspense>
      </section>
    </main>
  );
}
