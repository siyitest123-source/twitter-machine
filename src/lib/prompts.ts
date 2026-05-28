import type { VoiceSample } from "./schema";

export type DraftType = "reply" | "qrt" | "original";

const TYPE_DESCRIPTIONS: Record<DraftType, string> = {
  reply:
    "A reply to the source tweet. Short (1-2 sentences typically). Adds something — a take, a question, a counterpoint, a piece of context. Never 'great post' or generic agreement. Never repeats the source's wording back.",
  qrt: "A quote-retweet. You're adding your take ON TOP of the source. The reader sees your tweet first, then the source below. Make your angle land in the first sentence. 1-3 sentences.",
  original:
    "An original post (not in response to anything). Stand-alone take, observation, or insight. 1-3 sentences. No hashtags unless they're clearly natural.",
};

function selectVoiceSamples(samples: VoiceSample[], k = 15): VoiceSample[] {
  if (samples.length <= k) return samples;
  const shuffled = [...samples].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

export function buildGenerationPrompt(args: {
  type: DraftType;
  voiceSamples: VoiceSample[];
  sourceText?: string;
  sourceHandle?: string;
  topic?: string;
  angles?: string[];
  numCandidates?: number;
}): { system: string; user: string } {
  const numCandidates = args.numCandidates ?? 3;
  const sampled = selectVoiceSamples(args.voiceSamples, 15);
  const voiceBlock = sampled.length
    ? sampled
        .map((s, i) => `<sample n="${i + 1}">\n${s.text}\n</sample>`)
        .join("\n")
    : "(no voice samples available — write in a sharp, opinionated, conversational crypto-native voice without crypto-bro cliches)";

  const system = `You are a ghostwriter for a crypto/DeFi-focused Twitter account. You write in the user's exact voice, learned from their past tweets below. You generate engagement content (replies, quote-tweets, originals) that sounds like them — never like AI, never like a generic engagement bot.

<voice-samples>
${voiceBlock}
</voice-samples>

<voice-rules>
- Match the cadence, vocabulary, and opinions of the samples above.
- Crypto-native but not cringe. No "gm", no "wagmi", no "ser", no "fam" unless the samples use them.
- No hashtags unless the samples use them.
- No emojis unless the samples use them.
- Don't open with "This is..." or "Honestly..." or any AI tell.
- Lowercase if the samples are mostly lowercase. Match capitalization style.
- Be specific, not generic. Concrete > abstract.
- Have a take. Engagement that adds nothing dies.
- Never mention contract addresses, token tickers as financial advice, or anything that could be read as a shill.
- Keep replies under 240 characters unless the angle demands more.
</voice-rules>

<safety>
If the source tweet is a scam, rugpull, obvious shill, or contains a contract address you don't recognize, output an empty candidates array and explain in the "skipped_reason" field. Never engage with potential scams.
</safety>`;

  const angleBlock = args.angles?.length
    ? `\n<requested-angles>\n${args.angles.map((a) => `- ${a}`).join("\n")}\n</requested-angles>`
    : "";

  const sourceBlock =
    args.type === "original"
      ? args.topic
        ? `<topic>\n${args.topic}\n</topic>`
        : "<topic>(no topic specified — write a strong original take based on what's currently relevant in crypto/DeFi)</topic>"
      : `<source-tweet>
${args.sourceHandle ? `From @${args.sourceHandle.replace(/^@/, "")}:` : ""}
${args.sourceText ?? "(no source text provided)"}
</source-tweet>${angleBlock}`;

  const user = `Generate ${numCandidates} candidate ${args.type === "qrt" ? "quote-retweets" : args.type === "reply" ? "replies" : "original tweets"}.

${TYPE_DESCRIPTIONS[args.type]}

${sourceBlock}

Respond ONLY with valid JSON in this exact shape:
{
  "candidates": [
    { "text": "the tweet text", "angle": "short label for the angle, max 4 words" }
  ],
  "skipped_reason": null
}

If you're refusing to engage (scam/shill detected), use:
{ "candidates": [], "skipped_reason": "short reason" }`;

  return { system, user };
}

export type WeeklyPlanInput = {
  voiceSamples: VoiceSample[];
  themes: string[];
  avoid?: string[];
  postsPerDay?: number;
  daysInWeek?: number;
  startDateISO: string;
};

export type PlannedPost = {
  day_offset: number;
  type: "original" | "thread";
  text: string;
  thread_continuation: string[] | null;
  angle: string;
  suggested_hour_utc: number;
};

export function buildWeeklyPlanPrompt(args: WeeklyPlanInput): {
  system: string;
  user: string;
} {
  const sampled = selectVoiceSamples(args.voiceSamples, 15);
  const voiceBlock = sampled.length
    ? sampled
        .map((s, i) => `<sample n="${i + 1}">\n${s.text}\n</sample>`)
        .join("\n")
    : "(no voice samples — write in a sharp, opinionated, crypto-native voice without cliches)";

  const system = `You are a content planner for a crypto/DeFi Twitter account. Plan a week of original posts in the user's exact voice. Mix formats: hot takes, observations, data points, contrarian angles, and threads (only when a topic genuinely deserves multiple tweets).

<voice-samples>
${voiceBlock}
</voice-samples>

<rules>
- Match the cadence, vocabulary, opinions, and capitalization style of the voice samples.
- No "gm", "wagmi", "ser", "fam", "anon" unless the samples use them.
- No hashtags unless the samples use them.
- No emojis unless the samples use them.
- No "This is..." or "Honestly..." or any AI-tell openers.
- Each post must have a take, an observation, or specific information. No engagement bait.
- Threads only when the topic genuinely needs 3+ tweets. Default to single tweets.
- Vary the post types across the week — don't make every post the same shape.
- Don't repeat angles across the week. Each post should feel distinct.
- Never include contract addresses, token tickers as financial advice, or anything that reads as a shill.
- Suggested posting hours should follow crypto-Twitter peak windows: 13-17 UTC weekdays, 14-22 UTC weekends.
- Stay clearly inside the user's themes. Treat "avoid" topics as hard constraints.
</rules>`;

  const days = args.daysInWeek ?? 7;
  const total = (args.postsPerDay ?? 3) * days;
  const user = `Themes for the week: ${args.themes.join("; ")}
${args.avoid?.length ? `Avoid (do NOT post about): ${args.avoid.join("; ")}` : ""}
Days: ${days}
Posts per day: ${args.postsPerDay ?? 3} (total ${total})
Week starts: ${args.startDateISO}

Respond ONLY with valid JSON in this shape:
{
  "posts": [
    {
      "day_offset": 0,
      "type": "original",
      "text": "the tweet text",
      "thread_continuation": null,
      "angle": "short label, max 4 words",
      "suggested_hour_utc": 14
    }
  ]
}

For threads, use type: "thread", text: lead tweet, thread_continuation: array of subsequent tweets in order. day_offset 0 = ${args.startDateISO}, day_offset 6 = end of week.`;

  return { system, user };
}

export type DiscoveryInput = {
  voiceSamples: VoiceSample[];
  recentTweets: { handle?: string; text: string }[];
};

export type Narrative = {
  label: string;
  summary: string;
  tweet_indices: number[];
  heat: "rising" | "peak" | "cooling";
  suggestions: {
    text: string;
    angle: string;
    stance: "amplify" | "contrarian" | "observation";
  }[];
};

export function buildDiscoveryPrompt(args: DiscoveryInput): {
  system: string;
  user: string;
} {
  const sampled = selectVoiceSamples(args.voiceSamples, 12);
  const voiceBlock = sampled.length
    ? sampled.map((s) => `- ${s.text}`).join("\n")
    : "(no voice samples)";

  const system = `You analyze a feed of recent crypto/DeFi tweets to identify what narratives are forming, then suggest proactive original posts the user could publish to ride or counter each narrative — all in the user's voice.

<voice-samples>
${voiceBlock}
</voice-samples>

<rules>
- A narrative is a coherent topic or thesis multiple tweets are pointing at, not just a token name.
- Only include narratives with ≥ 2 supporting tweets. Skip noise.
- Heat: "rising" if it looks like it's accelerating, "peak" if it's everywhere, "cooling" if engagement seems past its peak.
- For each narrative, generate 1-2 suggested original tweets — short, opinionated, in the user's voice.
- Stances: "amplify" = ride the wave, "contrarian" = take the counter-position, "observation" = neutral framing or new data.
- Skip narratives that are clearly scams, rugpulls, or paid-shill campaigns. Note them in "skipped".
- No hashtags, no emojis (unless voice samples use them), no engagement bait.
</rules>`;

  const tweetBlock = args.recentTweets
    .map(
      (t, i) =>
        `[${i + 1}]${t.handle ? ` @${t.handle.replace(/^@/, "")}:` : ""} ${t.text}`,
    )
    .join("\n");

  const user = `Recent tweets to analyze:

${tweetBlock}

Respond ONLY with valid JSON:
{
  "narratives": [
    {
      "label": "short narrative name",
      "summary": "one sentence describing what's happening",
      "tweet_indices": [1, 5, 12],
      "heat": "rising" | "peak" | "cooling",
      "suggestions": [
        {
          "text": "the suggested tweet in the user's voice",
          "angle": "short label, max 4 words",
          "stance": "amplify" | "contrarian" | "observation"
        }
      ]
    }
  ],
  "skipped": ["narrative names you skipped and why, in one line each"]
}`;

  return { system, user };
}
