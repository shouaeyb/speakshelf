# Decision log

Settled decisions, newest first. Append a dated entry when something gets decided; correct an old entry by appending, not rewriting. Do not relitigate these silently: if you believe one is wrong, say so to the owner with evidence.

## 2026-08-13: providers go live by blessing; the machinery is generic

The multi-provider shelf shipped with Amazon Polly (177 voices) and Kokoro (54) beside Google (4,586). Data, routing, playback and SEO surfaces are generic over a provider dimension, but a provider only goes live through the curated config in `lib/providers.ts` (copy, family metadata, the provider's own vocabulary) plus a refreshed data pack and a real browser playback pass. The bare `/voices` endpoint reports every provider upstream; unblessed ones are console-logged and stay invisible. The owner explicitly declined webhook or CI alerting for newcomers: logs are enough. Rationale: honest copy and verified playback cannot be automated, and a provider appearing on the site should never be a surprise.

## 2026-08-13: umbrella at the root, Google under /google, permanent redirects are 308

The umbrella homepage lives at `/` (provider cards, aggregate stats, no voice list). Google's whole section moved to `/google` with permanent redirects from every old URL: `/voices/:lang` to `/google/voices/:lang`, and `/` to `/google` whenever an explorer-specific query param is present (four separate `has` rules for family, language, gender, gmodel, since `has` entries AND together; `q` is excluded on review, too generic a name to bind permanently to /google). Note for the earlier subfolder entry that said "301": Next's `permanent: true` answers **308**, the method-preserving permanent redirect; search engines treat it as permanent the same way. Hash-only anchors can't be redirected server side and nothing was deployed yet, so they are not chased.

## 2026-08-13: catalog serves per-provider slices, and the process memo is the real cache

`/api/catalog/[provider]` replaced the single catalog blob: google is about 95 percent of the payload, and a visitor on /polly or /kokoro should not download 4,586 Google voices to browse 177. Separately, the all-provider upstream response (~2.9MB) is over the Next data cache's 2MB item limit, so the `revalidate` fetch cache silently stores nothing; the process memo (six hours, with a 60 second fresh floor for /api/sample id misses) is the effective catalog cache, and the pages' daily ISR sets the visible refresh cadence.

## 2026-08-13: a generous in-memory rate limit guards the one non-static route

Owner asked for a sanity limit against dumb loops racking server bills. Scope: `/api/sample` only, since every other route is static and rides the CDN. Per-IP token bucket, burst 30 then 30 a minute, 429 with Retry-After, buckets swept when idle. Deliberately not security (x-forwarded-for is forgeable, state resets on deploy) and deliberately not the guardian of the shared upstream sample-url budget; the 20 hour signed-URL cache with coalescing and the 429-to-503 relay already do that. No global limiter: rejected as over-engineering.

## 2026-08-13: name is Speakshelf, domain speakshelf.com

"Voice Atlas" collided with existing products (voiceatlas.com among others). Out of 44 checked .com candidates, 9 were unregistered; the owner picked speakshelf.com over voxroster.com and voxcensus.com. Knockout trademark glance done the same day: no US federal filing live or dead for speakshelf or speak shelf in the indexed register mirrors (nearest marks SPEAKHDL, SPEAKAIR, SPEAKME, all different goods), nothing indexed from EUIPO, no product or company anywhere with the name. A glance is not clearance: before serious brand spend, do a formal USPTO and WIPO search or have an attorney run one.

## 2026-08-13: multi-provider growth uses subfolders on one domain

When Polly, Kokoro, Azure and others arrive: the umbrella home lives at `/`, each provider under a subfolder (`/google`, `/polly`), and the current Google catalog moves to `/google` with 301 redirects for every existing URL. Not subdomains (they earn search trust separately for months) and not separate domains (start at zero, cost the most). Backed by 2026 research: Google treats subdomains as semi-separate properties; G2's own subdomain move took months despite huge site authority.

## 2026-08-13: samples resolve on demand; there is no such thing as a sample-less voice

The upstream `sample-url` endpoint is generation class: it synthesizes a missing sample on first request and answers 202 while it works. The original overnight build misread those 202s as "no sample" and shipped dash placeholders for 952 voices; all 4,586 voices proved playable. The `hasSample` flag was removed from the data format, every voice gets a play button, and the UI shows "preparing sample" with auto-retry when it catches a 202. Any future probe or refresh script must treat 202 as pending, never as absent.

## 2026-08-13: catalog is data-driven and self-refreshing

No hardcoded voice, language, family, or sub-model lists anywhere. The server refetches the live catalog daily with the committed packed file as seed and fallback (with a sanity floor). Gemini's sub-models come from `available_models`. Cost of a new Google model appearing upstream: zero code changes. This was an explicit owner requirement.

## 2026-08-13: playback caching copies tts-microutil's good half only

The owner's other product at `/Users/me/mDevs/tts-microutil` validated the pattern in production: stream the first play from the signed URL, then warm an in-memory blob cache so replays are local object URLs, which is what Safari needs. Copied: that two-step, the staleness counter, warm-after-first-play. Deliberately not copied: its four unsynchronized cache layers, the dead v2 hook, the localStorage cache written by nothing.

## 2026-08-13: the voice list renders last on the home page

The list is huge, loads client side, and re-measures under content-visibility, so anchors below it can never land reliably (measured drift of tens of thousands of pixels). Sections order: hero, families, languages, about, list. Anchor fixes via scroll hacks were tried and rejected.

## 2026-08-13: SEO scope

Ship: llms.txt (daily regenerated), robots open for exactly the two public API paths, JSON-LD WebSite and CollectionPage, sitemap, dynamic metadata. Skip on purpose: per-sample AudioObject and ItemList markup (no consumer in 2026, pure bloat), Dataset markup (scope misuse), speakable (beta, articles only). Deferred: IndexNow until the real domain exists.

## 2026-08-13: money and key rules

`POST /tts` is never called by this codebase or by any agent working on it; it spends real credits. Everything the site does is free (listing, sample-url). The API key stays server side, gitignored, and out of logs. The balance was checked before and after the entire build: unchanged at $147.64.

## 2026-08-13 (overnight build, 1am to 4:30am): foundations

IBM Carbon-inspired design system, IBM Plex via next/font, square corners, one blue. Human copy everywhere: no em dashes, no AI phrasing. Next.js App Router with SSG for language pages and a client-loaded home list. Design-first flow through a Claude Design mockup, then ported to the app.
