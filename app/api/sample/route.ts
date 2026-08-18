import type { NextRequest } from "next/server";
import { normalizeFormats } from "@/lib/audio-formats";
import { getSite, getSiteFresh } from "@/lib/catalog";
import { rateLimit, upstreamMissAllowed } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://aitts.theproductivepixel.com/api/v1";

// Signed sample URLs carry their own expiry, which upstream reports as an
// absolute timestamp. We keep a cached URL until shortly before that moment
// rather than for a fixed span of our own, because a URL handed to us late in
// its life would otherwise be treated as fresh by every layer below and die in
// a long-lived tab. The ceiling is a safety net for an upstream that ever
// stops reporting expiry.
//
// There are two key spaces, and the difference matters. A ready URL is
// FORMAT-SPECIFIC: one server cache serves a Safari visitor asking for AAC and
// a Chromium visitor asking for Opus, so the requested format belongs in the
// key and in the in-flight coalescing, or one of them would be handed audio it
// cannot play. That costs at most one extra cold lookup per voice per
// profile, and a browser only ever sends one of four (opus,aac,wav /
// opus,wav / aac,wav / wav), so the multiplier is bounded and steady state
// is unaffected. Generation is format-INDEPENDENT: upstream synthesizes one
// sample per voice and converts it afterwards, so the "still generating"
// answer is keyed by voice and sub-model but not format, so every retrier of a cold voice, whatever
// format it wants, coalesces into at most one upstream lookup per retry
// interval instead of each spending the process-wide miss budget. One bounded
// exception, left alone on purpose: before that first 202 has installed the
// marker, two different formats asking for the same cold voice at the same
// instant do start one upstream lookup each. Serializing that away would mean
// blocking one format behind another's lookup, which costs a reader latency to
// save at most one token.
const TTL_CEILING_MS = 20 * 60 * 60 * 1000;
const EXPIRY_SAFETY_MS = 60 * 60 * 1000;
const FALLBACK_TTL_MS = 10 * 60 * 1000;
type Entry = { url: string; exp: number; contentType?: string };
type Pending = { generating: true; retryAfter: number };
type Failure = { retryAfter: string | null; status: number };
type Result = Entry | Pending | Failure;
const cache = new Map<string, Entry | Promise<Result>>();
const generating = new Map<string, Pending & { exp: number }>();

// Audio hosts the production CSP allows (next.config.ts media-src and
// connect-src): GCS today, Cloudflare R2 pre-added for the owner's
// planned move. If upstream ever mints a sample URL elsewhere (a custom
// domain, another bucket provider), this warns loudly in the server log
// before visitors hit the CSP wall.
const KNOWN_AUDIO_HOSTS = ["storage.googleapis.com", ".r2.dev", ".r2.cloudflarestorage.com"];
const warnedHosts = new Set<string>();

function checkAudioHost(url: string): void {
  try {
    const host = new URL(url).hostname;
    const known = KNOWN_AUDIO_HOSTS.some((h) => host === h || host.endsWith(h));
    if (!known && !warnedHosts.has(host)) {
      warnedHosts.add(host);
      console.warn(
        `sample audio host "${host}" is not in the CSP allowlist; production playback from it will be blocked until next.config.ts adds it`,
      );
    }
  } catch {
    // Unparseable URL: the client will surface the failure on its own.
  }
}

async function lookup(id: string, model: string, formats: string, key: string): Promise<Result> {
  const params = new URLSearchParams();
  if (model) params.set("model", model);
  if (formats) params.set("formats", formats);
  const qs = params.size > 0 ? `?${params}` : "";
  const res = await fetch(`${API_BASE}/voices/${encodeURIComponent(id)}/sample-url${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (res.status === 202) {
    const body = (await res.json().catch(() => null)) as { data?: { retry_after?: number } } | null;
    return { generating: true, retryAfter: Number(body?.data?.retry_after) || 5 };
  }
  if (!res.ok) {
    return { retryAfter: res.headers.get("retry-after"), status: res.status };
  }
  const body = (await res.json()) as {
    data?: { sample_url?: string; expires_at?: string; content_type?: string };
  };
  const url = body.data?.sample_url;
  if (!url) return { retryAfter: null, status: 404 };
  checkAudioHost(url);
  // Upstream reports when this URL dies. Stop trusting it an hour early, and
  // never hold one longer than the ceiling even if that timestamp is missing
  // or absurd.
  const now = Date.now();
  const reported = Date.parse(body.data?.expires_at ?? "");
  const expiresAt = Number.isFinite(reported) ? reported : now + TTL_CEILING_MS;
  let exp = Math.min(expiresAt - EXPIRY_SAFETY_MS, now + TTL_CEILING_MS);

  // A compressed preview is made shortly after a sample first exists, so a
  // request that asked for one and got WAV has most likely arrived during
  // that gap. Holding that WAV for a day would pin the voice to the large
  // file long after the small one landed, so this answer is kept briefly and
  // then asked again.
  const contentType = body.data?.content_type;
  const wantedCompressed = formats !== "" && !formats.startsWith("wav");
  if (wantedCompressed && contentType === "audio/wav") {
    exp = Math.min(exp, now + FALLBACK_TTL_MS);
  }
  return { url, exp, contentType };
}

export async function GET(req: NextRequest) {
  // A generous per-IP bucket in front of the only non-static route. The
  // signed-URL cache below is what protects the shared upstream budget;
  // this just stops one caller from hammering the server itself.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests, slow down a little" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let site = await getSite();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let voice = site.byId.get(id);
  if (!voice) {
    // A voice added upstream after the last refresh should be playable as
    // soon as a page shows it; the fresh floor keeps guessing traffic from
    // turning this into an upstream fetch storm.
    site = await getSiteFresh();
    voice = site.byId.get(id);
  }
  if (!voice) {
    return Response.json({ error: "Unknown voice id" }, { status: 404 });
  }

  const model = req.nextUrl.searchParams.get("model") ?? "";
  const models = site.providers.get(voice.provider)?.models ?? {};
  if (model && !(models[voice.family] ?? []).includes(model)) {
    return Response.json({ error: "Invalid model for this voice" }, { status: 400 });
  }

  const key = process.env.TTS_API_KEY;
  if (!key) {
    return Response.json({ error: "Server is missing TTS_API_KEY" }, { status: 500 });
  }

  // A visitor states which formats their browser can play. Anything we do not
  // recognize is refused here rather than forwarded, so a bad list can never
  // become an upstream request.
  const rawFormats = req.nextUrl.searchParams.get("formats");
  const formats = normalizeFormats(rawFormats);
  if (rawFormats !== null && !formats) {
    return Response.json({ error: "Unsupported audio format requested" }, { status: 400 });
  }
  const profile = formats ? formats.join(",") : "";

  const voiceKey = model ? `${id}|${model}` : id;
  const cacheKey = profile ? `${voiceKey}#${profile}` : voiceKey;

  let entry = cache.get(cacheKey);
  if (entry && !(entry instanceof Promise) && entry.exp <= Date.now()) {
    cache.delete(cacheKey);
    entry = undefined;
  }
  if (!entry) {
    // Only a genuine miss consults the marker. A voice can be mid-generation
    // for one format while another format's URL is already cached and
    // playable, and answering that reader "still preparing" would hold a
    // ready sample back for the marker's whole life.
    const marker = generating.get(voiceKey);
    if (marker && marker.exp > Date.now()) {
      return Response.json({ status: "generating", retry_after: marker.retryAfter }, { status: 202 });
    }
    if (marker) generating.delete(voiceKey);
    // Cache miss: this is the only path that spends the shared upstream
    // allowance, so it carries its own process-wide budget.
    if (!upstreamMissAllowed()) {
      return Response.json(
        { error: "Busy fetching new samples, try again shortly" },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }
    const pending = lookup(id, model, profile, key);
    cache.set(cacheKey, pending);
    pending.then(
      (r) => {
        if ("url" in r) {
          cache.set(cacheKey, r);
          // A ready answer proves generation finished, so a marker left from
          // an earlier attempt must not outlive it.
          generating.delete(voiceKey);
        } else if ("generating" in r) {
          cache.delete(cacheKey);
          // Markers live seconds, and a voice nobody asks about again would
          // otherwise keep its dead entry forever, so a crowded map sheds the
          // expired ones before adding another.
          const now = Date.now();
          if (generating.size > 64) {
            for (const [k, m] of generating) if (m.exp <= now) generating.delete(k);
          }
          generating.set(voiceKey, { ...r, exp: now + Math.min(Math.max(r.retryAfter, 3), 15) * 1000 });
        } else cache.delete(cacheKey);
      },
      () => cache.delete(cacheKey),
    );
    entry = pending;
  }

  let result: Result;
  try {
    result = await entry;
  } catch {
    return Response.json({ error: "Sample lookup failed" }, { status: 502 });
  }

  if ("url" in result) {
    // reuseUntil travels with the URL so the browser expires its copy against
    // the same moment this server does, instead of starting a fresh clock on
    // a URL that may already be most of the way through its life.
    return Response.json({ url: result.url, reuseUntil: result.exp, contentType: result.contentType });
  }
  if ("generating" in result) {
    return Response.json({ status: "generating", retry_after: result.retryAfter }, { status: 202 });
  }
  if (result.status === 429) {
    return Response.json(
      { error: "Upstream rate limit reached, try again shortly" },
      { status: 503, headers: { "Retry-After": result.retryAfter ?? "60" } },
    );
  }
  if (result.status === 404) {
    return Response.json({ error: "No sample available for this voice yet" }, { status: 404 });
  }
  return Response.json({ error: "Sample lookup failed" }, { status: 502 });
}
