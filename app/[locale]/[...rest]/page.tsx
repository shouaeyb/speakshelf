import { notFound } from "next/navigation";

// Deep unmatched paths under a locale (/a/b/c, /ar/x/y). The named routes
// beside this one win at every depth they cover: a one-segment path goes to
// [provider], a three-segment /{provider}/voices/{lang} goes to the language
// page, and only what nothing else claims lands here. Its whole job is to
// reach the branded app/[locale]/not-found.tsx with a real 404 status
// instead of Next's bare unbranded page. No generateStaticParams: there is
// no set of garbage paths worth prerendering, so this renders on demand and
// then 404s.
export default async function CatchAll({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  // The params are awaited and discarded on purpose: reaching this segment
  // at all is the whole answer, and awaiting keeps the notFound() call on
  // the render path where Next can catch it.
  await params;
  notFound();
}
