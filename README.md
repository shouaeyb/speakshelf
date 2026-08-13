# Voice Atlas

A catalog of every Google Cloud text to speech voice, with official samples you can play in the browser. 4,586 voices, 93 languages, ten model families from Standard to Gemini, on one page.

Built with Next.js and styled after IBM's design language: IBM Plex type, sharp corners, thin rules, Carbon blue.

## How it works

- The voice list ships with the repo (`data/voices.packed.json`), so pages render with no API calls at all.
- Pressing play hits `/api/sample`, which asks the [AI TTS API](https://aitts.theproductivepixel.com) for a signed sample URL and redirects the browser to it. Sample lookups are free, and the server caches each signed URL for 20 hours.
- The API key never leaves the server and no synthesis is ever triggered, so browsing costs nothing.

## Run it

```bash
npm install
cp .env.example .env   # then paste your TTS_API_KEY
npm run dev
```

`TTS_API_KEY` comes from an [AI TTS API](https://aitts.theproductivepixel.com) account. Without it the site still renders; only sample playback returns errors.

For production, also set `NEXT_PUBLIC_SITE_URL` to your public origin so canonical URLs, the sitemap and Open Graph tags point at the right host.

## Refresh the catalog

```bash
TTS_API_KEY=tts_... node scripts/build-data.mjs
```

Fetches the current Google voice list, probes which voices have published samples, and rewrites `data/voices.packed.json`. Takes a few minutes because it walks the whole catalog politely.

## Pages

- `/` hero, model family overview, the full explorer with search and filters, and a language index
- `/voices/[lang]` one page per language, statically generated, e.g. `/voices/ko-KR`
- `/sitemap.xml` and `/robots.txt` are generated from the catalog
