import type { VoiceSample } from "./schema";

export type DraftType = "reply" | "qrt" | "original" | "thread";

const TYPE_DESCRIPTIONS: Record<DraftType, string> = {
  reply:
    "A reply to the source tweet. Short (1-2 sentences typically). Adds something — a take, a question, a counterpoint, a piece of context. Never 'great post' or generic agreement. Never repeats the source's wording back.",
  qrt: "A quote-retweet. You're adding your take ON TOP of the source. The reader sees your tweet first, then the source below. Make your angle land in the first sentence. 1-3 sentences.",
  original:
    "An original post (not in response to anything). Stand-alone take, observation, or insight. 1-3 sentences. No hashtags unless they're clearly natural.",
  thread:
    "A thread — multiple linked tweets that together tell one story, build one argument, or unpack one topic. Put the lead tweet in `text` and the continuation tweets (in order) in `thread_continuation`. The lead must hook on its own — never 'this is a thread about' or 'a thread 🧵'. Aim for 3–7 tweets total, each adding something new (no recap, no padding). Each tweet ≤ 280 chars.",
};

function selectVoiceSamples(samples: VoiceSample[], k = 15): VoiceSample[] {
  if (samples.length <= k) return samples;
  const shuffled = [...samples].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

function personaBlock(persona?: string | null): string {
  if (!persona || !persona.trim()) return "";
  return `\n<account-persona>\nThis account's role, focus, and tone:\n${persona.trim()}\n</account-persona>\n`;
}

export function buildGenerationPrompt(args: {
  type: DraftType;
  voiceSamples: VoiceSample[];
  persona?: string | null;
  sourceText?: string;
  sourceHandle?: string;
  topic?: string;
  brief?: string;
  numCandidates?: number;
}): { system: string; user: string } {
  const numCandidates = args.numCandidates ?? 3;
  const sampled = selectVoiceSamples(args.voiceSamples, 15);
  const voiceBlock = sampled.length
    ? sampled
        .map((s, i) => `<sample n="${i + 1}">\n${s.text}\n</sample>`)
        .join("\n")
    : "(no voice samples available — write in a sharp, opinionated, conversational crypto-native voice without crypto-bro cliches)";

  const system = `You are a ghostwriter for a crypto/DeFi-focused Twitter account. You write in the user's exact voice, learned from their past tweets below. You generate engagement content (replies, quote-tweets, originals, threads) that sounds like them — never like AI, never like a generic engagement bot.
${personaBlock(args.persona)}
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
- For threads: each tweet ≤ 280 chars; the lead must work as a standalone hook.
</voice-rules>

<safety>
If the source tweet is a scam, rugpull, obvious shill, or contains a contract address you don't recognize, output an empty candidates array and explain in the "skipped_reason" field. Never engage with potential scams.
</safety>`;

  const briefBlock = args.brief?.trim()
    ? `\n<user-brief>\nComments / requirements from the user for this generation. Treat as guidance from your client — follow them unless they conflict with the safety rules:\n${args.brief.trim()}\n</user-brief>`
    : "";

  const needsSource = args.type === "reply" || args.type === "qrt";
  const sourceBlock = needsSource
    ? `<source-tweet>
${args.sourceHandle ? `From @${args.sourceHandle.replace(/^@/, "")}:` : ""}
${args.sourceText ?? "(no source text provided)"}
</source-tweet>${briefBlock}`
    : args.topic
      ? `<topic>\n${args.topic}\n</topic>${briefBlock}`
      : `<topic>(no topic specified — write something strong about what's currently relevant in crypto/DeFi)</topic>${briefBlock}`;

  const label =
    args.type === "qrt"
      ? "quote-retweets"
      : args.type === "reply"
        ? "replies"
        : args.type === "thread"
          ? "thread candidates"
          : "original tweets";

  const user = `Generate ${numCandidates} candidate ${label}.

${TYPE_DESCRIPTIONS[args.type]}

${sourceBlock}

Respond ONLY with valid JSON in this exact shape:
{
  "candidates": [
    {
      "text": "the tweet text (the LEAD tweet if this is a thread)",
      "thread_continuation": ${args.type === "thread" ? '["tweet 2", "tweet 3", "..."]' : "null"},
      "angle": "short label for the angle, max 4 words"
    }
  ],
  "skipped_reason": null
}

${args.type === "thread" ? "For threads, thread_continuation MUST be a non-empty array (2–6 entries) of subsequent tweets in order. Do NOT prefix them with numbers like '2/' or '3/'." : "thread_continuation must be null for non-thread types."}

If you're refusing to engage (scam/shill detected), use:
{ "candidates": [], "skipped_reason": "short reason" }`;

  return { system, user };
}

export type WeeklyPlanInput = {
  voiceSamples: VoiceSample[];
  persona?: string | null;
  brief: string;
  requirements?: string;
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

  const system = `You are a content planner for a crypto/DeFi Twitter account. Plan a week of original posts in the user's exact voice from the brief below. Mix formats: hot takes, observations, data points, contrarian angles, and threads where a topic genuinely deserves multiple tweets.
${personaBlock(args.persona)}
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
- Threads are encouraged for ideas that genuinely deserve 3+ tweets (deep takes, breakdowns, mini-essays). Default to single tweets for one-shot ideas.
- For threads: each tweet ≤ 280 chars; the lead must work as a standalone hook. No "1/", "2/" numbering inside the text.
- Vary the post types across the week — don't make every post the same shape.
- Don't repeat angles across the week. Each post should feel distinct.
- Never include contract addresses, token tickers as financial advice, or anything that reads as a shill.
- Suggested posting hours should follow crypto-Twitter peak windows: 13-17 UTC weekdays, 14-22 UTC weekends.
- Stay aligned with the user's content brief. Treat any "requirements / comments" from the user as guidance; if they include things to avoid, those are hard constraints.
</rules>`;

  const days = args.daysInWeek ?? 7;
  const total = (args.postsPerDay ?? 3) * days;
  const requirementsBlock = args.requirements?.trim()
    ? `\n<user-requirements>\nComments / requirements from the user. Follow them unless they conflict with safety rules:\n${args.requirements.trim()}\n</user-requirements>\n`
    : "";

  const user = `<content-brief>
${args.brief.trim()}
</content-brief>
${requirementsBlock}
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

For threads, use type: "thread", text: lead tweet, thread_continuation: array of 2-6 subsequent tweets in order (no "1/" / "2/" numbering inside the text). day_offset 0 = ${args.startDateISO}, day_offset 6 = end of week.`;

  return { system, user };
}

export type DiscoveryInput = {
  voiceSamples: VoiceSample[];
  persona?: string | null;
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
${personaBlock(args.persona)}
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
