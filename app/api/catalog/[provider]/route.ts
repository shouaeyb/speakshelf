import { getPackedProvider } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/providers";

// The client explorer fetches its provider's packed catalog from here, so
// the voice list in the browser tracks the daily server refresh instead of
// being frozen into a build artifact. One slice per provider: google is
// most of the data, and the smaller shelves should not pay for it.
export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams(): { provider: string }[] {
  return PROVIDERS.map((p) => ({ provider: p.key }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const packed = await getPackedProvider(provider);
  if (!packed) {
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  }
  return Response.json(packed, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
