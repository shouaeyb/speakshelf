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
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function getBuffer(key: string): AudioBuffer | null {
  const b = buffers.get(key);
  if (!b) return null;
  // Re-insert so eviction hits the least recently played entry.
  buffers.delete(key);
  buffers.set(key, b);
  return b;
}

export function evictBuffer(key: string): void {
  buffers.delete(key);
}

/** Decode from the stored Blob's own bytes, never via fetch(blob:), which
 *  sits outside connect-src (the reference repo's hard-won CSP lesson). */
export async function decodeIntoCache(key: string, blob: Blob): Promise<void> {
  if (buffers.has(key)) return;
  const bytes = await blob.arrayBuffer();
  const decoded = await context().decodeAudioData(bytes);
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
