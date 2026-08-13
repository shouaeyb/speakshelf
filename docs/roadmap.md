# Roadmap

Where Speakshelf is headed. This file carries the owner's direction and nothing else: no agent wishlists, no parking lot. An idea that is not the owner's decision does not belong here; raise it with the owner directly and let it live or die in that conversation.

## Now (blocked on the owner)

- Buy speakshelf.com (trademark glance done 2026-08-13, see decisions).
- Deploy, set `NEXT_PUBLIC_SITE_URL=https://speakshelf.com`, `TTS_API_KEY` and the analytics ids in the host's env, submit the sitemap in Google Search Console and Bing Webmaster Tools.
- Owner's legal review of the analytics posture (always-on pass-through today; see decisions), then whatever consent surface they specify.
- Confirm the GA4 measurement id: the configured value is numeric and GA4 web streams use a G-XXXXXXXXXX id (Admin, Data streams). Swap it in `.env` when confirmed.

## Next

Nothing queued beyond the Now list. Blessing another provider when the AI TTS Microservice carries one is a config-and-copy exercise: `lib/providers.ts`, `lib/families.ts`, the BLESSED list in `scripts/build-data.mjs`, a data refresh, a regenerated share card, and a real browser playback pass before it ships.
