# Speakshelf

A catalog of every Google Cloud text to speech voice, with samples you can play in the browser. At last count: 4,586 voices, 93 languages, ten model families from Standard to Gemini, on one page. Gemini voices come in one take per sub-model (four today), which puts the sample count past twelve thousand. The site refreshes its own catalog from the API daily, so those numbers grow on their own.

Built with Next.js and styled after IBM's design language: IBM Plex type, sharp corners, thin rules, Carbon blue.

## How it works

- The voice list ships with the repo (`data/voices.packed.json`), so pages render with no API calls at all.
- Pressing play hits `/api/sample`, which asks the [AI TTS Microservice](https://aitts.theproductivepixel.com) for a signed sample URL and hands it to the browser. Sample lookups are free and the server caches each signed URL for 20 hours. For Gemini voices the route takes a `model` parameter to pick the sub-model.
- The first listen for a rare voice can catch the API still preparing that sample. It answers 202, the row shows "preparing sample", and playback starts a few seconds later.
- The API key never leaves the server and nothing here spends synthesis credits, so browsing costs nothing.

## Run it

```bash
npm install
cp .env.example .env   # then paste your TTS_API_KEY
npm run dev
```

`TTS_API_KEY` comes from an [AI TTS Microservice](https://aitts.theproductivepixel.com) account. Without it the site still renders; only sample playback returns errors.

For production, also set `NEXT_PUBLIC_SITE_URL` to your public origin so canonical URLs, the sitemap and Open Graph tags point at the right host.

## Refresh the catalog

```bash
TTS_API_KEY=tts_... node scripts/build-data.mjs
```

Fetches the current Google voice list and rewrites `data/voices.packed.json`. One API call, a few seconds. It also warns if Google's Gemini sub-model list has changed so `lib/families.ts` can be kept in step.

## Pages

- `/` hero, model family overview, the full explorer with search and filters, and a language index
- `/voices/[lang]` one page per language, statically generated, e.g. `/voices/ko-KR`
- `/sitemap.xml` and `/robots.txt` are generated from the catalog
