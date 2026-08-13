# Architecture

How Speakshelf works, and the invariants that keep it working. Update this file in the same commit as any change that makes it stale.

## The shape

Next.js 16 App Router, classic caching model (cacheComponents is off, and stays off: `dynamicParams` on the language pages depends on it), TypeScript, no UI libraries, no Tailwind. One interactive component (`components/Explorer.tsx`), a small client nav (`components/MastNav.tsx`), an analytics boundary (`lib/analytics.ts` + `components/Analytics.tsx`), a server catalog library (`lib/catalog.ts`), a provider bless config (`lib/providers.ts`), two API route families, and static pages around them. Files stay small (hard cap 1,000 lines, aim far below); split along module seams before a file bloats.

## Analytics

`lib/consent.ts` + `components/ConsentBanner.tsx` show a one-time consent bar (choice stored in localStorage, no reopen UI); nothing gates on it yet, and `applyConsent` is the only place real gating may ever be added. `lib/analytics.ts` is the sole vendor boundary: nothing else imports mixpanel-browser or touches gtag. Mixpanel runs with autocapture and 100 percent session replay; GA4 loads gtag.js with a queued stub (no inline script) and gets one page_view per route change from `components/Analytics.tsx`. Page locations and referrers are query-and-hash-stripped before emission (the tts-microutil pattern): here that is pageview-dimension hygiene, since the explorer keeps filter state in the query string. Precision events beside autocapture: sample_played (with cache tier memory|cached|network), sample_failed, sample_generating, filter_changed, search_used (debounced), provider_opened. Always-on by the owner's decision; their legal owns the consent posture (see decisions). Ids live in `.env` as NEXT_PUBLIC_ vars, baked into the client bundle at build, public by nature.

## Security headers

`next.config.ts` sets on every route: X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, COOP same-origin, Permissions-Policy denying microphone/camera/geolocation, plus HSTS and a CSP in production only (dev needs HMR's unsafe-eval). CSP notes that matter: `script-src 'unsafe-inline'` is load-bearing for the pages' inline JSON-LD, not just analytics; `style-src 'unsafe-inline'` covers next/font's injected font-face styles; `worker-src 'self' blob:` and the mixpanel hosts carry session replay. Sample audio hosts are an allowlist in connect-src (blob warm fetch) and media-src (the audio element): GCS today plus Cloudflare R2 (`*.r2.dev`, `*.r2.cloudflarestorage.com`) pre-added for the owner's planned move. INVARIANT: if the AI TTS Microservice starts minting sample URLs from any other host (a custom domain included), production playback is CSP-blocked until next.config.ts adds that host; `/api/sample` warns in the server log the first time it sees an unlisted host, so watch for `sample audio host` warnings. Verified against a production build: playback, replay recording and event beacons all clean of violations.

## The provider dimension

Everything is generic over providers; going live is not. The split is deliberate:

- **Machinery is generic.** Data (`packed v4` keyed by provider), routing (`/[provider]`, `/[provider]/voices/[lang]`), playback (voice ids carry the provider prefix), sitemap, llms.txt and metadata all iterate the blessed set. Nothing anywhere hardcodes "google" except redirects for the pre-umbrella URLs.
- **Going live is a blessing.** `lib/providers.ts` is the one place a provider becomes real: key, display names, hero and about copy, the word it uses for its voice groupings ("model families" for Google, "engines" for Polly), plus per-provider family metadata in `lib/families.ts` (family keys collide across providers; both Google and Polly ship a "Standard"). The bare upstream `/voices` endpoint returns every provider the AI TTS Microservice carries; anything unblessed is console-logged (`catalog refresh: unblessed provider ...`) and dropped. Blessing requires honest copy and a real browser playback pass, so it stays a human act.
- **Voices are counted the provider's way.** A voice is one entry in the provider's own published voice list; a sample is one playable render. The bless config's `voiceIdentity` says which: `row` for google and kokoro (Google's list counts every language+family+name), `langName` for polly (AWS's table lists a voice once per language with engines as capability columns, so the API's per-engine rows are renders of one voice: 177 rows, 113 voices). Cross-language name reuse (Google's Achernar in 87 languages, Polly's bilingual Aditi) stays counted per language because both providers' own tables do that. The explorer still lists one row per render; only counts collapse.
- Blessed today: google (4,586 voices), polly (177), kokoro (54). `scripts/build-data.mjs` keeps its own BLESSED list in step with the config.

## Internationalization

Eight locales (en default, plus es, zh, hi, fr, bn, pt, ru; RTL waits for its own design pass). English lives byte-for-byte at the original unprefixed URLs, an invariant; other locales are path-prefixed (/es/google), and /en variants 308 to the clean path. next-intl carries the machinery: `i18n/routing.ts` (defineRouting, as-needed prefix, detection off) is the only i18n module the proxy may import; `i18n/navigation.ts` (locale-aware Link/router) and `i18n/request.ts` (locale via next/root-params, messages per locale) must never be pulled into the middleware bundle, or the build breaks and pages go dynamic. All prose lives in `messages/<locale>.json`, one file per locale with identical key sets (a missing key throws at runtime); protected names never translate (voice, family, engine and provider names, Speakshelf, AI TTS Microservice, codes, ids). Language display names localize through Intl.DisplayNames, list conjunctions through Intl.ListFormat, numbers through toLocaleString(locale). Every page emits a self-canonical plus the complete reciprocal hreflang set with x-default at English, mirrored in the sitemap's alternates. Browser language never redirects: a one-tap suggestion strip in the visitor's own language (strings in i18n/locales.ts, deliberately in the target language) offers the switch once and remembers any answer; the footer carries a locale select. Search documents rebuild per locale and carry localized and English terms side by side, so "femenino" and "female" both work. llms.txt and the OG card stay English. Analytics events keep stable English names with the locale as a dimension.

## Catalog data flow

1. `lib/catalog.ts#getSite()` is the single entry point. `livePacked()` fetches the bare `GET /voices` (all providers, one call), groups by the `provider` field, drops unblessed providers with a warning, and packs the rest.
2. Validation before adoption: every voice id must be reconstructable as `{provider}:{language}-{Family}-{Name}`, and each blessed provider present in the committed fallback must come back at 80 percent strength or the whole fallback is used. A provider blessed before its first data refresh has no yardstick and passes on live data alone. Every rejection logs a `catalog refresh` warning.
3. `data/voices.packed.json` (version 4) is the committed seed and fallback: `{providers: {key: {models, voices}}}` with one tuple per voice, `[language, family, name, gender(f|m|n|u), tier(p|u), stylesCsv, traitsJson?]`. The optional seventh slot carries non-style characteristics exactly as the API keys them (age, pitch, accent, use_case, roles) and only when non-empty: Polly's child voices and Google's per-voice pitch ride there today, and Azure's roles will land without a format change. The UI currently surfaces `age` (the gender cell reads "female (child)", searchable); the rest is retained data, served by /api/catalog, awaiting a designed use. `scripts/build-data.mjs` regenerates it in one API call.
4. The all-provider response is about 2.9MB, which is over the Next data cache's 2MB item limit; the fetch cache stores nothing (the build logs "items over 2MB can not be cached"). The process memo is therefore the effective cache: the built site (per-provider catalogs, site-wide byId, umbrella stats) is held six hours per process, keyed by source (live or fallback) plus date and count. `/api/sample` uses a fresh-floor variant (`getSiteFresh`, 60s) when an id misses, so a voice that appeared upstream is playable without waiting out the memo; the floor keeps id-guessing from becoming an upstream fetch storm.

Pages export `revalidate = 86400`. `/[provider]` uses `dynamicParams = false` (unknown providers 404 at routing); `/[provider]/voices/[lang]` uses `dynamicParams = true` so a new upstream language renders on first request, and therefore validates both params itself and calls `notFound()` (routing alone cannot 404 `/bogus/voices/en-US`).

Sub-model lists ride the same pipe: each provider's `models` map is built from `available_models`. Google's Gemini is the only multi-model family today; the Explorer's control is generic (first family with more than one model) so a second one just works.

## Routing and redirects

- `/` is the umbrella homepage: provider cards, aggregate stats, about. No voice list.
- `/{provider}` is a full provider home: hero with section jump links, family tiles, language grid, about, voice list last.
- `/{provider}/voices/{lang}` are the SSR language pages.
- Google lived at the root before the umbrella. `next.config.ts` issues permanent redirects (Next answers **308**, the method-preserving permanent code): `/voices/:lang` to `/google/voices/:lang`, and `/` to `/google` when any explorer query param is present. `has` entries AND together, so that second rule is five rules, one per param (family, language, gender, gmodel, q); query strings pass through automatically.
- Masthead nav (`MastNav`, client, `usePathname`) is global provider tabs with the active provider underlined. Section wayfinding lives in each page's hero jump links, so the masthead never needs to know a page's sections.
- Scale caps, so twenty providers can never break chrome or copy: the masthead names at most four shelves (past that: three plus an "All providers" link), the umbrella hero names at most three then "and N more", cached share lines always name two plus "and more" (one provider: just its name, no claim of more).

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
- Search is client-only through `lib/search.ts`: one document per voice built from every field and trait (future traits searchable by construction), token-AND queries, word-start matching for plain tokens (so "male" never matches female), whole-document substrings for separator tokens (voice-id pastes), diacritics stripped. Fuzzy matching is deferred until search_used analytics show zero-result typos.
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
