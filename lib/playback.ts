// The playback engine: every cache tier, the startup allowance, the
// recovery ladder and the family quirk toast. Lifted out of
// components/Explorer.tsx because that file had grown past the thousand
// line cap and this is the module that was trying to get out. The Explorer
// keeps the catalog, the filters and the list; this keeps sound.
//
// The code came across unchanged: it is the same code that shipped through
// the 2026-08-18 and 2026-08-19 rounds, in the same order. Read
// docs/decisions.md before changing any of it, because the ordering of the
// tiers, the single startup allowance and the rule that a decoded replay
// must prove its context is awake were each paid for by a real regression.

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Voice } from "@/lib/data";
import { formatFromContentType, formatsParam, type SampleFormat } from "@/lib/audio-formats";
import { familyMeta } from "@/lib/families";
import type { PlayStatus } from "@/components/VoiceRow";
import { EVENTS, track } from "@/lib/analytics";
import {
  contextState,
  decodeIntoCache,
  evictBuffer,
  getBuffer,
  playBuffer,
  resumeContext,
  type ReplayControls,
} from "@/lib/audio-replay";

export type Active = {
  id: string;
  /** Sub-model the playback was started with, "" for the default. */
  model: string;
  status: PlayStatus;
  note?: string;
} | null;

export type Toast = { text: string; pos: "top" | "bottom" } | null;

// Module level so both caches survive route changes within the session.
// Safari re-downloads media URLs even when they are fresh, so after the
// first successful play the audio bytes are kept as a blob; replays then
// come from memory in every engine. A signed URL is kept until the moment
// the server says it dies, not for a span counted from when we received it:
// the server may hand over a URL already well into its life, and a fresh
// local clock on top of that is how a long-lived tab ends up replaying a
// dead link. The fallback span only covers a server that reports no expiry.
// Keys are full voice ids, so providers never collide.
const URL_TTL_MS = 18 * 60 * 60 * 1000;
const BLOB_MAX = 24;
// How long a media element may take to produce sound before the attempt is
// declared dead. Nothing else bounds it: the lookup's abort only covers the
// URL request, so without this a stalled media fetch spins forever.
const MEDIA_START_MS = 20_000;
const urlCache = new Map<string, { url: string; exp: number }>();
// Which format each voice was actually served, so a replay out of the blob
// or decoded tier still reports honestly instead of guessing from what this
// browser prefers. Set from the server's content type, never from the ask.
const formatCache = new Map<string, SampleFormat>();
// Entries keep the raw Blob beside the object URL: the decoded replay tier
// reads Blob.arrayBuffer() directly, because fetch(blob:) sits outside
// connect-src. Warm requests are deduplicated so a rapid double play of a
// cold voice costs one transfer.
const blobCache = new Map<string, { url: string; blob: Blob }>();
const blobInFlight = new Set<string>();

/** Insert bytes into the blob tier, evicting the least recently played. */
function storeBlob(key: string, blob: Blob): string {
  // Replacing a key must revoke the URL it held, or that object stays alive
  // for the life of the document with nothing pointing at it.
  const existing = blobCache.get(key);
  if (existing) {
    URL.revokeObjectURL(existing.url);
    blobCache.delete(key);
    // The decoded tier held the OLD bytes; disown it and any decode still
    // running for them, or the replacement can be shadowed by its
    // predecessor.
    evictBuffer(key);
  }
  while (blobCache.size >= BLOB_MAX) {
    const oldest = blobCache.entries().next().value;
    if (!oldest) break;
    URL.revokeObjectURL(oldest[1].url);
    blobCache.delete(oldest[0]);
  }
  const url = URL.createObjectURL(blob);
  blobCache.set(key, { url, blob });
  return url;
}

/** Preparation failures are reported once per voice per session: a reader
 *  who taps the same stubborn voice ten times is one story, not ten. */
const prepareReported = new Set<string>();

function warmBlob(key: string, url: string) {
  if (blobCache.has(key) || blobInFlight.has(key)) return;
  blobInFlight.add(key);
  fetch(url)
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob || blobCache.has(key)) return;
      storeBlob(key, blob);
      // Same bytes feed the decoded tier; a decode failure only means
      // replays use the blob URL through the media element instead.
      return decodeIntoCache(key, blob).catch(() => {});
    })
    .catch(() => {})
    .finally(() => {
      blobInFlight.delete(key);
    });
}

interface PlaybackInput {
  provider: string;
  locale: string;
  /** The Explorer's translator, for the generating and error notes. */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** The active family filter. A quirk toast stays quiet when the note it
   *  would repeat is already pinned above the list. */
  family: string;
  /** The reader's sub-model pick, "" for the API default. */
  gmodel: string;
  /** The one family carrying several sub-models, "" when there is none. */
  multiFamily: string;
}

export function usePlayback({ provider, locale, t, family, gmodel, multiFamily }: PlaybackInput) {
  const [active, setActive] = useState<Active>(null);
  // The family quirk toast: shown once per session, on the first play of
  // a voice from a noted family, because the top-of-list note is off
  // screen once the reader has scrolled into a long list.
  const [toast, setToast] = useState<{ text: string; pos: "top" | "bottom" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the family filter for callbacks that fire long after their
  // click render (cold generations); see maybeToast.
  const familyRef = useRef(family);
  useEffect(() => {
    familyRef.current = family;
  }, [family]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Active Web Audio replay source; stopped before any new play, on stop
  // and on unmount, so a switched voice never keeps sounding underneath
  // the next one (the reference repo's discontinuity lesson).
  const replayRef = useRef<ReplayControls | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A media element that never starts and never errors would otherwise hold
  // the row on its spinner forever; this is that deadline.
  const mediaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against stale media events after switching voices or stopping.
  const playGen = useRef(0);

  useEffect(() => {
    // The boxes, not their contents: teardown must act on whatever is
    // playing at unmount, so snapshotting the values here (the usual answer
    // to the exhaustive-deps ref warning) would tear down the wrong things.
    // Aliasing the ref objects keeps the cleanup reading live state and
    // says so.
    const gen = playGen;
    const audio = audioRef;
    const replay = replayRef;
    const timers = [errTimer, retryTimer, toastTimer, mediaTimer];
    return () => {
      // The generation bump makes any in-flight lookup a no-op, so no
      // retry chain can fire after unmount.
      gen.current++;
      audio.current?.pause();
      replay.current?.stop();
      replay.current = null;
      for (const timer of timers) {
        if (timer.current) clearTimeout(timer.current);
      }
    };
  }, []);

  function maybeToast(fam: string) {
    // The permanent inline note is already on screen when this family is
    // the active filter; a toast on top of it would say the same twice.
    // Read the filter through a ref: playback can start half a minute
    // after the click on a cold render, and it is the filter at play
    // time that decides what is visible.
    if (familyRef.current === fam) return;
    const note = familyMeta(provider, fam)?.hasNote ? t(`families.${provider}.${fam}.note`) : "";
    if (!note) return;
    const key = `ss-note-${provider}-${fam}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    // Mobile places the toast opposite the playing row so it never covers
    // what was just tapped; desktop ignores pos and stays Carbon top-right
    // (the media query wins). While the consent bar holds the bottom edge,
    // the toast takes the top slot: the bottom is simply occupied.
    const consentUp = !!document.querySelector(".consent");
    const row = document.querySelector(".play-on")?.getBoundingClientRect();
    const pos = consentUp || (row && row.top > window.innerHeight / 2) ? "top" : "bottom";
    setToast({ text: note, pos });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 15000);
  }

  function stop() {
    playGen.current++;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (mediaTimer.current) clearTimeout(mediaTimer.current);
    audioRef.current?.pause();
    replayRef.current?.stop();
    replayRef.current = null;
    setActive(null);
  }

  /** clickedAt is the row's own click timestamp, read in the handler. The
   *  patience budget below is the reader's wait and it starts at their tap,
   *  which is also the only place the clock may be read: this function's
   *  direct body is component scope, which react-hooks/purity cannot prove
   *  is event-only, so a Date.now() here reads as an impure render call.
   *  The two wall-clock reads in the nested helpers (the URL cache's age
   *  check and its timestamp) are a matched pair and stay wall clock: a
   *  URL fetched thirty seconds after the tap must not be stamped as if it
   *  were fetched at the tap. */
  function play(v: Voice, clickedAt: number) {
    const model = v.family === multiFamily ? gmodel : "";
    const cacheKey = model ? `${v.id}|${model}` : v.id;
    if (active?.id === v.id && active.model === model && active.status !== "error") {
      stop();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.pause();
    replayRef.current?.stop();
    replayRef.current = null;
    if (errTimer.current) clearTimeout(errTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (mediaTimer.current) clearTimeout(mediaTimer.current);
    const gen = ++playGen.current;
    const current = () => playGen.current === gen;
    setActive({ id: v.id, model, status: "loading" });

    // Which cache tier served this playback; reported once on first audio
    // progress so replays and cold plays can be told apart in analytics.
    let source: "memory" | "cached" | "network" = "network";
    let reported = false;
    // The streamed URL of this playback, kept for cache warming at the
    // confirmed-playing moment.
    let streamUrl: string | null = null;
    // One failure per playback attempt: a dead media load can surface as
    // both an element error event and a play() rejection.
    let failedOnce = false;
    // Bumped by each start(); only the newest attempt may end the chain.
    let attemptSeq = 0;
    // True once the bytes path has taken responsibility for the blob and
    // decoded tiers, so confirmed playback must not warm them a second time.
    let warmHandled = false;
    // Set when a blob attempt failed: the rest of this playback streams,
    // however it obtains its URL.
    let forceStream = false;
    // ONE startup allowance for the whole phase, as an absolute moment.
    // Fetching bytes and starting a media element are different mechanisms
    // but one wait to the reader, so a fetch that burns the allowance leaves
    // none for the stream that follows it. Set on the first attempt, never
    // renewed, and always clamped by what is left of the reader's budget.
    let startupDeadline = 0;
    // True once a blob failure sent us back for a fresh URL. That lookup and
    // any retry it schedules belong to the SAME startup phase the reader is
    // already waiting through, so they draw on what is left of it rather
    // than on the ninety second generation budget.
    let inStartupRecovery = false;
    /** What this chain may still spend: the generation budget, and the
     *  startup allowance too once recovery is under way. */
    function chainLeft(): number {
      return inStartupRecovery ? Math.min(remaining(), startupLeft()) : remaining();
    }
    function startupLeft(): number {
      const budget = remaining();
      if (startupDeadline === 0) startupDeadline = Date.now() + Math.min(MEDIA_START_MS, budget);
      return Math.min(startupDeadline - Date.now(), budget);
    }

    // `note` is what the row shows; `reason` is what analytics records, and
    // they differ only where one visible message covers several distinct
    // failures. A media timeout reads as "unavailable" to a reader but must
    // stay countable on its own, or the deadline can never be validated.
    const fail = (note: string, reason: string = note) => {
      if (!current() || failedOnce) return;
      failedOnce = true;
      if (mediaTimer.current) clearTimeout(mediaTimer.current);
      track(EVENTS.SAMPLE_FAILED, {
        provider,
        locale,
        voice_id: v.id,
        model: model || undefined,
        format: formatCache.get(cacheKey),
        reason,
      });
      setActive({ id: v.id, model, status: "error", note });
      errTimer.current = setTimeout(() => {
        setActive((cur) => (cur?.id === v.id && cur.status === "error" ? null : cur));
      }, 3000);
    };

    const markPlaying = () => {
      // A row that already failed stays failed: a late playing event from a
      // media element abandoned at the deadline must not resurrect it.
      if (!current() || failedOnce) return;
      if (mediaTimer.current) clearTimeout(mediaTimer.current);
      if (!reported) {
        reported = true;
        track(EVENTS.SAMPLE_PLAYED, {
          provider,
          locale,
          voice_id: v.id,
          family: v.family,
          language: v.lang,
          model: model || undefined,
          format: formatCache.get(cacheKey),
          ms: Date.now() - clickedAt,
          source,
        });
        maybeToast(v.family);
        // Warming belongs to confirmed playback (reference lesson): a
        // voice that never produced audio is never cached. The same bytes
        // feed the decoded replay tier.
        const known = blobCache.get(cacheKey);
        if (known) {
          void decodeIntoCache(cacheKey, known.blob).catch(() => {
            reportPrepare("blobDecode", Date.now() - clickedAt);
          });
        } else if (!warmHandled && streamUrl) {
          warmBlob(cacheKey, streamUrl);
        }
      }
      setActive({ id: v.id, model, status: "playing" });
    };

    function start(url: string, fromBlob: boolean) {
      if (!current()) return;
      // Each attempt owns its deadline and its play() promise. Starting a
      // new one (the blob tier falling back to the network, say) abandons
      // the previous attempt, so neither its timer nor a late rejection can
      // end a chain that has already moved on.
      const attempt = ++attemptSeq;
      const live = () => current() && attempt === attemptSeq && !failedOnce;
      if (mediaTimer.current) clearTimeout(mediaTimer.current);
      if (!fromBlob) streamUrl = url;
      a.onplaying = markPlaying;
      // Safari does not reliably fire onplaying for cached replays; any
      // playback progress at all means audio is running.
      a.ontimeupdate = () => {
        if (a.currentTime > 0) {
          a.ontimeupdate = null;
          markPlaying();
        }
      };
      a.onended = () => {
        if (current()) setActive((cur) => (cur?.id === v.id ? null : cur));
      };
      a.onerror = () => {
        if (!current()) return;
        if (fromBlob) {
          if (!fallbackFromBlob()) fail("noteUnavailable");
          return;
        }
        // A URL that failed to load should not be replayed from cache.
        urlCache.delete(cacheKey);
        fail("noteUnavailable");
      };
      a.src = url;
      // The deadline is armed before play() and covers the whole media load,
      // which nothing else does: the lookup's own abort only guards the URL
      // request. Without it a media element that neither starts nor errors,
      // which is what a stalled range request looks like, leaves the row
      // spinning for good. It never outlives the reader's patience budget.
      const leftForMedia = startupLeft();
      if (leftForMedia <= 0) {
        fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        return;
      }
      mediaTimer.current = setTimeout(
        () => {
          if (!live()) return;
          // Abandon this element: pause it and drop its handlers so a late
          // event cannot contradict the failure the reader has been shown.
          a.onplaying = null;
          a.ontimeupdate = null;
          a.onerror = null;
          a.pause();
          if (fromBlob) {
            // A blob that will not start is still recoverable: the signed
            // URL may play perfectly well, so spend the remaining budget on
            // it rather than ending the reader's attempt here.
            if (fallbackFromBlob()) return;
            fail("noteUnavailable", "mediaTimeout");
            return;
          }
          urlCache.delete(cacheKey);
          fail("noteUnavailable", "mediaTimeout");
        },
        leftForMedia,
      );
      a.play()
        .catch((err: unknown) => {
          // Stale rejections, from a row switch or an attempt this one
          // replaced, are ignored. An autoplay refusal is real and the
          // repeat tap plays synchronously from the cache. Any OTHER
          // rejection on an object URL is about the source, so the signed
          // URL still deserves its chance.
          if (!live()) return;
          const refused = err instanceof Error && err.name === "NotAllowedError";
          if (fromBlob && !refused && fallbackFromBlob()) return;
          fail("noteTapAgain");
        });
    }

    /** Every way an object URL can fail lands here: the element's error
     *  event, the media deadline, and a play() rejection that is not an
     *  autoplay refusal. Guarded, so the recovery happens once: it drops the
     *  suspect blob and its decoded buffer, marks warming handled so the
     *  stream that follows cannot rebuild the blob that just failed, and
     *  streams the signed URL we still hold. Returns false when there is
     *  nothing left to try, so the caller can fail honestly. */
    let blobFallbackUsed = false;
    function fallbackFromBlob(): boolean {
      if (blobFallbackUsed) return false;
      blobFallbackUsed = true;
      if (mediaTimer.current) clearTimeout(mediaTimer.current);
      const stale = blobCache.get(cacheKey);
      if (stale) URL.revokeObjectURL(stale.url);
      blobCache.delete(cacheKey);
      evictBuffer(cacheKey);
      warmHandled = true;
      // Everything from here streams. Fetching bytes again would rebuild the
      // blob that just failed, whether the URL is the one we hold or a
      // freshly minted one.
      forceStream = true;
      const signed = urlCache.get(cacheKey);
      if (signed && signed.exp > Date.now()) {
        source = "cached";
        start(signed.url, false);
        return true;
      }
      // A blob outlives its signed URL: the tiers have different lifetimes,
      // so this is ordinary, not exceptional. Mint a fresh one rather than
      // telling the reader the sample is gone, but inside the startup window
      // they are already waiting through, never beside it.
      if (startupLeft() <= 0) return false;
      inStartupRecovery = true;
      source = "network";
      lookup(0);
      return true;
    }

    /** Report a step that failed WITHOUT costing the reader their sample.
     *  Never terminal, never visible, never sets failedOnce: the play either
     *  continues by another route or has already succeeded. */
    function reportPrepare(stage: string, ms: number) {
      if (!current()) return; // a stop or a row switch is not a failure
      if (prepareReported.has(cacheKey)) return;
      prepareReported.add(cacheKey);
      track(EVENTS.SAMPLE_PREPARE_FAILED, {
        provider,
        locale,
        voice_id: v.id,
        model: model || undefined,
        format: formatCache.get(cacheKey),
        stage,
        ms,
      });
    }

    /** Fetch the whole sample, then play it from memory.
     *
     *  This is a WebKit fix that showed no measured penalty for the other engines. Handed a
     *  URL, WebKit opens several range requests before it will make a sound;
     *  handed bytes it plays at once. Measured end to end on production, a
     *  first play in WebKit went from a median of 4050ms to 2126ms, with the
     *  requests per play falling from four to one. An alternating
     *  same-session test of the two transports found Chromium and Firefox
     *  indifferent, 452ms against 425ms and 444ms against 443ms, which is
     *  why the choice is made by format rather than by browser: no engine
     *  showed a penalty for taking the same path.
     *
     *  It only works because samples are compressed now, tens of kilobytes.
     *  Waiting for a whole 460KB WAV before making a sound would be worse
     *  than streaming it, which is why the WAV fallback still streams.
     *
     *  The same bytes become the blob and decoded replay tiers, so this one
     *  request also replaces the second download the old path made after
     *  playback began. */
    function playFromBytes(url: string) {
      const left = startupLeft();
      if (left <= 0) {
        fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        return;
      }
      const started = Date.now();
      warmHandled = true;
      // Drawn from the shared startup allowance, so a fetch that fails fast
      // hands nearly all of it to the stream that follows, and a fetch that
      // burns it leaves none: the reader waits once, not twice.
      fetch(url, { signal: AbortSignal.timeout(left) })
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
        .then((blob) => {
          if (!current()) return;
          const objectUrl = storeBlob(cacheKey, blob);
          // Decoding waits for confirmed playback. Doing it here would build
          // the Web Audio context before any sound has been made, and iOS
          // creates a context outside a gesture SUSPENDED, which is how a
          // later replay ends up moving its equaliser in silence. The bytes
          // are already in the blob tier, so markPlaying decodes from them
          // without another request.
          start(objectUrl, true);
        })
        .catch(() => {
          if (!current()) return;
          reportPrepare("blobFetch", Date.now() - started);
          // One shot, and never warmed afterwards: falling back to streaming
          // is the whole recovery, and re-fetching after it would restore
          // exactly the second transfer this path exists to remove.
          start(url, false);
        });
    }

    /** Compressed samples play from bytes; the WAV fallback keeps streaming,
     *  where progressive playback of a much larger file is worth more than
     *  one-request efficiency. An unrecognized type streams too. */
    function playUrl(url: string) {
      const served = formatCache.get(cacheKey);
      if (!forceStream && (served === "opus" || served === "aac")) playFromBytes(url);
      else start(url, false);
    }

    /** Everything under the decoded tier, in order: the bytes we already
     *  hold, then the cached URL, then the network. The asynchronous
     *  continuation after a failed context wake MUST come through here too,
     *  or it would jump straight to a lookup and re-fetch audio that is
     *  sitting in memory. */
    function serveBelowDecoded(): boolean {
      const blobbed = blobCache.get(cacheKey);
      if (blobbed) {
        // Re-insert so eviction hits the least recently played entry.
        blobCache.delete(cacheKey);
        blobCache.set(cacheKey, blobbed);
        source = "memory";
        start(blobbed.url, true);
        return true;
      }
      return false;
    }

    function resolve() {
      const known = urlCache.get(cacheKey);
      if (known && known.exp > Date.now()) {
        source = "cached";
        playUrl(known.url);
        return;
      }
      // No cached media for this voice, so whatever format a previous
      // attempt was served no longer describes this one. Cleared before the
      // lookup so a failure cannot report a format this attempt never got.
      formatCache.delete(cacheKey);
      source = "network";
      lookup(0);
    }

    // First listen renders the sample upstream, and the slow engines
    // (Polly generative and long-form, Gemini sub-models) can take well
    // over half a minute. Patience is a time budget, not a retry count,
    // and a chain that saw 202 never ends in "unavailable": the contract
    // says the sample is coming, so a blip mid-generation stays a blip.
    // The clock runs from the tap, so the ninety seconds are the reader's,
    // not the network's.
    const CHAIN_BUDGET_MS = 90_000;
    const withinBudget = () => Date.now() - clickedAt <= CHAIN_BUDGET_MS;
    // What is left of the reader's ninety seconds. Every wait the chain can
    // schedule is clamped to it, so the budget is genuinely terminal rather
    // than a figure a long retry wait or a request timeout can overrun.
    const remaining = () => CHAIN_BUDGET_MS - (Date.now() - clickedAt);
    let sawGenerating = false;
    let blips = 0;

    function retryLater(seconds: number, attempt: number) {
      const left = chainLeft();
      if (left <= 0) {
        fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        return;
      }
      setActive({ id: v.id, model, status: "generating" });
      const wait = Math.min(Math.min(Math.max(seconds, 4), 15) * 1000, left);
      retryTimer.current = setTimeout(() => {
        if (current()) lookup(attempt + 1);
      }, wait);
    }

    function lookup(attempt: number) {
      // The budget is a wall-clock hard stop, checked at dispatch so a
      // wait scheduled near the edge cannot slip past it. The clock is read
      // ONCE and reused: checking with one read and sizing the abort with a
      // second lets the budget lapse between them, and AbortSignal.timeout
      // of a negative span throws synchronously, outside the chain that
      // would have caught it, stranding the spinner it was meant to save.
      const left = chainLeft();
      if (left <= 0) {
        fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        return;
      }
      const query =
        `/api/sample?id=${encodeURIComponent(v.id)}` +
        (model ? `&model=${encodeURIComponent(model)}` : "") +
        `&formats=${formatsParam()}`;
      fetch(query, {
        // A hung request must not strand the spinner; a timeout lands in
        // the catch below as a blip. Clamped to the reader's remaining
        // patience so a request cannot outlive the budget it belongs to.
        signal: AbortSignal.timeout(Math.min(15_000, left)),
      })
        .then(async (res) => {
          if (!current()) return;
          if (res.status === 202) {
            sawGenerating = true;
            const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
            if (!current()) return;
            track(EVENTS.SAMPLE_GENERATING, { provider, locale, voice_id: v.id, attempt });
            retryLater(Number(body?.retry_after) || 4, attempt);
            return;
          }
          if (res.status === 503 || res.status === 429) {
            fail("noteBusy");
            return;
          }
          if (!res.ok) {
            // 404 can precede the generation trigger registering, and 5xx
            // can be the upstream straining mid-render; both are "not yet",
            // not "never", while the budget lasts.
            if (withinBudget() && blips < 3) {
              blips++;
              retryLater(5, attempt);
              return;
            }
            fail(sawGenerating ? "notePreparing" : "noteUnavailable");
            return;
          }
          const body = (await res.json().catch(() => null)) as {
            url?: string;
            reuseUntil?: number;
            contentType?: string;
          } | null;
          if (!body?.url) {
            fail("noteUnavailable");
            return;
          }
          // The server says how long this URL may be reused, having already
          // trimmed its own safety margin; only a server that says nothing
          // falls back to a local span.
          const exp = typeof body.reuseUntil === "number" ? body.reuseUntil : Date.now() + URL_TTL_MS;
          urlCache.set(cacheKey, { url: body.url, exp });
          const served = formatFromContentType(body.contentType);
          if (served) formatCache.set(cacheKey, served);
          else formatCache.delete(cacheKey);
          // The body arrived, but parsing it took time too: a URL that lands
          // after the reader's ninety seconds must not start a playback with
          // a fresh deadline on top.
          if (!withinBudget()) {
            fail(sawGenerating ? "notePreparing" : "noteUnavailable");
            return;
          }
          playUrl(body.url);
        })
        .catch(() => {
          if (!current()) return;
          if (withinBudget() && blips < 3) {
            blips++;
            retryLater(6, attempt);
            return;
          }
          fail(sawGenerating ? "notePreparing" : "noteUnavailable");
        });
    }

    // Replay tiers, fastest first. Decoded PCM plays synchronously through
    // Web Audio: no media element, no demux, no network, on every engine.
    const decoded = getBuffer(cacheKey);
    const ctxState = contextState();
    if (decoded && ctxState !== "closed") {
      const startDecoded = () => {
        try {
          replayRef.current = playBuffer(decoded, () => {
            if (current()) setActive((cur) => (cur?.id === v.id ? null : cur));
          });
          markPlaying();
          return true;
        } catch {
          // A broken buffer falls through to the blob tier.
          evictBuffer(cacheKey);
          return false;
        }
      };
      if (ctxState === "running") {
        source = "memory";
        if (startDecoded()) return;
      } else {
        // The context is asleep, or does not exist yet. Waking it is a
        // promise, and starting a source before it settles is how a replay
        // ends up silent behind a moving equaliser, so this play waits for a
        // real answer. A context that will not wake is treated as a tier
        // miss, not as a failure: the blob below still plays through a media
        // element, which needs no context at all. The decoded bytes are kept
        // either way, since the fault is activation, not the audio.
        source = "memory";
        void resumeContext().then((awake) => {
          if (!current()) return; // stopped, or another row took over
          if (awake && startDecoded()) return;
          // Bytes in hand beat any network path, so this rejoins the tier
          // walk rather than jumping to a lookup.
          if (serveBelowDecoded()) return;
          source = "cached";
          resolve();
        });
        return;
      }
    }
    if (serveBelowDecoded()) return;
    resolve();
  }

  // Rows get ONE function for the life of the list instead of a fresh
  // closure each, which is what lets the memoized row skip re-rendering when
  // a different row starts playing. play() itself must stay render-scoped:
  // it reads the selected sub-model and the active row, so freezing it in a
  // useCallback would capture stale ones. The ref is refreshed after every
  // commit, so a click always reaches the current play().
  const playRef = useRef(play);
  useLayoutEffect(() => {
    playRef.current = play;
  });
  const handlePlay = useCallback((voice: Voice) => {
    // The tap's own timestamp starts the reader's patience budget.
    playRef.current(voice, Date.now());
  }, []);

  return { active, toast, setToast, handlePlay };
}
