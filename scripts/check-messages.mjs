// Structural gate for the fourteen message catalogs, born in the round-5
// translation review (docs/decisions.md). en.json is the source of truth;
// every other catalog must match it in shape, not in wording:
//
// - identical key sets, recursively;
// - identical ICU argument names per key (a translation may neither invent
//   an argument nor drop one, since a dropped one hides data and an
//   invented one throws at render time);
// - compatible argument types: equal, or en "number" upgraded to a locale
//   "plural"/"selectordinal" (Russian counts decline, English ones do not);
//   the reverse direction is a downgrade and fails;
// - identical rich-tag sets per key (<link> pairs survive translation; this
//   also catches the ICU apostrophe trap, where a bare ' before a tag eats
//   it: the tag then vanishes from the AST and the set comparison fails);
// - plural branches legal for ICU (the parser enforces a required "other");
// - "Speakshelf" appears verbatim wherever the en string carries it;
// - no em dashes, except Russian, where the copular тире is grammar, not
//   AI prose (design.md records the exemption);
// - suggest.invite equals the INVITES entry in i18n/locales.ts per locale,
//   so the two copies of the invitation can never drift apart.
//
// Run: node scripts/check-messages.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "messages");
const EM_DASH_EXEMPT = new Set(["ru"]);

const failures = [];
const fail = (msg) => failures.push(msg);

function leaves(node, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") leaves(value, path, out);
    else out.set(path, value);
  }
  return out;
}

/** Collect {args: Map(name -> kind), tags: Set(name)} from an ICU AST. */
function shape(ast, acc = { args: new Map(), tags: new Set() }) {
  for (const node of ast) {
    if (node.type === TYPE.argument) noteArg(acc, node.value, "argument");
    else if (node.type === TYPE.number) noteArg(acc, node.value, "number");
    else if (node.type === TYPE.date || node.type === TYPE.time) noteArg(acc, node.value, "datetime");
    else if (node.type === TYPE.plural || node.type === TYPE.select) {
      noteArg(acc, node.value, node.type === TYPE.plural ? "plural" : "select");
      for (const option of Object.values(node.options)) shape(option.value, acc);
    } else if (node.type === TYPE.tag) {
      acc.tags.add(node.value);
      shape(node.children, acc);
    }
  }
  return acc;
}
function noteArg(acc, name, kind) {
  const prior = acc.args.get(name);
  // plural over number is the meaningful distinction; keep the strongest.
  if (!prior || prior === "argument" || (prior === "number" && kind === "plural")) acc.args.set(name, kind);
}
// One-way compatibility: a locale may ADD formatting to an argument (bare
// to number, bare or number to plural: Russian counts decline where
// English ones do not) but may never drop it. A plural or number collapsed
// to a bare {arg} renders unpluralized or ungrouped, and must fail here.
const compatible = (enKind, locKind) =>
  enKind === locKind ||
  (enKind === "number" && locKind === "plural") ||
  (enKind === "argument" && (locKind === "number" || locKind === "plural"));

const en = leaves(JSON.parse(readFileSync(join(dir, "en.json"), "utf8")));
const enShapes = new Map();
for (const [key, value] of en) {
  try {
    enShapes.set(key, shape(parse(value)));
  } catch (error) {
    fail(`en ${key}: does not parse as ICU (${error.message})`);
  }
}

const localeFiles = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");
let checkedKeys = 0;

for (const file of localeFiles) {
  const locale = file.replace(".json", "");
  const messages = leaves(JSON.parse(readFileSync(join(dir, file), "utf8")));

  for (const key of en.keys()) if (!messages.has(key)) fail(`${locale}: missing key ${key}`);
  for (const key of messages.keys()) if (!en.has(key)) fail(`${locale}: extra key ${key}`);

  for (const [key, value] of messages) {
    if (!en.has(key)) continue;
    checkedKeys++;
    let parsed;
    try {
      parsed = shape(parse(value));
    } catch (error) {
      fail(`${locale} ${key}: does not parse as ICU (${error.message})`);
      continue;
    }
    const source = enShapes.get(key);
    if (!source) continue;
    for (const [name, kind] of source.args) {
      const locKind = parsed.args.get(name);
      if (!locKind) fail(`${locale} ${key}: drops argument {${name}}`);
      else if (!compatible(kind, locKind)) fail(`${locale} ${key}: {${name}} is ${kind} in en but ${locKind} here`);
    }
    for (const name of parsed.args.keys()) {
      if (!source.args.has(name)) fail(`${locale} ${key}: invents argument {${name}}`);
    }
    const missingTags = [...source.tags].filter((t) => !parsed.tags.has(t));
    const extraTags = [...parsed.tags].filter((t) => !source.tags.has(t));
    for (const t of missingTags) fail(`${locale} ${key}: loses <${t}> (check for a bare ICU apostrophe before it)`);
    for (const t of extraTags) fail(`${locale} ${key}: invents <${t}>`);
    if (en.get(key).includes("Speakshelf") && !value.includes("Speakshelf"))
      fail(`${locale} ${key}: "Speakshelf" must appear verbatim`);
    if (value.includes("—") && !EM_DASH_EXEMPT.has(locale)) fail(`${locale} ${key}: em dash`);
  }
}

// The invitation strip renders INVITES from i18n/locales.ts; messages carry
// a suggest.invite twin. They must agree per locale or one of them lies.
const localesTs = readFileSync(join(root, "i18n", "locales.ts"), "utf8");
for (const file of ["en.json", ...localeFiles]) {
  const locale = file.replace(".json", "");
  const invite = leaves(JSON.parse(readFileSync(join(dir, file), "utf8"))).get("suggest.invite");
  const match = localesTs.match(new RegExp(`${locale}:\\s*\\{\\s*invite:\\s*"([^"]+)"`));
  if (!match) fail(`INVITES: no entry found for ${locale}`);
  else if (match[1] !== invite) fail(`${locale}: suggest.invite "${invite}" != INVITES "${match[1]}"`);
}

if (failures.length > 0) {
  for (const message of failures) console.error("FAIL " + message);
  process.exit(1);
}
console.log(
  `${localeFiles.length} catalogs match en.json: ${checkedKeys} keys checked for arguments, types, tags, brand, dashes; invites in sync`,
);
