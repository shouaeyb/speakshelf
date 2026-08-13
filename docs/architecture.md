# Architecture

How Speakshelf works, and the invariants that keep it working. Update this file in the same commit as any change that makes it stale.

## The shape

Next.js 16 App Router, classic caching model (cacheComponents is off), TypeScript, no UI libraries, no Tailwind. One interactive component (`components/Explorer.tsx`), a small server catalog library (`lib/catalog.ts`), two API routes, and static pages around them.

## Catalog data flow

The catalog feeds itself. Nothing about voices, languages, families or sub-models is hardcoded.

1. `lib/catalog.ts#getCatalog()` is the single entry point. It asks `livePacked()` for the current voice list, which fetches `GET /voices?provider=google` from the AI TTS Microservice with `next: { revalidate: 86400 }`, so the Next data cache refreshes it at most daily.
2. The response is validated before adoption: the voice id must still be reconstructable as `google:{language}-{Family}-{Name}`, and the list must be at least 80 percent of the committed fallback's size, so a truncated response can never shrink the site. Every rejection logs a `catalog refresh` warning and falls back.
3. `data/voices.packed.json` (version 3) is the committed seed and fallback: a `models` map of sub-model ids per family plus one tuple per voice, `[language, family, name, gender(f|m|n|u), tier(p|u), stylesCsv]`. `scripts/build-data.mjs` regenerates it in one API call.
4. Derived views (byId map, language summaries, family summaries, stats) are memoized per process for five minutes, keyed by source (live or fallback) plus date and count, so request-path callers never pay the two megabyte JSON parse, and a fallback served during an outage is replaced as soon as the live fetch recovers.

Pages export `revalidate = 86400`; `/voices/[lang]` also sets `dynamicParams = true`, so a language that appears upstream gets a page on first request. The client explorer fetches `/api/catalog` (force-static, daily) and falls back to the bundled copy if that fails.

Sub-model lists ride the same pipe: the `models` map is built from each voice's `available_models`. Gemini is the only multi-model family today. `lib/families.ts` holds display labels and blurbs for known families and a `modelLabel()` formatter that makes unknown future ids presentable. Unknown families still get a tile, a filter option and correct sample math; only their blurb is generic.

## Sample playback

Samples are never synthesized here and never cost credits. The upstream `sample-url` endpoint mints a signed 24 hour GCS URL, generating the sample on first request (202 with `retry_after` while it works).

Server, `app/api/sample/route.ts`: validates the voice id and optional `model` against the catalog, caches signed URLs for 20 hours with in-flight coalescing, answers `{url}`, relays upstream 202 as `{status:"generating", retry_after}` with HTTP 202, maps upstream 429 to 503 with Retry-After.

Client, in `Explorer.tsx`: `play()` resolves in this order.

1. Blob cache hit: play the object URL, zero network. Module-level LRU of 24 entries.
2. URL cache hit (module level, 18 hour TTL): stream the signed URL.
3. `/api/sample` lookup, with up to three retries on 202 while showing "preparing sample".

The first successful streamed play warms the blob cache in the background (the refetch is an HTTP cache hit, GCS serves the audio with a long max-age). This is what makes replays instant and network-free on Safari, which does not reuse its media cache well. A `playGen` counter guards every async step against stale callbacks; `ontimeupdate` marks the playing state where Safari fails to fire `onplaying`; a dead object URL falls back to the network path once; a failed signed URL is dropped from cache.

## Page structure invariants

- The home page renders hero, families, languages, about, and the voice list LAST. The list loads client side, grows by tens of thousands of pixels, and keeps re-measuring under `content-visibility: auto`, so every anchor target must sit above it. Do not move sections below the list.
- Language pages server-render their rows for SEO through `ExplorerList` (no `useSearchParams`). The home page wraps `Explorer` in Suspense because `useSearchParams` client-renders up to the nearest boundary. Keep that split.
- `.explorer` carries both its own class and `.shell`; it must only use longhand padding so the shell's side gutters survive. The toolbar grid has 5, 4 and 3 column variants driven by which filters apply.
- URL state: `?family=`, `?language=`, `?gender=`, `?gmodel=`, `?q=` are applied from the URL on navigation and written back with `replaceState`. A field the reader touched since the last apply is left alone, so typing during catalog load is never wiped.

## SEO and agent surface

- Metadata, Open Graph and JSON-LD counts derive from the catalog at render time.
- `app/llms.txt/route.ts` regenerates daily and documents the catalog tuple format and the sample endpoint.
- `app/robots.ts` allows exactly `/api/catalog` and `/api/sample` and disallows the rest of `/api/`.
- `app/sitemap.ts` lists the home page and every language page.

## Caches at a glance

| Layer | Where | Lifetime |
| --- | --- | --- |
| Voice list fetch | Next data cache | 24 h revalidate |
| Built catalog memo | server process | 5 min |
| Signed sample URLs | server process map | 20 h |
| Signed sample URLs | client module map | 18 h |
| Sample audio blobs | client module LRU | session, 24 entries |
