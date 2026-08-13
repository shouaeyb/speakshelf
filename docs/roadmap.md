# Roadmap

Where Speakshelf is headed. The owner decides sequence and scope; this file records the agreed direction plus a parking lot of unbuilt ideas. Edit in place, and move an item to `decisions.md` once it is settled and shipped.

## Now (blocked on the owner)

- Buy speakshelf.com (trademark glance done 2026-08-13, see decisions).
- Create the GitHub remote and push: `gh repo create speakshelf --public --source . --push`.
- Deploy, set `NEXT_PUBLIC_SITE_URL=https://speakshelf.com` and `TTS_API_KEY` in the host's env, submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Next: the multi-provider shelf

Trigger: the AI TTS Microservice exposes a second provider worth listing (Polly, Kokoro, Azure).

1. Umbrella home at `/`: provider tiles with counts, aggregate stats, the same hero language. Design the page as a mockup first (see the Claude Design note in `docs/design.md`), screenshot-check it, then port.
2. Move the Google catalog to `/google` (`/google/voices/en-US` and so on) with 301 redirects from every current URL. One codebase; provider becomes a route segment and a `provider=` param upstream.
3. Generalize `lib/catalog.ts` to fetch per provider. The family and models maps generalize naturally, but the packed format needs a provider dimension: `unpack()` currently hardcodes the `google:` id prefix.
4. Keep one design token sheet for every provider section. Provider identity is words (eyebrow, breadcrumbs), not palettes; the only allowed differentiator is the small tag accent, and only if the owner asks for it.

## Parking lot (ideas, none committed)

- Per-voice pages (`/google/voice/en-US-Chirp3HD-Charon`) for long-tail search: one page per voice with its sample, styles, family context. Thousands of indexable pages, needs care against thin-content penalties.
- Cross-provider compare: pin voices from different providers side by side and play them back to back.
- Shareable deep links to a filtered view with a picked voice (the URL state already supports most of this).
- A "what changed" page fed by catalog diffs, since the site already refreshes daily and could record deltas.
- IndexNow pings on catalog changes (Bing and friends only; Google never joined).
- Per-provider accent hue on tags, only with owner sign-off (see design doc).
