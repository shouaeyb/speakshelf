// Language display names from BCP 47 codes, localized to any UI locale
// via Intl.DisplayNames, with manual fixes where Intl output reads
// poorly or throws. Overrides are English; other locales use Intl and
// fall back to the English override, then the raw code.

const OVERRIDES: Record<string, string> = {
  "cmn-CN": "Chinese, Mandarin (China)",
  "cmn-TW": "Chinese, Mandarin (Taiwan)",
  "yue-HK": "Chinese, Cantonese (Hong Kong)",
  "yue-CN": "Chinese, Cantonese (China)",
  "ar-XA": "Arabic",
  "arb": "Arabic, Standard",
  "jv-JV": "Javanese",
  // Polly's Welsh English region code makes Intl.DisplayNames throw.
  "en-GB-WLS": "English (Wales)",
};

const cache = new Map<string, string>();
const displays = new Map<string, Intl.DisplayNames>();

function displayNames(locale: string): Intl.DisplayNames {
  let d = displays.get(locale);
  if (!d) {
    d = new Intl.DisplayNames([locale], { type: "language" });
    displays.set(locale, d);
  }
  return d;
}

export function languageName(code: string, displayLocale = "en"): string {
  const cacheKey = `${displayLocale}|${code}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  let name: string | undefined;
  if (displayLocale === "en") {
    name = OVERRIDES[code];
  }
  if (!name) {
    try {
      name = displayNames(displayLocale).of(code) ?? undefined;
    } catch {
      name = undefined;
    }
  }
  // A code Intl cannot render in this locale still gets its English fix.
  if (!name || name === code) {
    name = OVERRIDES[code] ?? name ?? code;
  }
  cache.set(cacheKey, name);
  return name;
}
