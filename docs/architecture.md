# Architecture

How Speakshelf works, and the invariants that keep it working. Update this file in the same commit as any change that makes it stale.

## The shape

Next.js 16 App Router, classic caching model (cacheComponents is off, and stays off: `dynamicParams` on the language pages depends on it), TypeScript, no UI libraries, no Tailwind. One interactive component (`components/Explorer.tsx`), a small client nav (`components/MastNav.tsx`), a server catalog library (`lib/catalog.ts`), a provider bless config (`lib/providers.ts`), two API route families, and static pages around them.

## The provider dimension

Everything is generic over providers; going live is not. The split is deliberate:

- **Machinery is generic.** Data (`packed v4` keyed by provider), routing (`/[provider]`, `/[provider]/voices/[lang]`), playback (voice ids carry the provider prefix), sitemap, llms.txt and metadata all iterate the blessed set. Nothing anywhere hardcodes "google" except redirects for the pre-umbrella URLs.
- **Going live is a blessing.** `lib/providers.ts` is the one place a provider becomes real: key, display names, hero and about copy, the word it uses for its voice groupings ("model families" for Google, "engines" for Polly), plus per-provider family metadata in `lib/families.ts` (family keys collide across providers; both Google and Polly ship a "Standard"). The bare upstream `/voices` endpoint returns every provider the AI TTS Microservice carries; anything unblessed is console-logged (`catalog refresh: unblessed provider ...`) and dropped. Blessing requires honest copy and a real browser playback pass, so it stays a human act.
- Blessed today: google (4,586 voices), polly (177), kokoro (54). `scripts/build-data.mjs` keeps its own BLESSED list in step with the config.

## Catalog data flow

1. `lib/catalog.ts#getSite()` is the single entry point. `livePacked()` fetches the bare `GET /voices` (all providers, one call), groups by the `provider` field, drops unblessed providers with a warning, and packs the rest.
2. Validation before adoption: every voice id must be reconstructable as `{provider}:{language}-{Family}-{Name}`, and each blessed provider present in the committed fallback must come back at 80 percent strength or the whole fallback is used. A provider blessed before its first data refresh has no yardstick and passes on live data alone. Every rejection logs a `catalog refresh` warning.
3. `data/voices.packed.json` (version 4) is the committed seed and fallback: `{providers: {key: {models, voices}}}` with one tuple per voice, `[language, family, name, gender(f|m|n|u), tier(p|u), stylesCsv]`. `scripts/build-data.mjs` regenerates it in one API call.
4. The all-provider response is about 2.9MB, which is over the Next data cache's 2MB item limit; the fetch cache stores nothing (the build logs "items over 2MB can not be cached"). The process memo is therefore the effective cache: the built site (per-provider catalogs, site-wide byId, umbrella stats) is held six hours per process, keyed by source (live or fallback) plus date and count. `/api/sample` uses a fresh-floor variant (`getSiteFresh`, 60s) when an id misses, so a voice that appeared upstream is playable without waiting out the memo; the floor keeps id-guessing from becoming an upstream fetch storm.

Pages export `revalidate = 86400`. `/[provider]` uses `dynamicParams = false` (unknown providers 404 at routing); `/[provider]/voices/[lang]` uses `dynamicParams = true` so a new upstream language renders on first request, and therefore validates both params itself and calls `notFound()` (routing alone cannot 404 `/bogus/voices/en-US`).

Sub-model lists ride the same pipe: each provider's `models` map is built from `available_models`. Google's Gemini is the only multi-model family today; the Explorer's control is generic (first family with more than one model) so a second one just works.

## Routing and redirects

- `/` is the umbrella homepage: provider cards, aggregate stats, about. No voice list.
- `/{provider}` is a full provider home: hero with section jump links, family tiles, language grid, about, voice list last.
- `/{provider}/voices/{lang}` are the SSR language pages.
- Google lived at the root before the umbrella. `next.config.ts` issues permanent redirects (Next answers **308**, the method-preserving permanent code): `/voices/:lang` to `/google/voices/:lang`, and `/` to `/google` when any explorer query param is present. `has` entries AND together, so that second rule is five rules, one per param (family, language, gender, gmodel, q); query strings pass through automatically.
- Masthead nav (`MastNav`, client, `usePathname`) is global provider tabs with the active provider underlined. Section wayfinding lives in each page's hero jump links, so the masthead never needs to know a page's sections.

## Sample playback

Samples are never synthesized here and never cost credits. The upstream `sample-url` endpoint mints a signed 24 hour GCS URL, generating the sample on first request (202 with `retry_after` while it works). Verified for all three providers in a real browser.

Server, `app/api/sample/route.ts`, in order:

1. Per-IP token bucket (`lib/ratelimit.ts`): burst 30, then 30 a minute, answers 429 with Retry-After. A sanity guard on the one non-static route, generous enough that a person never meets it; x-forwarded-for is spoofable, so it is not security. The shared upstream budget (~1000 sample-url calls a rolling hour) is protected by the next layer, not this one.
2. Voice id validated against the site-wide byId map (all providers), with the fresh-floor refetch on miss; optional `model` validated against that voice's provider models map.
3. Signed URLs cached 20 hours with in-flight coalescing; `{url}` on success; upstream 202 relayed as `{status:"generating", retry_after}`; upstream 429 mapped to 503 with Retry-After.

Client, in `Explorer.tsx`: `play()` resolves blob cache (module LRU, 24 object URLs), then URL cache (18 hour TTL), then `/api/sample` with up to three retries on 202 ("preparing sample"). The first streamed play warms the blob cache in the background, which is what makes replays instant and network-free on Safari. A `playGen` counter guards every async step against stale callbacks; `ontimeupdate` marks playing where Safari fails to fire `onplaying`; a dead object URL falls back to the network once; a failed signed URL is dropped from cache. 429 and 503 both show "busy, try again in a minute". Cache keys are full voice ids, so providers never collide.

## Page structure invariants

- Provider pages render hero, families, languages, about, and the voice list LAST. The list loads client side, grows by tens of thousands of pixels, and keeps re-measuring under `content-visibility: auto`, so every anchor target must sit above it. Do not move sections below the list.
- Language pages server-render their rows for SEO through `ExplorerList` (no `useSearchParams`). Provider pages wrap `Explorer` in Suspense because `useSearchParams` client-renders up to the nearest boundary. Keep that split.
- `.explorer` carries both its own class and `.shell`; it must only use longhand padding so the shell's side gutters survive. The toolbar grid has 5, 4 and 3 column variants driven by which filters apply; the family filter label uses the provider's own word (ENGINE on /polly).
- `.fam-grid` follows the tile count below five columns (`fam-grid-4` … `fam-grid-1`) so providers with few families show no dead cells.
- URL state on provider pages: `?family=`, `?language=`, `?gender=`, `?gmodel=`, `?q=` are applied from the URL on navigation and written back with `replaceState`. A field the reader touched since the last apply is left alone.

## SEO and agent surface

- Metadata, Open Graph and JSON-LD counts derive from the catalog at render time. Titles are unique per provider and language ("Amazon Polly English (Wales) voices"); the root is the umbrella.
- `app/llms.txt/route.ts` regenerates daily: provider list with counts, the id pattern, the packed format, the sample endpoint's 202 behavior.
- `app/robots.ts` allows `/api/catalog` (which prefix-covers the per-provider slices) and `/api/sample`, disallows the rest of `/api/`.
- `app/sitemap.ts` lists the umbrella, each provider home, and every language page (148 URLs today).
- `/api/catalog/[provider]` serves each provider's packed slice (force-static, daily, prerendered for the blessed set). Per-provider on purpose: google is about 95 percent of the payload and the smaller shelves should not pay for it.

## Caches at a glance

| Layer | Where | Lifetime |
| --- | --- | --- |
| Voice list fetch | Next data cache | refused: payload over the 2MB item limit |
| Built site memo | server process | 6 h (60 s floor for miss-triggered refresh) |
| Signed sample URLs | server process map | 20 h |
| Signed sample URLs | client module map | 18 h |
| Sample audio blobs | client module LRU | session, 24 entries |
| Rate limit buckets | server process map | idle-swept after 10 min |
