import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import { getSite } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/providers";

// A small llms.txt for AI assistants and agents. Regenerated with the
// daily catalog refresh so its numbers stay true.
export const dynamic = "force-static";
export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET() {
  // llms.txt stays English at its stable URL by decision; the English
  // messages provide the provider vocabulary. Loosened typing because the
  // provider key is dynamic.
  const t = createTranslator({ locale: "en", messages: en }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  const site = await getSite();
  const { stats } = site;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const active = PROVIDERS.filter((p) => site.providers.has(p.key));
  const nameList = `${active
    .slice(0, -1)
    .map((p) => p.label)
    .join(", ")} and ${active[active.length - 1]?.label ?? ""}`;

  const providerLines = active
    .map((p) => {
      const c = site.providers.get(p.key)!;
      const famWord = t(`providers.${p.key}.familyWord`, { count: c.stats.families });
      return `- [${p.label} voices](${SITE_URL}/${p.key}): ${fmt(c.stats.voices)} voices in ${c.stats.languages} languages across ${c.stats.families} ${famWord}, with ${fmt(c.stats.samples)} samples. Per language pages at ${SITE_URL}/${p.key}/voices/{code}.`;
    })
    .join("\n");

  const body = `# Speakshelf

> A reference catalog of text to speech voices from ${nameList}: ${fmt(stats.voices)} voices in ${stats.languages} languages, with ${fmt(stats.samples)} playable audio samples. Data and audio come from the AI TTS Microservice. Independent site, not affiliated with any provider it catalogs.

Voice ids follow the pattern {provider}:{language}-{Family}-{Name}, for example google:en-US-Chirp3HD-Charon or polly:en-US-Neural-Joanna. Google's Gemini voices can each be rendered by several sub-models, one sample per sub-model.

## Pages

- [All providers](${SITE_URL}/): one card per provider with links into each shelf
${providerLines}

## Machine access

- [Sitemap](${SITE_URL}/sitemap.xml)
- Sample audio resolves through ${SITE_URL}/api/sample?id={voice_id} (optional &model= for Gemini sub-models), answering {url} when ready and 202 while a sample is generated
- Per provider catalog JSON at ${SITE_URL}/api/catalog/{provider} packs each voice as [language, family, name, gender(f|m|n|u), tier(p premium|u ultra), styles, traitsJson?], plus a models map of sub-model ids per family. The optional seventh slot is a JSON object of extra characteristics when a voice has any (age, pitch, accent, use_case, roles)
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
