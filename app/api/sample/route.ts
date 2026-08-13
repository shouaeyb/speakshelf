import type { NextRequest } from "next/server";
import { getSite, getSiteFresh } from "@/lib/catalog";
import { rateLimit, upstreamMissAllowed } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://aitts.theproductivepixel.com/api/v1";

// Signed sample URLs live for 24 hours; keep them for 20 and refresh after.
// Misses store the in-flight promise so concurrent requests for the same
// voice share one upstream call instead of draining the rate bucket.
// Upstream returns 202 while a sample is being generated for the first
// time; that is relayed to the client, which retries after a short wait.
// The generating answer is also kept for its retry interval, so every
// retrier of a cold voice coalesces into at most one upstream lookup per
// interval instead of each spending the process-wide miss budget.
const TTL_MS = 20 * 60 * 60 * 1000;
type Entry = { url: string; exp: number };
type Pending = { generating: true; retryAfter: number };
type Failure = { retryAfter: string | null; status: number };
type Result = Entry | Pending | Failure;
const cache = new Map<string, Entry | (Pending & { exp: number }) | Promise<Result>>();

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

async function lookup(id: string, model: string, key: string): Promise<Result> {
  const qs = model ? `?model=${encodeURIComponent(model)}` : "";
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
  const body = (await res.json()) as { data?: { sample_url?: string } };
  const url = body.data?.sample_url;
  if (!url) return { retryAfter: null, status: 404 };
  checkAudioHost(url);
  return { url, exp: Date.now() + TTL_MS };
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

  const cacheKey = model ? `${id}|${model}` : id;
  let entry = cache.get(cacheKey);
  if (entry && !(entry instanceof Promise) && entry.exp <= Date.now()) {
    cache.delete(cacheKey);
    entry = undefined;
  }
  if (!entry) {
    // Cache miss: this is the only path that spends the shared upstream
    // allowance, so it carries its own process-wide budget.
    if (!upstreamMissAllowed()) {
      return Response.json(
        { error: "Busy fetching new samples, try again shortly" },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }
    const pending = lookup(id, model, key);
    cache.set(cacheKey, pending);
    pending.then(
      (r) => {
        if ("url" in r) cache.set(cacheKey, r);
        else if ("generating" in r)
          cache.set(cacheKey, {
            ...r,
            exp: Date.now() + Math.min(Math.max(r.retryAfter, 3), 15) * 1000,
          });
        else cache.delete(cacheKey);
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
    return Response.json({ url: result.url });
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
