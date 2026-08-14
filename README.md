# Speakshelf

A catalog of text to speech voices with samples you can play in the browser: Google Cloud, Amazon Polly and Kokoro, side by side. At last count: 4,753 voices from 3 providers in 105 languages, with more than twelve thousand playable samples once Gemini's one-take-per-sub-model is counted. The site refreshes its own catalog from the API daily, so those numbers grow on their own.

Built with Next.js and styled after IBM's design language: IBM Plex type, sharp corners, thin rules, Carbon blue.

## How it works

- The umbrella homepage at `/` shows one card per provider; each provider keeps a full shelf at `/google`, `/polly`, `/kokoro` (hero, family tiles, language index, the searchable voice list).
- The voice list ships with the repo (`data/voices.packed.json`, one slice per provider), so pages render with no API calls at all. The server refetches the live list daily and falls back to the committed data if the API misbehaves.
- Providers go live by blessing, not by appearing: the upstream API reports every provider it carries, but a new one only ships here after a human adds it to `lib/providers.ts` (copy, family metadata), refreshes the data, and passes a real browser playback check. Unblessed providers are logged and stay invisible.
- Pressing play hits `/api/sample`, which asks the [AI TTS Microservice](https://aitts.theproductivepixel.com) for a signed sample URL and hands it to the browser. Sample lookups are free and the server caches each signed URL for 20 hours. For Google's Gemini voices the route takes a `model` parameter to pick the sub-model. A generous per-IP rate limit guards this one non-static route.
- The first listen for a rare voice can catch the API still preparing that sample. It answers 202, the row shows "preparing sample", and playback starts a few seconds later.
- The API key never leaves the server and nothing here spends synthesis credits, so browsing costs nothing.

## Run it

```bash
npm install
cp .env.example .env   # then paste your TTS_API_KEY
npm run dev
```

`TTS_API_KEY` comes from an [AI TTS Microservice](https://aitts.theproductivepixel.com) account. Without it the site still renders; only sample playback returns errors.

For production, also set `NEXT_PUBLIC_SITE_URL` to your public origin so canonical URLs, the sitemap and Open Graph tags point at the right host. Analytics are optional: set `NEXT_PUBLIC_MIXPANEL_TOKEN` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` (a G-XXXXXXXXXX id from GA Admin, Data streams) and both vendors run always-on; leave them empty and the site tracks nothing.

## Refresh the catalog

```bash
TTS_API_KEY=tts_... node scripts/build-data.mjs
```

Fetches the current voice list for every provider in one API call and rewrites `data/voices.packed.json`. It reports any unblessed provider it sees upstream, so blessing stays a deliberate step.

## Docs

- [docs/architecture.md](docs/architecture.md), how it works and what must not break
- [docs/decisions.md](docs/decisions.md), dated log of settled decisions
- [docs/roadmap.md](docs/roadmap.md), direction and parked ideas
- [docs/design.md](docs/design.md), design system and copy voice
- [AGENTS.md](AGENTS.md), ground rules for AI agents working here

## Pages

- `/` the umbrella: provider cards, aggregate stats, about
- `/google`, `/polly`, `/kokoro` one full shelf per provider, with the explorer
- `/google/voices/[lang]` (and the same under each provider) one page per language, statically generated, e.g. `/google/voices/ko-KR`
- `/voices/[lang]` and old filter links on `/` answer permanent redirects into `/google`
- `/es`, `/zh`, `/hi`, `/fr`, `/bn`, `/pt`, `/ru`, `/id`, `/ar`, `/sw`, `/ja`, `/de`, `/it` mirror every page in thirteen more languages (Arabic right-to-left); English stays unprefixed and /en redirects to the clean paths
- `/sitemap.xml`, `/robots.txt` and `/llms.txt` are generated from the catalog
