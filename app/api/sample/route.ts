import type { NextRequest } from "next/server";
import { getVoice } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://aitts.theproductivepixel.com/api/v1";

// Signed sample URLs live for 24 hours; keep them for 20 and refresh after.
const TTL_MS = 20 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; exp: number }>();

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const voice = getVoice(id);
  if (!voice) {
    return Response.json({ error: "Unknown voice id" }, { status: 404 });
  }
  if (!voice.hasSample) {
    return Response.json({ error: "No published sample for this voice" }, { status: 404 });
  }

  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) {
    return Response.redirect(hit.url, 302);
  }

  const key = process.env.TTS_API_KEY;
  if (!key) {
    return Response.json({ error: "Server is missing TTS_API_KEY" }, { status: 500 });
  }

  const res = await fetch(`${API_BASE}/voices/${encodeURIComponent(id)}/sample-url`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after") ?? "60";
    return Response.json(
      { error: "Upstream rate limit reached, try again shortly" },
      { status: 503, headers: { "Retry-After": retryAfter } },
    );
  }
  if (!res.ok) {
    return Response.json({ error: "Sample lookup failed" }, { status: 502 });
  }
  const body = (await res.json()) as { data?: { sample_url?: string } };
  const url = body.data?.sample_url;
  if (!url) {
    return Response.json({ error: "No sample available" }, { status: 404 });
  }

  cache.set(id, { url, exp: Date.now() + TTL_MS });
  return Response.redirect(url, 302);
}
