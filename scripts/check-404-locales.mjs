// Fixture for the global 404's locale selection. app/global-not-found.tsx
// serves all fourteen locales from one prerendered document: the blocks come
// from LOCALES and cannot drift, but three facts about the locale set are
// written out by hand, because no interpolated value may enter a script tag
// and CSS cannot compare an attribute on <html> with one on a descendant.
//
// - the code list in the head script, which picks the block to show;
// - the rtl test in that same script, a copy of RTL_LOCALES;
// - the .nf-v rules in app/styles/site.css, one per locale.
//
// All three fail silently when they drift. A locale the script does not know
// renders as English; a locale the stylesheet does not know renders as a
// blank page with a correct 404 status; an RTL locale missing from the test
// renders right-to-left text in a left-to-right document. So they are
// asserted against i18n/locales.ts here rather than trusted to a comment.
// Run after touching any of those files, or after adding a locale:
// node scripts/check-404-locales.mjs
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const localesTs = read("../i18n/locales.ts");
const page = read("../app/global-not-found.tsx");
const css = read("../app/styles/site.css");

const quoted = (text) => [...text.matchAll(/"([a-z]{2}(?:-[A-Za-z]+)?)"/g)].map((m) => m[1]);
const sorted = (codes) => [...new Set(codes)].sort().join(", ");

let failures = 0;
const fail = (message) => {
  failures++;
  console.error(message);
};
const need = (label, pattern, text) => {
  const match = text.match(pattern);
  if (!match) fail(`${label}: nothing matched ${pattern}`);
  return match;
};

// The source of truth.
const localesMatch = need("LOCALES", /export const LOCALES = \[([\s\S]*?)\]/, localesTs);
const rtlMatch = need("RTL_LOCALES", /RTL_LOCALES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/, localesTs);
const defaultMatch = need("DEFAULT_LOCALE", /DEFAULT_LOCALE[^=]*=\s*"([a-z-]+)"/, localesTs);
const locales = localesMatch ? quoted(localesMatch[1]) : [];
const rtl = rtlMatch ? quoted(rtlMatch[1]) : [];
const defaultLocale = defaultMatch ? defaultMatch[1] : "";
const prefixed = locales.filter((l) => l !== defaultLocale);

// The head script: the codes it will act on, and the codes it calls rtl.
const bootMatch = need("head script code list", /\[((?:\s*"[a-z-]+",?)+)\]\.indexOf\(c\)/, page);
const dirMatch = need("head script rtl test", /setAttribute\("dir",([\s\S]*?)\?\s*"rtl"/, page);
if (bootMatch && sorted(quoted(bootMatch[1])) !== sorted(prefixed)) {
  fail(`head script list is [${sorted(quoted(bootMatch[1]))}], expected [${sorted(prefixed)}]`);
}
if (dirMatch && sorted(quoted(dirMatch[1])) !== sorted(rtl)) {
  fail(`head script rtl test names [${sorted(quoted(dirMatch[1]))}], expected [${sorted(rtl)}]`);
}

// The stylesheet: the base rule that hides every block, then one showing
// rule per locale, with the same code on both sides of the selector.
if (!/\.nf-v\s*\{\s*display:\s*none;?\s*\}/.test(css)) {
  fail("site.css: no `.nf-v { display: none }` rule, so every locale would show at once");
}
const shown = [];
for (const m of css.matchAll(/html\[data-l="([a-z-]+)"\]\s+\.nf-v\[data-l="([a-z-]+)"\]\s*\{\s*display:\s*block/g)) {
  if (m[1] !== m[2]) fail(`site.css: rule pairs html[data-l="${m[1]}"] with .nf-v[data-l="${m[2]}"]`);
  shown.push(m[1]);
}
if (sorted(shown) !== sorted(locales)) {
  fail(`site.css shows [${sorted(shown)}], expected one rule per locale [${sorted(locales)}]`);
}

console.log(
  failures === 0
    ? `OK: ${locales.length} locales selectable on the global 404, ${prefixed.length} in the head script, ${rtl.length} rtl, ${shown.length} stylesheet rules`
    : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
