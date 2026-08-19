// Decoded-audio replay tier, ported from the reference /voices player (the
// validated legacy path in tts-microutil). A replay plays decoded PCM
// through Web Audio: a synchronous memory lookup, no media element, no
// demux, no network, the same decoded-memory path on Chrome, Safari and
// Firefox. Deliberately
// lean: no prefetch (the shared sample-url bucket must never fund
// speculative fetches) and no format negotiation. One deliberate fix over
// the reference: a context suspended by tab backgrounding resumes on the
// replay click instead of scheduling audio into silence.

const MAX_BUFFERS = 10;
const buffers = new Map<string, AudioBuffer>();

let ctx: AudioContext | null = null;

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** What the shared context can do RIGHT NOW, without creating one. */
export function contextState(): "none" | "running" | "closed" | "asleep" {
  if (!ctx) return "none";
  // Safari adds "interrupted", after a call or another app takes the audio
  // session; it needs the same waking as "suspended", so they are one state
  // here and only "running" is trusted.
  const state: string = ctx.state;
  if (state === "running" || state === "closed") return state;
  return "asleep";
}

/**
 * Wake the context and report whether it is actually running.
 *
 * iOS only starts an audio context inside a user gesture, and resume() is a
 * promise: starting a source before it settles plays into a sleeping context,
 * which is silence with a UI that says otherwise. So the caller waits for a
 * true answer and treats false as a tier miss. There is no synchronous test
 * for "this can never resume", and a resume promise can hang, so the wait
 * carries its own deadline; the late continuation is caught by the caller's
 * own generation check rather than by cancelling a promise we do not own.
 */
export async function resumeContext(deadlineMs = 1500): Promise<boolean> {
  const c = context();
  if (contextState() === "running") return true;
  if (contextState() === "closed") return false;
  try {
    await Promise.race([
      c.resume(),
      new Promise((resolve) => setTimeout(resolve, deadlineMs)),
    ]);
  } catch {
    return false;
  }
  return contextState() === "running";
}

export function getBuffer(key: string): AudioBuffer | null {
  const b = buffers.get(key);
  if (!b) return null;
  // Re-insert so eviction hits the least recently played entry.
  buffers.delete(key);
  buffers.set(key, b);
  return b;
}

/** Discard a key's decoded audio AND disown any decode still running for
 *  it. Deleting the buffer alone is not enough: an in-flight decode would
 *  finish afterwards and put the discarded sample straight back. */
export function evictBuffer(key: string): void {
  buffers.delete(key);
  generation.set(key, (generation.get(key) ?? 0) + 1);
  // Detach the abandoned job too, so a later caller offering the very same
  // bytes starts a fresh decode instead of awaiting one whose result this
  // eviction has already condemned.
  decoding.delete(key);
}

/** Bumped whenever a key's audio is discarded or replaced. A decode commits
 *  its result only if the generation it started under is still current. */
const generation = new Map<string, number>();

/** Decodes already running, so a second caller waits on the first instead
 *  of decoding the same bytes again. The completed-buffer check alone is not
 *  enough: a stop and an immediate replay can both arrive while the first
 *  decode is still pending. */
const decoding = new Map<string, { blob: Blob; job: Promise<void> }>();

/** Decode from the stored Blob's own bytes, never via fetch(blob:), which
 *  sits outside connect-src (the reference repo's hard-won CSP lesson).
 *  A decode is shared only with a caller holding the SAME bytes: replacement
 *  bytes must never wait on the outgoing blob's decode. */
export function decodeIntoCache(key: string, blob: Blob): Promise<void> {
  if (buffers.has(key)) return Promise.resolve();
  const running = decoding.get(key);
  if (running && running.blob === blob) return running.job;
  const token = generation.get(key) ?? 0;
  const job = decodeNow(key, blob, token).finally(() => {
    // Only clear our own entry: a newer decode may have replaced it.
    const current = decoding.get(key);
    if (current && current.job === job) decoding.delete(key);
  });
  decoding.set(key, { blob, job });
  return job;
}

async function decodeNow(key: string, blob: Blob, token: number): Promise<void> {
  const bytes = await blob.arrayBuffer();
  const decoded = await context().decodeAudioData(bytes);
  // Discarded while we were decoding: drop the result rather than restoring
  // audio the player deliberately threw away.
  if ((generation.get(key) ?? 0) !== token) return;
  while (buffers.size >= MAX_BUFFERS) {
    const oldest = buffers.keys().next().value;
    if (oldest === undefined) break;
    buffers.delete(oldest);
  }
  buffers.set(key, decoded);
}

export type ReplayControls = { stop: () => void };

/** Play a decoded buffer. onEnded fires on natural end, not manual stop. */
export function playBuffer(buffer: AudioBuffer, onEnded: () => void): ReplayControls {
  const c = context();
  const source = c.createBufferSource();
  const gain = c.createGain();
  let stopped = false;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(c.destination);
  source.onended = () => {
    if (!stopped) onEnded();
  };
  source.start();
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}
