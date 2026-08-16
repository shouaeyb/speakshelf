import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Serves the default locale unprefixed (rewrite, not redirect) and the
// other locales at their path prefix. Detection is off in the routing
// config: nothing here ever redirects by Accept-Language.
export default createMiddleware(routing);

export const config = {
  // Pages only: API routes, Next's own assets and the named static files
  // stay out, and every exclusion is exact (api/ and _next/ as directories,
  // the five files with $). The old list matched by prefix and blanket
  // (.*\..*), so /apiary, /_nextfoo and any dotted path like /foo.txt
  // skipped the middleware, landed in the app tree as a garbage "locale",
  // rendered, threw notFound() mid-render and served Next's empty-bodied
  // error document. Exact exclusions send that garbage through the locale
  // rewrite instead, where [provider]'s dynamicParams=false declines it at
  // the routing level and app/global-not-found.tsx answers it, branded and
  // readable without JavaScript. public/ holds only og.png; a new public
  // file needs its own entry here or it will 404 as a declined provider.
  matcher: ["/((?!api/|_next/|llms\\.txt$|sitemap\\.xml$|robots\\.txt$|icon\\.svg$|og\\.png$).*)"],
};
