// Fixture for lib/lang.ts against the real catalog: every language code in
// the packed data must render a bracketed display name in every UI locale,
// unique except for the one sanctioned twin pair, with no CLDR
// pseudo-region or raw-subtag labels leaking. Run manually after touching
// lib/lang.ts or lib/lang-data.mjs, or after refreshing data:
// node scripts/check-langnames.mjs
import { readFileSync, readdirSync } from "node:fs";
import {
  ARB_NAMES,
  EN_SHORT_REGIONS,
  JAVA_NAMES,
  MSA_NAMES,
  WLS_NAMES,
} from "../lib/lang-data.mjs";

const packed = JSON.parse(readFileSync(new URL("../data/voices.packed.json", import.meta.url)));
const codes = new Set();
for (const p of Object.values(packed.providers)) for (const v of p.voices) codes.add(v[0]);

const locales = readdirSync(new URL("../messages", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

// The maps come from lib/lang-data.mjs, the same file lib/lang.ts renders
// the site from: this fixture used to transcribe all five of them, so a
// label could be corrected in the library and still be graded against the
// old copy here. The resolution below stays a small reimplementation,
// because the library is TypeScript and this fixture runs under bare node.
// One ordering difference is deliberate and harmless: the library applies
// the English shortenings after the hand maps, this returns hand-mapped
// names before reaching them. No hand label ends in a shortened region
// today, and if one ever did the fixture would fail rather than pass.
function name(code, locale) {
  let n;
  if (code === "arb") return ARB_NAMES[locale] ?? ARB_NAMES.en;
  if (code === "ar-001" || code === "ar-XA") return MSA_NAMES[locale] ?? MSA_NAMES.en;
  if (code === "jv-JV") return JAVA_NAMES[locale] ?? JAVA_NAMES.en;
  if (code === "en-GB-WLS") return WLS_NAMES[locale] ?? WLS_NAMES.en;
  try {
    n = new Intl.DisplayNames([locale], { type: "language", languageDisplay: "standard" }).of(code);
  } catch {}
  if (!n) n = code;
  if (locale === "en") {
    for (const [l, s] of EN_SHORT_REGIONS) if (n.endsWith(l)) n = n.slice(0, -l.length) + s;
  }
  return n;
}

// Labels a reader must never see: CLDR's pseudo-region for ar-XA, the
// "(world)" bracket CLDR gives ar-001, and the raw "(JV)" subtag CLDR
// gives Google's jv-JV. Checked in every locale, in both bracket forms;
// a locale that translates "world" is caught by the exact-label and twin
// asserts below instead.
const JUNK = [/pseudo/i, /[(（]world[)）]/i, /[(（]JV[)）]/i];
// The English labels the fixed and hand-mapped codes must produce. Exact,
// so a silent CLDR shift is a failure.
const EN_LABELS = {
  "ar-XA": "Arabic (Modern Standard)",
  "ar-001": "Arabic (Modern Standard)",
  arb: "Arabic (Standard)",
  "ar-AE": "Arabic (UAE)",
  "jv-JV": "Javanese (Java)",
  "en-GB-WLS": "English (Wales)",
  "yue-HK": "Cantonese (Hong Kong)",
  "my-MM": "Burmese (Myanmar)",
};
// The owner's bracket rule (2026-08-16): every label carries a bracket,
// and English bracket contents stay short. 16 characters passes the
// longest sanctioned English contents today ("Modern Standard" and
// "North Macedonia", both 15) and trips on a CLDR long form returning
// ("Hong Kong SAR China" was 19).
const EN_BRACKET_MAX = 16;
// The one sanctioned same-name group: Google runs ar-XA and ar-001 as one
// register, so they share a name and their codes disambiguate. Group
// exact, so a third code joining the name is still a failure.
const TWINS = ["ar-001", "ar-XA"];

const OPENERS = { "(": ")", "（": "）" };
const CLOSERS = new Set([")", "）"]);

// Every bracket pair in a label, innermost first, plus whether they are
// balanced. Nested pairs are legal outside English: CLDR itself nests
// there (ru and es render Myanmar as "Мьянма (Бирма)" and "Myanmar
// (Birmania)" inside the label's own bracket).
function brackets(label) {
  const open = [];
  const pairs = [];
  for (let i = 0; i < label.length; i++) {
    const ch = label[i];
    if (OPENERS[ch]) open.push([ch, i]);
    else if (CLOSERS.has(ch)) {
      const last = open.pop();
      if (!last || OPENERS[last[0]] !== ch) return { balanced: false, pairs };
      pairs.push(label.slice(last[1] + 1, i));
    }
  }
  return { balanced: open.length === 0, pairs };
}

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
  const groups = new Map();
  for (const code of [...codes].sort()) {
    const n = name(code, locale);
    for (const junk of JUNK) {
      if (junk.test(n)) fail(`${locale}: ${code} leaks a raw CLDR label: ${n}`);
    }
    const { balanced, pairs } = brackets(n);
    if (!balanced) fail(`${locale}: ${code} has unbalanced brackets: ${n}`);
    else if (pairs.length === 0) fail(`${locale}: ${code} carries no bracket: ${n}`);
    else if (pairs.some((p) => p.trim() === "")) fail(`${locale}: ${code} has an empty bracket: ${n}`);
    if (locale === "en" && balanced && pairs.length > 0) {
      if (pairs.length !== 1) fail(`en: ${code} carries ${pairs.length} brackets, expected one: ${n}`);
      if (pairs[0].length > EN_BRACKET_MAX) {
        fail(`en: ${code} bracket is ${pairs[0].length} characters, over ${EN_BRACKET_MAX}: ${n}`);
      }
    }
    groups.set(n, [...(groups.get(n) ?? []), code]);
  }
  // A shared name passes only as the complete sanctioned group.
  for (const [n, shared] of groups) {
    if (shared.length < 2) continue;
    const sorted = [...shared].sort();
    if (sorted.join(",") !== TWINS.join(",")) {
      fail(`${locale}: collision "${n}" shared by ${sorted.join(", ")}`);
    }
  }
  // The twins read the same everywhere, and stay apart from Polly's arb
  // (quoted by name on the home page) and from the nearest real region.
  const [a, b] = TWINS.map((c) => name(c, locale));
  if (a !== b) fail(`${locale}: twins disagree, ${TWINS[0]} "${a}" vs ${TWINS[1]} "${b}"`);
  for (const other of ["arb", "ar-EG"]) {
    if (name(other, locale) === a) fail(`${locale}: twins collapse onto ${other}: "${a}"`);
  }
}

console.log(
  failures === 0
    ? `OK: ${codes.size} codes bracketed and unique in ${locales.length} locales, twins paired and apart from arb and ar-EG, en labels exact`
    : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
