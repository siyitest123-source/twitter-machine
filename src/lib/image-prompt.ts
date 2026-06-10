import { generateText } from "@/lib/claude";

/**
 * Convert a draft tweet into a compact Flux image prompt that captures the
 * mood/concept (not the literal text). Routed through Claude (subscription
 * auth, no extra cost) because raw tweet text makes terrible image prompts.
 *
 * What we tell Claude to avoid:
 * - Text inside the image — Flux still mangles it.
 * - Logos or real brand marks — hallucinated competitor logos = lawsuit bait.
 * - Real people / public figures — uncanny valley + IP risk.
 * - Real numbers in charts — Flux invents fake stats.
 */
export async function deriveImagePrompt(args: {
  tweetText: string;
  persona?: string | null;
  brandNotes?: string | null;
}): Promise<string> {
  const persona = (args.persona ?? "").trim();
  const brand = (args.brandNotes ?? "").trim();

  const system = `You translate a tweet into a single compact image-generation prompt for Flux.

Output format: ONE line, 25-50 words. Visual nouns. No quotes around the prompt. No preamble. No explanation. Just the prompt.

Rules:
- Capture the MOOD or CONCEPT, not the literal text.
- Visual specificity wins: lighting, composition, palette, materials, style ("hyperreal macro photo", "minimalist isometric illustration", "abstract data viz").
- NEVER include text, words, or letters in the image.
- NEVER include real logos, recognizable brands, or public figures.
- NEVER ask for charts with numbers (Flux will fake them).
- Crypto/DeFi appropriate aesthetic: abstract, clean, modern. No clichés like "rocket to the moon" or money rain.
- If a brand aesthetic is given, honor it (palette, mood, restrictions).`;

  const user = `Tweet:
${args.tweetText}
${persona ? `\nAccount persona: ${persona}` : ""}
${brand ? `\nBrand image notes: ${brand}` : ""}

Output only the Flux prompt.`;

  const raw = await generateText({ system, user, maxTurns: 1 });
  // Clean: strip surrounding quotes, collapse whitespace, single line.
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 1500);
}
