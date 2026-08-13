# Decision log

Settled decisions, newest first. Append a dated entry when something gets decided; correct an old entry by appending, not rewriting. Do not relitigate these silently: if you believe one is wrong, say so to the owner with evidence.

## 2026-08-13: name is Speakshelf, domain speakshelf.com

"Voice Atlas" collided with existing products (voiceatlas.com among others). Out of 44 checked .com candidates, 9 were unregistered; the owner picked speakshelf.com over voxroster.com and voxcensus.com. Knockout trademark glance done the same day: no US federal filing live or dead for speakshelf or speak shelf in the indexed register mirrors (nearest marks SPEAKHDL, SPEAKAIR, SPEAKME, all different goods), nothing indexed from EUIPO, no product or company anywhere with the name. A glance is not clearance: before serious brand spend, do a formal USPTO and WIPO search or have an attorney run one.

## 2026-08-13: multi-provider growth uses subfolders on one domain

When Polly, Kokoro, Azure and others arrive: the umbrella home lives at `/`, each provider under a subfolder (`/google`, `/polly`), and the current Google catalog moves to `/google` with 301 redirects for every existing URL. Not subdomains (they earn search trust separately for months) and not separate domains (start at zero, cost the most). Backed by 2026 research: Google treats subdomains as semi-separate properties; G2's own subdomain move took months despite huge site authority.

## 2026-08-13: samples resolve on demand; there is no such thing as a sample-less voice

The upstream `sample-url` endpoint is generation class: it synthesizes a missing sample on first request and answers 202 while it works. The original overnight build misread those 202s as "no sample" and shipped dash placeholders for 952 voices; all 4,586 voices proved playable. The `hasSample` flag was removed from the data format, every voice gets a play button, and the UI shows "preparing sample" with auto-retry when it catches a 202. Any future probe or refresh script must treat 202 as pending, never as absent.

## 2026-08-13: catalog is data-driven and self-refreshing

No hardcoded voice, language, family, or sub-model lists anywhere. The server refetches the live catalog daily with the committed packed file as seed and fallback (with a sanity floor). Gemini's sub-models come from `available_models`. Cost of a new Google model appearing upstream: zero code changes. This was an explicit owner requirement.

## 2026-08-13: playback caching copies tts-microutil's good half only

The owner's other product (`/Users/me/mDevs/tts-microutil`, the AI TTS Microservice repo) validated the pattern in production: stream the first play from the signed URL, then warm an in-memory blob cache so replays are local object URLs, which is what Safari needs. Copied: that two-step, the staleness counter, warm-after-first-play. Deliberately not copied: its four unsynchronized cache layers, the dead v2 hook, the localStorage cache written by nothing.

## 2026-08-13: the voice list renders last on the home page

The list is huge, loads client side, and re-measures under content-visibility, so anchors below it can never land reliably (measured drift of tens of thousands of pixels). Sections order: hero, families, languages, about, list. Anchor fixes via scroll hacks were tried and rejected.

## 2026-08-13: SEO scope

Ship: llms.txt (daily regenerated), robots open for exactly the two public API paths, JSON-LD WebSite and CollectionPage, sitemap, dynamic metadata. Skip on purpose: per-sample AudioObject and ItemList markup (no consumer in 2026, pure bloat), Dataset markup (scope misuse), speakable (beta, articles only). Deferred: IndexNow until the real domain exists.

## 2026-08-13: money and key rules

`POST /tts` is never called by this codebase or by any agent working on it; it spends real credits. Everything the site does is free (listing, sample-url). The API key stays server side, gitignored, and out of logs. The balance was checked before and after the entire build: unchanged at $147.64.

## 2026-08-12 (overnight build): foundations

IBM Carbon-inspired design system, IBM Plex via next/font, square corners, one blue. Human copy everywhere: no em dashes, no AI phrasing. Next.js App Router with SSG for language pages and a client-loaded home list. Design-first flow through a Claude Design mockup, then ported to the app.
