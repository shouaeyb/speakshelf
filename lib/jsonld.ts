// JSON-LD is injected with dangerouslySetInnerHTML, and JSON.stringify
// does not escape "<": a hostile value containing "</script>" in upstream
// catalog data could otherwise terminate the script element. Escaping the
// angle bracket as the < JSON sequence is valid JSON and inert HTML,
// so every JSON-LD block goes through here.
export function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
