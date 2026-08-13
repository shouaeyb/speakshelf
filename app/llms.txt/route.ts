import { getCatalog } from "@/lib/catalog";

// A small llms.txt for AI assistants and agents. Regenerated with the
// daily catalog refresh so its numbers stay true.
export const dynamic = "force-static";
export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET() {
  const { stats, languages, families } = await getCatalog();
  const top = languages.slice(0, 12);
  const body = `# Speakshelf

> A reference catalog of every Google Cloud text to speech voice: ${stats.voices.toLocaleString(
    "en-US",
  )} voices in ${stats.languages} languages across ${stats.families} model families (${families
    .map((f) => f.label)
    .join(", ")}), with ${stats.samples.toLocaleString(
    "en-US",
  )} playable audio samples. Data and audio come from the AI TTS Microservice. Independent site, not affiliated with Google.

Voice ids follow the pattern google:{language}-{Family}-{Name}, for example google:en-US-Chirp3HD-Charon. Gemini voices can each be rendered by several sub-models, one sample per sub-model.

## Pages

- [All voices](${SITE_URL}/): the full catalog with search and filters for family, language, gender and Gemini sub-model
- [Languages](${SITE_URL}/#languages): index of per language pages
${top.map((l) => `- [${l.name} voices](${SITE_URL}/voices/${l.code}): ${l.voices} voices, ${l.samples} samples`).join("\n")}
- Every other language lives at ${SITE_URL}/voices/{code}, see the sitemap for the full list

## Machine access

- [Sitemap](${SITE_URL}/sitemap.xml)
- Sample audio resolves through ${SITE_URL}/api/sample?id={voice_id} (optional &model= for Gemini sub-models), answering {url} when ready and 202 while a sample is generated
- The catalog JSON at ${SITE_URL}/api/catalog packs each voice as [language, family, name, gender(f|m|n|u), tier(p premium|u ultra), styles], plus a models map of sub-model ids per family
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
