<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Speakshelf, working guide for agents

Speakshelf is a public catalog of every Google Cloud text to speech voice with playable samples, built for a future of many providers under one roof. Before substantial work, read the docs that matter to your task:

- `docs/architecture.md` explains how the system works and lists the invariants you must not break
- `docs/decisions.md` is the dated log of settled decisions; do not quietly relitigate them
- `docs/roadmap.md` says where the product goes next and parks unbuilt ideas
- `docs/design.md` holds the design system, the copy voice, and the design workflow

Keep these docs true: when your change alters how something works, update `docs/architecture.md` in the same commit, and append to `docs/decisions.md` when something new gets settled.

## Ground rules

- `TTS_API_KEY` lives in `.env` (gitignored, also in `TTS_API_KEY.rtf`, gitignored). Server side only. Never commit it, log it, or paste it into anything user facing.
- Never call `POST /tts` on the AI TTS Microservice. It spends the owner's real credits. The voice listing and `sample-url` endpoints are free; `sample-url` draws from a rate bucket of roughly 1000 requests per rolling hour, so batch jobs must honor 429 and `x-ratelimit-reset`.
- All shipped writing is human: no em dashes, no AI boilerplate phrases, plain sentences. Details in `docs/design.md`.
- Verify UI work in a real browser before calling it done. Headless Playwright click tests against `npm run start` are the house pattern, including one real sample playback.
- Commands: `npm run dev`, `npm run build`, `npm run start` (kill port 3000 first: `lsof -ti:3000 | xargs kill`). Refresh the committed fallback catalog with `TTS_API_KEY=... node scripts/build-data.mjs`.
- The design mockup lives in a Claude Design project, but not every agent has that tool. `app/globals.css` is the design source of truth in this repo; never block on the mockup. See `docs/design.md`.
