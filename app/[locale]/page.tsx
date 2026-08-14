import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listNamesPlain } from "@/i18n/locales";
import { getSite } from "@/lib/catalog";
import { jsonLdSafe } from "@/lib/jsonld";
import { baseLanguageName, languageName } from "@/lib/lang";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { PROVIDERS } from "@/lib/providers";

// The catalog refreshes itself from the live API once a day.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates("/", locale) };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const site = await getSite();
  const { stats } = site;
  if (!hasLocale(routing.locales, locale)) return null;
  const t = await getTranslations({ locale });
  const fmt = (n: number) => n.toLocaleString(locale);

  // Scale cap: the hero sentence names at most three shelves as a bare
  // comma list; the message itself closes with its locale's "and more", so
  // the line stays true as providers land and never turns into a paragraph.
  const providerNames = PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => p.label);
  const nameList = listNamesPlain(providerNames.slice(0, 3), locale);

  // "Coverage adds up" derives from CODES, never from parsing display
  // strings: compare by primary language subtag so two codes for the same
  // language (Polly's arb vs Google's ar-XA) can never fake a gap. A
  // whole-language gap shows the bare language name (a region would lie);
  // a variant shows the full regional name. Message variants cover every
  // data shape, so no sentence is ever assembled from fragments.
  const google = site.providers.get("google");
  const polly = site.providers.get("polly");
  const primary = (code: string) => (code === "arb" ? "ar" : code.split("-")[0]);
  const googleCodes = new Set(google?.languages.map((l) => l.code) ?? []);
  const googlePrimaries = new Set((google?.languages ?? []).map((l) => primary(l.code)));
  const pollyLangs = polly?.languages ?? [];
  const gapName = pollyLangs
    .filter((l) => !googlePrimaries.has(primary(l.code)))
    .map((l) => baseLanguageName(l.code, locale))
    .sort()[0];
  const variantExamples = pollyLangs
    .filter((l) => !googleCodes.has(l.code) && googlePrimaries.has(primary(l.code)))
    .map((l) => languageName(l.code, locale))
    .sort()
    .slice(0, 2);
  const coverage =
    gapName && variantExamples.length === 2
      ? t("home.why1GapAndVariants", { gap: gapName, v1: variantExamples[0], v2: variantExamples[1] })
      : gapName
        ? t("home.why1GapOnly", { gap: gapName })
        : variantExamples.length === 2
          ? t("home.why1VariantsOnly", { v1: variantExamples[0], v2: variantExamples[1] })
          : t("home.why1Generic");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Speakshelf",
    url: localeUrl("/", locale),
    inLanguage: locale,
    description: t("meta.homeJsonLd", { names: nameList }),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />

      <section className="hero">
        <div className="shell">
          <div className="hero-rule rise"></div>
          <p className="eyebrow rise">{t("home.eyebrow")}</p>
          <h1 className="rise rise-2">{t("home.title", { voices: stats.voices })}</h1>
          <p className="hero-sub rise rise-3">{t("home.sub", { names: nameList })}</p>
          <nav className="hero-jumps rise rise-3" aria-label={t("a11y.sections")}>
            <a href="#providers">{t("home.jumpProviders")}</a>
            <a href="#about">{t("home.jumpAbout")}</a>
          </nav>
          <div className="stats rise rise-4">
            <div className="stat">
              <div className="stat-num">{fmt(stats.voices)}</div>
              <div className="stat-label">{t("stats.voices")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.providers)}</div>
              <div className="stat-label">{t("stats.providers")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.languages)}</div>
              <div className="stat-label">{t("stats.languages")}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmt(stats.samples)}</div>
              <div className="stat-label">{t("stats.samples")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="providers" id="providers">
        <div className="shell">
          <h2 className="sec-title">{t("home.providersTitle", { count: stats.providers })}</h2>
          <p className="sec-sub">{t("home.providersSub")}</p>
          <div className="prov-grid">
            {PROVIDERS.filter((p) => site.providers.has(p.key)).map((p) => {
              const c = site.providers.get(p.key)!;
              const famWord = t(`providers.${p.key}.familyWord`, { count: c.stats.families });
              return (
                <Link key={p.key} className="prov-card" href={`/${p.key}`}>
                  <span className="prov-key" dir="ltr">/{p.key.toUpperCase()}</span>
                  <span className="prov-name">{p.label}</span>
                  <span className="prov-count">
                    {fmt(c.stats.voices)}
                    <small>{t("home.cardVoices", { count: c.stats.voices })}</small>
                  </span>
                  <span className="prov-meta">
                    {t("home.cardMeta", {
                      languages: c.stats.languages,
                      familiesCount: fmt(c.stats.families),
                      familyWord: famWord,
                      samples: c.stats.samples,
                    })}
                  </span>
                  <span className="prov-desc">{t(`providers.${p.key}.card`)}</span>
                  <span className="prov-go">{t("home.browse")}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="why">
        <div className="shell">
          <h2 className="sec-title">{t("home.whyTitle")}</h2>
          <p className="sec-sub">{t("home.whySub")}</p>
          <div className="why-grid">
            <div className="why-cell">
              <h3>{t("home.why1Title")}</h3>
              <p>{coverage}</p>
            </div>
            <div className="why-cell">
              <h3>{t("home.why2Title")}</h3>
              <p>{t("home.why2Body")}</p>
            </div>
            <div className="why-cell">
              <h3>{t("home.why3Title")}</h3>
              <p>{t("home.why3Body")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="shell">
          <h2 className="sec-title">{t("home.aboutTitle")}</h2>
          <div className="about-cols">
            <p>
              {t("home.aboutBody", {
                voices: stats.voices,
                providers: stats.providers,
                languages: stats.languages,
              })}
            </p>
            <p>
              {t.rich("attribution.body", {
                link: (chunks) => <a href="https://aitts.theproductivepixel.com">{chunks}</a>,
              })}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
