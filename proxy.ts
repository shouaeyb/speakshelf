import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Serves the default locale unprefixed (rewrite, not redirect) and the
// other locales at their path prefix. Detection is off in the routing
// config: nothing here ever redirects by Accept-Language.
export default createMiddleware(routing);

export const config = {
  // Pages only: API routes, metadata files and static assets stay out.
  matcher: ["/((?!api|_next|llms\\.txt|sitemap\\.xml|robots\\.txt|icon\\.svg|og\\.png|.*\\..*).*)"],
};
