// Which audio format a visitor's browser should be sent for a sample.
//
// The upstream service stores every ready sample three ways: the original WAV
// plus an Opus and an AAC preview made by a conversion task. Asking for a
// compressed one is the difference between a 460KB download and roughly a
// tenth of that, which is most of the wait before a sample starts playing.
// The API only serves compressed audio when the caller states a preference, so
// silence here means WAV.
//
// The preference is ordered and it is a wish, not a promise: a voice whose
// preview has not been converted yet still answers with WAV, which every
// browser plays. That is why "wav" always ends the list.

/** Formats the sample API understands, richest first. */
export const SAMPLE_FORMATS = ["opus", "aac", "wav"] as const;

export type SampleFormat = (typeof SAMPLE_FORMATS)[number];

const SUPPORTED: readonly string[] = SAMPLE_FORMATS;

/**
 * Normalize a caller-supplied preference into an ordered, deduplicated list.
 * Returns null when the list contains anything the API does not serve, so the
 * caller can refuse rather than quietly fall back and hide the mistake.
 */
export function normalizeFormats(raw: string | null): SampleFormat[] | null {
  if (raw === null) return null;
  const parts = raw.split(",").map((part) => part.trim().toLowerCase());
  if (parts.some((part) => part.length === 0)) return null;
  if (!parts.every((part) => SUPPORTED.includes(part))) return null;
  return [...new Set(parts as SampleFormat[])];
}

let cached: SampleFormat[] | null = null;

/**
 * What this browser can play, best first. Safari is asked separately because
 * it decodes AAC in an MP4 container natively and has historically not played
 * Opus in Ogg; every other engine prefers Opus, which is the smallest. The
 * probe runs once per session because it costs a media element.
 */
export function preferredFormats(): SampleFormat[] {
  if (cached) return cached;
  if (typeof document === "undefined") return ["wav"];

  const audio = document.createElement("audio");
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const formats: SampleFormat[] = [];

  if (isSafari) {
    if (audio.canPlayType('audio/mp4; codecs="mp4a.40.2"')) formats.push("aac");
  } else {
    // Engines disagree about which container name they admit to supporting,
    // so a yes to any of the three means Opus is safe to request.
    const opus =
      audio.canPlayType("audio/opus") ||
      audio.canPlayType('audio/ogg; codecs="opus"') ||
      audio.canPlayType('audio/webm; codecs="opus"');
    if (opus) formats.push("opus");
    if (audio.canPlayType('audio/mp4; codecs="mp4a.40.2"')) formats.push("aac");
  }
  formats.push("wav");

  cached = formats;
  return cached;
}

/** The preference as it travels on the wire. */
export function formatsParam(): string {
  return preferredFormats().join(",");
}
