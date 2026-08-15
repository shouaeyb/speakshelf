// Fixture for lib/lang.ts against the real catalog: every language code in
// the packed data must render a unique display name in every UI locale,
// with the three-Arabics distinction intact and no CLDR pseudo-region or
// raw-subtag labels leaking. Run manually after touching lib/lang.ts or
// refreshing data: node scripts/check-langnames.mjs
import { readFileSync, readdirSync } from "node:fs";

const packed = JSON.parse(readFileSync(new URL("../data/voices.packed.json", import.meta.url)));
const codes = new Set();
for (const p of Object.values(packed.providers)) for (const v of p.voices) codes.add(v[0]);

const locales = readdirSync(new URL("../messages", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

// Mirror of lib/lang.ts (kept tiny; the library is TypeScript and this
// fixture stays runnable with bare node). Keep both sides in step.
const OVERRIDES = { "ar-XA": "Arabic", "en-GB-WLS": "English (Wales)" };
const ARB_NAMES = {
  en: "Arabic (Standard)", es: "árabe (estándar)", fr: "arabe (standard)",
  pt: "árabe (padrão)", ru: "арабский (стандартный)", zh: "阿拉伯语（标准）",
  hi: "अरबी (मानक)", bn: "আরবি (প্রমিত)", ar: "العربية الفصحى",
  ja: "アラビア語 (標準)", de: "Arabisch (Standard)", it: "arabo (standard)",
  id: "Arab (Standar)", sw: "Kiarabu (Sanifu)",
};
const MSA_NAMES = {
  en: "Arabic (Modern Standard)", es: "árabe (estándar moderno)", fr: "arabe (standard moderne)",
  pt: "árabe (padrão moderno)", ru: "арабский (современный стандартный)", zh: "阿拉伯语（现代标准）",
  hi: "अरबी (आधुनिक मानक)", bn: "আরবি (আধুনিক প্রমিত)", ar: "العربية الفصحى الحديثة",
  ja: "アラビア語 (現代標準)", de: "Arabisch (Modernes Hocharabisch)", it: "arabo (standard moderno)",
  id: "Arab (Standar Modern)", sw: "Kiarabu (Sanifu cha Kisasa)",
};
const EN_SHORT = [
  ["(United States)", "(US)"], ["(United Kingdom)", "(GB)"],
  ["(Hong Kong SAR China)", "(Hong Kong)"], ["(Myanmar [Burma])", "(Myanmar)"],
];
function name(code, locale) {
  let n;
  if (code === "arb") return ARB_NAMES[locale] ?? ARB_NAMES.en;
  if (code === "ar-001") return MSA_NAMES[locale] ?? MSA_NAMES.en;
  try {
    const std = new Intl.DisplayNames([locale], { type: "language", languageDisplay: "standard" });
    if (code === "ar-XA") n = std.of("ar");
    else if (code === "jv-JV") n = std.of("jv");
    else n = std.of(code);
  } catch {}
  if (!n || n === code) n = OVERRIDES[code] ?? n ?? code;
  if (locale === "en") for (const [l, s] of EN_SHORT) if (n.endsWith(l)) n = n.slice(0, -l.length) + s;
  return n;
}

// Labels a reader must never see: CLDR's pseudo-region for ar-XA, the
// "(world)" bracket CLDR gives ar-001, and the raw "(JV)" subtag CLDR
// gives Google's jv-JV. Checked in every locale, not just English.
const JUNK = [/pseudo/i, /\(world\)/i, /\(JV\)/i];
// The English labels the three fixed codes and the two hand-mapped
// Arabics must produce. Exact, so a silent CLDR shift is a failure.
const EN_LABELS = {
  "ar-XA": "Arabic",
  "ar-001": "Arabic (Modern Standard)",
  arb: "Arabic (Standard)",
  "jv-JV": "Javanese",
  "en-GB-WLS": "English (Wales)",
  "yue-HK": "Cantonese (Hong Kong)",
  "my-MM": "Burmese (Myanmar)",
};

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(msg);
};

for (const [code, want] of Object.entries(EN_LABELS)) {
  const got = name(code, "en");
  if (got !== want) fail(`en: ${code} renders "${got}", expected "${want}"`);
}

for (const locale of locales) {
  const seen = new Map();
  for (const code of [...codes].sort()) {
    const n = name(code, locale);
    for (const junk of JUNK) {
      if (junk.test(n)) fail(`${locale}: ${code} leaks a raw CLDR label: ${n}`);
    }
    if (seen.has(n)) fail(`${locale}: collision "${n}" from ${seen.get(n)} and ${code}`);
    seen.set(n, code);
  }
  // The three Arabics ship side by side (ar-XA plain, ar-001 Modern
  // Standard, arb Standard) and must stay pairwise distinct everywhere.
  const arabics = [["arb", name("arb", locale)], ["ar-XA", name("ar-XA", locale)], ["ar-001", name("ar-001", locale)]];
  for (let i = 0; i < arabics.length; i++) {
    for (let j = i + 1; j < arabics.length; j++) {
      if (arabics[i][1] === arabics[j][1]) {
        fail(`${locale}: ${arabics[i][0]} and ${arabics[j][0]} collapse to "${arabics[i][1]}"`);
      }
    }
  }
}

console.log(
  failures === 0
    ? `OK: ${codes.size} codes unique in ${locales.length} locales, three Arabics distinct, en labels exact`
    : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
