// The app's navigation surface. Link is the glide-aware wrapper: Next's own
// navigation scroll stays off and the app animates instead (lib/glide.ts).
// Import Link from here, never from next/link or navigation-base, or the
// page will land wherever the reader last scrolled.
export { redirect, usePathname, useRouter, getPathname } from "./navigation-base";
export { default as Link } from "@/components/GlideLink";
