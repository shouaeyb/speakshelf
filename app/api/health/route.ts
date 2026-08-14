import { getSite } from "@/lib/catalog";

// Warm probe for the Cloud Scheduler keep-alive job (docs/architecture.md,
// Deployment). getSite() pulls the catalog memo onto this instance so the
// first real visitor never pays the upstream fetch and parse; the memo's own
// TTL decides whether that means network work, so a probe every five minutes
// does not mean a fetch every five minutes. The x-warm-probe marker lets the
// scheduler tell this route from an intermediary answer, and no-store keeps
// every probe on the origin, which is the entire point of the probe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await getSite();
  return Response.json(
    { ok: true },
    { headers: { "x-warm-probe": "ok", "Cache-Control": "no-store" } },
  );
}
