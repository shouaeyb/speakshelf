<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Speakshelf, working guide for agents

Speakshelf is a public catalog of text to speech voices with playable samples: Google Cloud, Amazon Polly and Kokoro today, built so more providers slot in under one roof. A provider goes live only through the bless config (`lib/providers.ts`, `lib/families.ts`, the BLESSED list in `scripts/build-data.mjs`), a data refresh, honest copy, a real browser playback pass, and a regenerated `public/og.png` (the share card names the providers but carries no counts; see decisions); unblessed providers appearing upstream just console-log. Before substantial work, read the docs that matter to your task:

- `docs/architecture.md` explains how the system works and lists the invariants you must not break
- `docs/decisions.md` is the dated log of settled decisions; do not quietly relitigate them
- `docs/roadmap.md` says where the product goes next. It carries the owner's direction only: never park your own ideas there (no parking lots, no wishlists). Propose ideas to the owner in conversation; unadopted ideas are dropped, not stored.
- `docs/design.md` holds the design system, the copy voice, and the design workflow

Keep these docs true: when your change alters how something works, update `docs/architecture.md` in the same commit, and append to `docs/decisions.md` when something new gets settled. This is not optional and not deferrable: a change whose docs lag is unfinished work.

Keep files small and the code modular: no source file over 1,000 lines, and aim well below that. When a file grows past a few hundred lines, look for the module trying to get out (a cache, a state machine, a config block) and split it along that seam rather than letting one file absorb everything. Future maintainability outranks the convenience of one big file.

## Ground rules

- Never ship a claim you cannot back. Numbers, dates, timelines and superlatives come from the catalog data, our own measurements, or a source you actually checked; otherwise soften the sentence or cut it. When reporting to the owner, label inference as inference, and say "I have not checked that" instead of guessing.
- Keep trouble words out of shipped copy: official, endorsed, partner, guaranteed, "the largest". This is an independent site and the independence line stays, in two forms: shared surfaces (home about, footer, llms.txt) carry the generic line ("not affiliated with any provider it catalogs"), and each provider page names only its own provider, interpolated from the bless config label into `attribution.independenceNamed`. Both forms are derived, so blessing a provider no longer means editing a hardcoded name list in copy. In translations the interpolated `{name}` is invariant: the label itself is never altered or translated; adjacent grammatical particles are permitted (Bengali attaches its genitive as "-এর" after the untouched label).
- Kill the server on port 3000 before running a build (`lsof -ti:3000 | xargs kill`). A build rewrites `.next` under a live server and its pages start pointing at chunk files that no longer exist, which shows up as 500s on css and js. If a build ever gets interrupted, delete `.next` and build again.
- `TTS_API_KEY` lives in `.env` (gitignored, also in `TTS_API_KEY.rtf`, gitignored). Server side only. Never commit it, log it, or paste it into anything user facing.
- Never call `POST /tts` on the AI TTS Microservice. It spends the owner's real credits. The voice listing and `sample-url` endpoints are free; `sample-url` draws from a rate bucket of roughly 1000 requests per rolling hour, so batch jobs must honor 429 and `x-ratelimit-reset`.
- All shipped writing is human: no em dashes, no AI boilerplate phrases, plain sentences. Details in `docs/design.md`.
- Verify UI work in a real browser before calling it done. Headless Playwright click tests against `npm run start` are the house pattern, including one real sample playback.
- Commands: `npm run dev`, `npm run build`, `npm run start` (kill port 3000 first: `lsof -ti:3000 | xargs kill`). Refresh the committed fallback catalog with `TTS_API_KEY=... node scripts/build-data.mjs`.
- The design mockup lives in a Claude Design project, but not every agent has that tool. The design source of truth in this repo is the ordered stylesheet set rooted at `app/globals.css`: that file is the manifest and holds no rules, importing `app/styles/base.css`, `app/styles/explorer.css` and `app/styles/site.css` in that order, and import order is the cascade. It stays the only stylesheet the root layout imports. Never block on the mockup. See `docs/design.md`.
