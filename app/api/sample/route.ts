import type { NextRequest } from "next/server";
import { getVoice } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://aitts.theproductivepixel.com/api/v1";

// Signed sample URLs live for 24 hours; keep them for 20 and refresh after.
// Misses store the in-flight promise so concurrent requests for the same
// voice share one upstream call instead of draining the rate bucket.
const TTL_MS = 20 * 60 * 60 * 1000;
type Entry = { url: string; exp: number };
type Failure = { retryAfter: string | null; status: number };
const cache = new Map<string, Entry | Promise<Entry | Failure>>();

async function lookup(id: string, key: string): Promise<Entry | Failure> {
  const res = await fetch(`${API_BASE}/voices/${encodeURIComponent(id)}/sample-url`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return { retryAfter: res.headers.get("retry-after"), status: res.status };
  }
  const body = (await res.json()) as { data?: { sample_url?: string } };
  const url = body.data?.sample_url;
  if (!url) return { retryAfter: null, status: 404 };
  return { url, exp: Date.now() + TTL_MS };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const voice = getVoice(id);
  if (!voice) {
    return Response.json({ error: "Unknown voice id" }, { status: 404 });
  }
  if (!voice.hasSample) {
    return Response.json({ error: "No published sample for this voice" }, { status: 404 });
  }

  const key = process.env.TTS_API_KEY;
  if (!key) {
    return Response.json({ error: "Server is missing TTS_API_KEY" }, { status: 500 });
  }

  let entry = cache.get(id);
  if (entry && !(entry instanceof Promise) && entry.exp <= Date.now()) {
    cache.delete(id);
    entry = undefined;
  }
  if (!entry) {
    const pending = lookup(id, key);
    cache.set(id, pending);
    pending.then(
      (r) => {
        if ("url" in r) cache.set(id, r);
        else cache.delete(id);
      },
      () => cache.delete(id),
    );
    entry = pending;
  }

  let result: Entry | Failure;
  try {
    result = await entry;
  } catch {
    return Response.json({ error: "Sample lookup failed" }, { status: 502 });
  }

  if ("url" in result) {
    return Response.redirect(result.url, 302);
  }
  if (result.status === 429) {
    return Response.json(
      { error: "Upstream rate limit reached, try again shortly" },
      { status: 503, headers: { "Retry-After": result.retryAfter ?? "60" } },
    );
  }
  if (result.status === 404) {
    return Response.json({ error: "No sample available" }, { status: 404 });
  }
  return Response.json({ error: "Sample lookup failed" }, { status: 502 });
}
