# Roadmap

Where Speakshelf is headed. The owner decides sequence and scope; this file records the agreed direction plus a parking lot of unbuilt ideas. Edit in place, and move an item to `decisions.md` once it is settled and shipped.

## Now (blocked on the owner)

- Buy speakshelf.com (trademark glance done 2026-08-13, see decisions).
- Deploy, set `NEXT_PUBLIC_SITE_URL=https://speakshelf.com` and `TTS_API_KEY` in the host's env, submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Next

Nothing is queued. The multi-provider shelf (umbrella home, /google move with permanent redirects, Amazon Polly and Kokoro) shipped 2026-08-13; see decisions. Blessing another provider when the AI TTS Microservice carries one is a config-and-copy exercise: `lib/providers.ts`, `lib/families.ts`, the BLESSED list in `scripts/build-data.mjs`, a data refresh, and a real browser playback pass before it ships.

## Parking lot (ideas, none committed)

- Per-voice pages (`/google/voice/en-US-Chirp3HD-Charon`) for long-tail search: one page per voice with its sample, styles, family context. Thousands of indexable pages, needs care against thin-content penalties.
- Cross-provider compare: pin voices from different providers side by side and play them back to back.
- Shareable deep links to a filtered view with a picked voice (the URL state already supports most of this).
- A "what changed" page fed by catalog diffs, since the site already refreshes daily and could record deltas.
- IndexNow pings on catalog changes (Bing and friends only; Google never joined).
- Per-provider accent hue on tags, only with owner sign-off (see design doc).
- Per-provider OG images (today one umbrella card serves every page).
- Louder unblessed-provider alerting (webhook or CI check). Owner declined for now: console logs are enough.
