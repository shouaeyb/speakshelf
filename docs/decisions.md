# Decision log

Settled decisions, newest first. Append a dated entry when something gets decided; correct an old entry by appending, not rewriting. Do not relitigate these silently: if you believe one is wrong, say so to the owner with evidence.

## 2026-08-13: internationalization shipped for eight locales

The direction entry below became real the same day: umbrella, provider and language pages in en, es, zh, hi, fr, bn, pt and ru (1,180+ prerendered pages), full hreflang/sitemap reciprocity, suggestion banner, footer switcher, localized search terms. Hard-won build lesson recorded for the next agent: the proxy may import only i18n/routing.ts; navigation helpers and the request config (which reads the locale from next/root-params) live in separate modules because bundling them into the middleware both breaks the build and silently turns every page dynamic. Translations are AI-written and pending the owner's review, as decided. The peer reviewer's post-ship pass (gpt-5.6-sol, resumed session) surfaced seven real defects, all fixed and verified the same day; two glossary rules were tightened by it: Polly's engine identifiers (standard, neural, generative, long-form) stay verbatim English inside translated prose exactly as they do on the tiles, and grammatical composition (measure words, case) always lives inside per-locale messages, never in code that concatenates a count with a word.

## 2026-08-13: search stays UI-only and becomes complete; fuzzy waits for evidence

Search never touches an API: the catalog is already client-loaded and stays that way. The fix for "can't search gender/tier/styles/anything future": one memoized search document per voice built automatically from every field and trait, so new characteristics are searchable by construction; queries tokenize and AND together ("female child" works); diacritics are stripped on both sides; a pasted full voice id resolves to its exact row. Display stays grouped by language. Fuse.js was considered (the owner's other product uses it) and deliberately deferred: the search_used analytics will show real zero-result queries, and the fuzzy layer gets added if typos show up in evidence, not speculation. Peer-reviewed by kiro gpt-5.6-sol.

## 2026-08-13: internationalization direction (owner decisions)

Owner decisions, recorded before the build: browser-language handling is a one-tap suggestion banner in the visitor's language, never a hard redirect (crawler-safe, Google-guidance-aligned). Launch locales are the world's most spoken languages minus right-to-left: es, zh, hi, fr, bn, pt, ru beside default en; Arabic and other RTL wait for a dedicated RTL pass the owner will review jointly. English URLs stay byte-for-byte unchanged (as-needed locale prefix; /en variants redirect to clean paths). next-intl is the machinery (pinned after a compat spike): plurals, interpolated counts and rich text outgrow a hand-rolled t(). Protected names never translate: voice names, family/engine names, provider names, Speakshelf, AI TTS Microservice, codes and ids; language names localize via Intl. llms.txt and the OG card stay English. Translations are AI-written and honestly marked owner-review-pending; expansion beyond the set is one locale at a time. The peer reviewer is kiro gpt-5.6-sol, session 1ff1dd9c-49b6-48f7-a499-58495f3c2f14, resumed with --resume-id for continuity until this work completes.

## 2026-08-13: sample audio hosts are an allowlist, with R2 pre-added

Playback is host-agnostic everywhere except the production CSP, which allowlists where audio may load from. The owner confirmed samples will soon also live on Cloudflare R2, so both R2 host shapes are pre-added (`*.r2.dev` public buckets, `*.r2.cloudflarestorage.com` presigned URLs, per Cloudflare's docs). Custom domains cannot be predicted, so `/api/sample` carries a tripwire: the first sample URL from a host outside the allowlist logs a loud server warning naming the host, before visitors ever hit the CSP wall.

## 2026-08-13: trait tags, a first-play quirk toast, and a cosmetic consent bar

Three owner calls in one round. Child voices show as a gray CHILD tag beside the family tag, not a parenthetical in the gender cell; trait tags are exempt from the mobile tag-hide because a rare trait matters more than a repeated family name. The Gemini accent note additionally appears as a one-time-per-session toast on the first play of a noted family's voice, because the top-of-list note is off screen once a reader scrolls into a long list; the toast is the Carbon notification shape, auto-dismisses, and never repeats in a session. A consent bar mirrors the tts-microutil V2 posture: shown until the visitor picks Accept all or Necessary only, the true choice is stored, and nothing gates on it yet; `applyConsent` in lib/consent.ts is the single seam where the owner's legal team's rules will land, and there is deliberately no settings link to reopen it (resetConsent exists in code for that future).

## 2026-08-13: voice traits are retained, not dropped

The owner caught the packed format silently dropping voice characteristics: Amazon Polly's child voices (Ivy, Justin, Kevin, marked age "child" by the API and "Female (child)" in AWS's own table) rendered as plain female or male here. The tuple gained an optional seventh slot carrying non-style characteristics keyed exactly as the API keys them; it turned out to also preserve per-voice pitch on 2,610 Google rows. Displayed today: age only ("female (child)" in the voice row, searchable). Pitch, accent, use_case and roles are retained in data and the catalog API but not yet surfaced; Azure's richer characteristics will flow through the same slot when that provider lands. Principle: the pack never discards a characteristic the API provides, and display grows deliberately, not automatically.

## 2026-08-13: analytics are always-on pass-through; the owner's legal owns the posture

Mixpanel (autocapture, 100 percent session replay) and GA4 run for every visitor with no consent gate, by the owner's explicit decision; their legal team is working the compliance posture and will dictate whatever consent surface follows. Costs flagged and accepted: full replay is a standing data-volume commitment, and ignore_dnt is on. Implementation follows the proven tts-microutil pattern where it earns its keep (single vendor-boundary module, query-stripped page locations) and skips its scale (no consent UI, no governance registry, no identity hashing: this site has no accounts). The GA measurement id supplied was numeric; GA4 web streams use a G- prefixed id, so gtag loads but sends nothing until the owner swaps the real id into .env (verified live: zero collect beacons).

## 2026-08-13: security headers with a deliberately boring CSP

Every route ships X-Frame-Options DENY, nosniff, strict-origin-when-cross-origin, COOP same-origin, and a Permissions-Policy denying microphone, camera and geolocation; production adds HSTS and a CSP. The CSP keeps `script-src 'unsafe-inline'`: it is load-bearing for the pages' inline JSON-LD blocks, so it must not be misread as analytics-only and "tightened" away later. Known accepted gap, recorded on the reviewer's advice: without nonces, unsafe-inline means CSP does not stop script injection if an XSS ever exists; this site renders no user-supplied HTML, so nonce plumbing was rejected as over-engineering. Verified against a production build: playback, session replay and beacons run with zero violations.

## 2026-08-13: the roadmap belongs to the owner

The parking lot is gone and stays gone: agent ideas do not get stored in the owner's planning docs. Unadopted proposals die in conversation; docs/roadmap.md carries owner direction only. Same day, the previously parked scale concerns the owner did adopt were built: masthead collapse, hero name cap, share name cap.

## 2026-08-13: share surfaces carry no counts

Share platforms (Twitter, WhatsApp, Slack, iMessage) cache link previews for days or weeks, so any number on og.png or in og/twitter descriptions goes stale in the wild no matter how it is generated; even a dynamically rendered card cannot beat the platform cache. The og.png card and all og/twitter descriptions are therefore timeless: name, provider list, the sample promise, no counts. Counts stay in SEO meta descriptions and on the pages themselves, which crawlers re-fetch. The card names the blessed providers, so regenerating it (scratchpad og.html pattern) is one step of the provider blessing ritual.

## 2026-08-13: a voice is a provider voice-list entry; a sample is a playable render

The owner caught the site counting Polly's 177 per-engine rows as 177 voices while counting Gemini's per-sub-model takes as samples: the same concept, two treatments. Settled definition: a voice is one entry in the provider's own published voice list, a sample is one playable render of it, and the mapping is per provider (`voiceIdentity` in the bless config). Google's list counts every language+family+name row (en-US-Standard-A and en-US-Wavenet-A are distinct voices in Google's docs), so google stays row-counted at 4,586. AWS's Available Voices table lists a voice once per language with engines as capability columns, so polly counts distinct language+name: 113 voices, 177 samples. Kokoro is flat: 54 and 54. Cross-language name reuse is counted once per language, matching both providers' own tables (AWS lists bilingual Aditi under both of its languages; Google lists Achernar per language). Site totals became 4,753 voices, 12,647 samples. Grouping Polly's list rows by voice with a per-row engine picker was considered and parked: the flat per-engine rows keep every render directly playable and comparable.

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

## 2026-08-13: router scrolls opt out of smooth scrolling

Clicking between pages landed short of the top while pasted URLs landed clean. Next 16 stopped suppressing CSS `scroll-behavior: smooth` during its scroll-to-top on navigation unless the html element carries `data-scroll-behavior="smooth"`; without it the scroll became an animation whose own follow-up check cut it short around the masthead's height. The attribute now sits on the html element in the locale layout, and smooth stays for in-page anchor jumps, which never enter the router. Two guardrails for future work. Never add `scroll-padding-top` to html: the router reads it for its in-viewport check and it reintroduces the same landing-short bug even with the attribute present; per-target `scroll-margin-top` is the house pattern. And browser tests must scroll with `behavior: "instant"` in setup steps, because plain `window.scrollTo` animates under the smooth rule and a click mid-animation measures garbage.

## 2026-08-13: locale switches keep the reader's place

The suggestion strip and the footer switcher replace to the same page in the new language with `scroll: false`; a language switch is the same page, so the reader keeps their spot. Known limit, accepted: the voice list renders under content-visibility auto, so an incoming page's height starts near an estimate and grows as the browser measures it, and a reading position deeper than that early height gets clamped mid-transition (measured: deep on the Google shelf lands near y 2250). That clamp comes with every client navigation regardless of scroll options, and the clamped spot is still closer to the reader's place than the top would be. The same mechanism leaves a residue of about 11px after some navigations while the language strip is mounted; it clips only the strip's own top edge, never content.

## 2026-08-13: the app owns its navigation glide

Making router scrolls instant (earlier today) fixed the landings but killed the glide the owner wanted, and Next has no supported smooth navigation scroll: the issue asking for one (#51721) was closed by the PR that added the suppression. So the app owns the animation. The Link that everything imports from i18n/navigation wraps the next-intl Link with Next scrolling off; a plain primary-button click on it records one glide intent (destination pathname, search, hash), and a same-document destination glides immediately, which is how the wordmark at home and the active masthead tab return to top. ScrollGlide, mounted once in the locale layout behind Suspense, lets the first route commit consume the intent, and only a commit matching the intent's URL glides, animating to the hash target or the top; a mismatched commit (a superseded click, a redirect) just drops it. Back and forward, the Explorer's replaceState writes and the locale switchers record no intent, so browser restoration and keep-your-place survive untouched. That intent gate is load-bearing: installed Next 16.3 mirrors external replaceState into useSearchParams (its patched history dispatches a restore action), so a manager reacting to route keys alone would glide on every search keystroke. The html attribute and the CSS smooth rule stay: native in-page anchors keep their animation, and any navigation that slips past the wrapper lands instant and correct rather than animated and short. Readers with reduced motion get instant scrolls through a media query the glide helper also respects. Verified headless on the production build: twelve-case matrix asserting animated trajectories frame by frame, exact landings, quiet back button, kept locale-switch position, one real playback.

## 2026-08-13: counts format through ICU everywhere, and the hero names shelves like the share card

The owner caught the hero heading showing a raw 4753 while the stat cells under it grouped correctly. Root cause: bare {arg} placeholders render digits unformatted; only {arg, number} and plural # group per locale. Every bare numeric placeholder across all eight locale files now carries the number format (fourteen keys; familiesCount stays bare because the code pre-formats it). One nuance to leave alone: Spanish groups only from five digits, so "4753 voces" next to "12.647" is correct CLDR typography, not a miss.

The hero subtitle and the home JSON-LD now follow the pattern the owner set explicitly: the first three shelves as a bare comma list, each locale's message closing the list itself ("and more", "y más", "等提供商"); the subtitle starts a fresh sentence after, the JSON-LD continues after a comma. The counted "and N more" variant is gone. With exactly three shelves shipped the closing phrase already reads "and more"; review flagged that as a forward claim, and the owner kept the wording deliberately, with the fourth provider in the works. The list joins in listNamesPlain with a plain comma, enumeration comma for zh; Intl.ListFormat was rejected there because its unit type concatenates zh names with no separator and its conjunction styles double the message's own closing conjunction in es and hi.
