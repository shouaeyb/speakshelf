import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExplorerList } from "@/components/Explorer";
import { Link } from "@/i18n/navigation";
import { getProviderCatalog, sampleCount, voiceCount } from "@/lib/catalog";
import { jsonLdSafe } from "@/lib/jsonld";
import { languageName } from "@/lib/lang";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { PROVIDERS, getProvider } from "@/lib/providers";

interface Params {
  locale: string;
  provider: string;
  lang: string;
}

export async function generateStaticParams(): Promise<{ provider: string; lang: string }[]> {
  const params: { provider: string; lang: string }[] = [];
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

/** " · ar-XA" when another code in the same provider's catalog localizes
 *  to this very name, "" otherwise. Google runs ar-XA and ar-001 as one
 *  register, so their two pages carry one title; the code tells a search
 *  result, a share card and a knowledge graph entry which of the two it
 *  is. Title surfaces only: the page itself already shows the code in its
 *  hero line, so the heading and the prose stay clean. */
function twinSuffix(codes: string[], lang: string, name: string, locale: string): string {
  return codes.some((c) => c !== lang && languageName(c, locale) === name) ? ` · ${lang}` : "";
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, provider, lang } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) return {};
  const inLang = catalog.voices.filter((v) => v.lang === lang);
  if (inLang.length === 0) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const name = languageName(lang, locale);
  const count = voiceCount(inLang, meta.voiceIdentity);
  const title =
    t("langTitle", { label: meta.label, language: name }) +
    twinSuffix(catalog.languages.map((l) => l.code), lang, name, locale);
  return {
    title,
    description: t("langDescription", { label: meta.label, language: name, code: lang, voices: count }),
    alternates: localeAlternates(`/${provider}/voices/${lang}`, locale),
    openGraph: {
      title: `${title} · Speakshelf`,
      // No counts on share surfaces: platforms cache previews for weeks.
      description: t("langShareDescription", { label: meta.label, language: name }),
      images: ["/og.png"],
    },
  };
}

export default async function LanguagePage({ params }: { params: Promise<Params> }) {
  const { locale, provider, lang } = await params;
  const meta = getProvider(provider);
  const catalog = await getProviderCatalog(provider);
  if (!meta || !catalog) notFound();
  const voices = catalog.voices.filter((v) => v.lang === lang);
  if (voices.length === 0) notFound();
  const t = await getTranslations({ locale });
  const name = languageName(lang, locale);
  const count = voiceCount(voices, meta.voiceIdentity);
  const families = new Set(voices.map((v) => v.family)).size;
  const samples = sampleCount(voices, catalog.models);
  const famWord = t(`providers.${provider}.familyWord`, { count: families });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name:
      t("meta.langTitle", { label: meta.label, language: name }) +
      twinSuffix(catalog.languages.map((l) => l.code), lang, name, locale),
    url: localeUrl(`/${provider}/voices/${lang}`, locale),
    inLanguage: locale,
    description: t("meta.langJsonLd", { label: meta.label, language: name, code: lang }),
    isPartOf: { "@type": "WebSite", name: "Speakshelf", url: localeUrl("/", locale) },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />
      <section className="subhead">
        <div className="shell">
          <Link className="crumb" href={`/${provider}#languages`}>
            {t("langPage.crumb", { label: meta.label })}
          </Link>
          <h1>{name}</h1>
          <p className="subhead-meta">
            {t("langPage.meta", {
              // First-strong isolate keeps the Latin code intact inside
              // RTL prose (the JSX spans cannot reach into a message).
              code: `\u2066${lang}\u2069`,
              voices: count,
              families,
              familyWord: famWord,
              samples,
            })}
          </p>
        </div>
      </section>
      <section className="explorer shell">
        <ExplorerList provider={provider} voices={voices} lockLanguage={lang} models={catalog.models} />
      </section>
    </main>
  );
}
