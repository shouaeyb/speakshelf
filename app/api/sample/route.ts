import type { NextRequest } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://aitts.theproductivepixel.com/api/v1";

// Signed sample URLs live for 24 hours; keep them for 20 and refresh after.
// Misses store the in-flight promise so concurrent requests for the same
// voice share one upstream call instead of draining the rate bucket.
// Upstream returns 202 while a sample is being generated for the first
// time; that is relayed to the client, which retries after a short wait.
const TTL_MS = 20 * 60 * 60 * 1000;
type Entry = { url: string; exp: number };
type Pending = { generating: true; retryAfter: number };
type Failure = { retryAfter: string | null; status: number };
type Result = Entry | Pending | Failure;
const cache = new Map<string, Entry | Promise<Result>>();

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
  return { url, exp: Date.now() + TTL_MS };
}

export async function GET(req: NextRequest) {
  const catalog = await getCatalog();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const voice = catalog.byId.get(id);
  if (!voice) {
    return Response.json({ error: "Unknown voice id" }, { status: 404 });
  }

  const model = req.nextUrl.searchParams.get("model") ?? "";
  if (model && !(catalog.models[voice.family] ?? []).includes(model)) {
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
    const pending = lookup(id, model, key);
    cache.set(cacheKey, pending);
    pending.then(
      (r) => {
        if ("url" in r) cache.set(cacheKey, r);
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
