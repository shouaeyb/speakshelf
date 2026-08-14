// Fixture for lib/lang.ts against the real catalog: every language code in
// the packed data must render a unique display name in every UI locale,
// with the three-Arabics distinction intact and no CLDR pseudo-region
// labels leaking. Run manually after touching lib/lang.ts or refreshing
// data: node scripts/check-langnames.mjs
import { readFileSync, readdirSync } from "node:fs";

const packed = JSON.parse(readFileSync(new URL("../data/voices.packed.json", import.meta.url)));
const codes = new Set();
for (const p of Object.values(packed.providers)) for (const v of p.voices) codes.add(v[0]);

const locales = readdirSync(new URL("../messages", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

// Mirror of lib/lang.ts (kept tiny; the library is TypeScript and this
// fixture stays runnable with bare node).
const OVERRIDES = { "ar-XA": "Arabic", "en-GB-WLS": "English (Wales)", "jv-JV": "Javanese" };
const ARB_NAMES = {
  en: "Arabic (Standard)", es: "árabe (estándar)", fr: "arabe (standard)",
  pt: "árabe (padrão)", ru: "арабский (стандартный)", zh: "阿拉伯语（标准）",
  hi: "अरबी (मानक)", bn: "আরবি (প্রমিত)", ar: "العربية الفصحى",
  ja: "アラビア語 (標準)", de: "Arabisch (Standard)", it: "arabo (standard)",
  id: "Arab (Standar)", sw: "Kiarabu (Sanifu)",
};
const EN_SHORT = [["(United States)", "(US)"], ["(United Kingdom)", "(GB)"]];
function name(code, locale) {
  let n;
  if (code === "arb") return ARB_NAMES[locale] ?? ARB_NAMES.en;
  try {
    const std = new Intl.DisplayNames([locale], { type: "language", languageDisplay: "standard" });
    if (code === "ar-XA") n = std.of("ar");
    else n = std.of(code);
  } catch {}
  if (!n || n === code) n = OVERRIDES[code] ?? n ?? code;
  if (locale === "en") for (const [l, s] of EN_SHORT) if (n.endsWith(l)) n = n.slice(0, -l.length) + s;
  return n;
}

let failures = 0;
for (const locale of locales) {
  const seen = new Map();
  for (const code of [...codes].sort()) {
    const n = name(code, locale);
    if (/pseudo/i.test(n)) {
      failures++;
      console.error(`${locale}: ${code} leaks a pseudo label: ${n}`);
    }
    if (seen.has(n)) {
      failures++;
      console.error(`${locale}: collision "${n}" from ${seen.get(n)} and ${code}`);
    }
    seen.set(n, code);
  }
  const arb = name("arb", locale);
  const arXA = name("ar-XA", locale);
  if (arb === arXA) {
    failures++;
    console.error(`${locale}: arb and ar-XA collapse to "${arb}"`);
  }
}
console.log(
  failures === 0
    ? `OK: ${codes.size} codes unique in ${locales.length} locales, Arabics distinct`
    : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
