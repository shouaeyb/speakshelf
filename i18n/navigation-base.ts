import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Raw next-intl navigation. Almost nothing should import this directly:
// components take Link from i18n/navigation, which wraps BaseLink with the
// house glide behavior. Kept apart from routing.ts so the proxy never
// imports this (and, through it, the request config with next/root-params,
// which middleware cannot bundle).
export const {
  Link: BaseLink,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);
