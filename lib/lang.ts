// Language display names from BCP 47 codes, with a few manual fixes
// where Intl output reads poorly in a list.

const OVERRIDES: Record<string, string> = {
  "cmn-CN": "Chinese, Mandarin (China)",
  "cmn-TW": "Chinese, Mandarin (Taiwan)",
  "yue-HK": "Chinese, Cantonese (Hong Kong)",
  "ar-XA": "Arabic",
  "jv-JV": "Javanese",
};

const cache = new Map<string, string>();

let display: Intl.DisplayNames | null = null;
function displayNames(): Intl.DisplayNames {
  if (!display) {
    display = new Intl.DisplayNames(["en"], { type: "language" });
  }
  return display;
}

export function languageName(code: string): string {
  const hit = cache.get(code);
  if (hit) return hit;
  let name = OVERRIDES[code];
  if (!name) {
    try {
      name = displayNames().of(code) ?? code;
    } catch {
      name = code;
    }
  }
  cache.set(code, name);
  return name;
}
