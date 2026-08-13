import { getPacked } from "@/lib/catalog";

// The client explorer fetches the current catalog from here, so the voice
// list in the browser tracks the daily server refresh instead of being
// frozen into a build artifact.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const packed = await getPacked();
  return Response.json(packed, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
