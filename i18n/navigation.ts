import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link/router for pages and components. Kept apart from
// routing.ts so the proxy never imports this (and, through it, the
// request config with next/root-params, which middleware cannot bundle).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
