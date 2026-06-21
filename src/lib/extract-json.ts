/**
 * Extract the first complete JSON value (object or array) from an LLM
 * response, ignoring any prose, markdown fences, or trailing notes around it.
 *
 * Naive `indexOf("{")` + `lastIndexOf("}")` breaks when the model appends a
 * sentence that itself contains a brace/bracket — the slice then runs past
 * the real value and JSON.parse throws "Unexpected non-whitespace character
 * after JSON". This scans for the matching close, tracking string literals so
 * braces/brackets inside string values don't miscount.
 */
export function extractJson<T>(text: string, kind: "object" | "array" = "object"): T {
  const open = kind === "array" ? "[" : "{";
  const close = kind === "array" ? "]" : "}";
  const start = text.indexOf(open);
  if (start === -1) throw new Error(`model did not return a JSON ${kind}`);

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
    }
  }
  throw new Error(`model returned an unterminated JSON ${kind}`);
}
