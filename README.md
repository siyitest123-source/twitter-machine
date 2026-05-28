# Twitter Machine

Crypto/DeFi Twitter content + engagement assistant. **Manual Mode**: you paste in target tweets, Claude generates drafts in your voice, you approve and copy to post on X manually. No X API required — swap in an API adapter later.

## What's built

- **Voice training** (`/voice`) — paste your past tweets; the generator uses 15 random samples as in-context examples per request.
- **Target accounts** (`/targets`) — reference list of accounts you engage with (engage / monitor / amplify modes).
- **Generate** (`/generate`) — paste a source tweet (or topic for originals); pick reply / quote-retweet / original; get candidates with angle labels.
- **Discover Trends** (`/discover`) — paste recent crypto tweets; clusters them into narratives (rising/peak/cooling) and suggests proactive posts to ride or counter each one. Save picks to the queue.
- **Weekly Plan** (`/plan`) — feed it themes + an avoid list; generates a calendar of original posts (and threads) in your voice, scheduled by day and peak UTC hour. Auto-saves to the queue.
- **Calendar** (`/calendar`) — week grid of scheduled posts. Drag posts between days to reschedule; drop into the backlog to unschedule. Unscheduled pending drafts sit in a backlog strip you can drag onto a day.
- **Approval queue** (`/queue`) — edit, approve, reject, copy, "open in X". Shows thread continuations + scheduled dates. Status tabs for pending/approved/posted/rejected.
- **Performance** (`/performance`) — log impressions/likes/RTs/replies on posted tweets. Computes an engagement score (`likes + 2·RT + 3·replies`) and engagement rate, ranks a leaderboard, and surfaces your best angles + formats. Top performers automatically feed back into the generator's voice pool; "★ Promote to voice" adds any post to your permanent samples.
- **Scam guardrails** — built into the generation prompt: refuses to engage with potential scams or shills.

### The feedback loop

When you mark a draft **posted** (in the queue) and log its numbers (in Performance), the top 5 posts by engagement score are injected into the voice pool for every future Generate / Discover / Plan call — so the machine learns what actually works on your account, not just what sounds like you.

Coming next (when you want): scheduled auto-posting once you have X API access; engagement auto-pull instead of manual entry.

## Setup

1. LLM access uses your **Claude Code subscription** by default (via `@anthropic-ai/claude-agent-sdk`) — no API key needed. To switch to pay-as-you-go API billing instead, add to `.env.local`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   Get one at https://console.anthropic.com/

2. Install dependencies (already done if you used the scaffolder):

   ```bash
   npm install
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000

The SQLite database is auto-created at `./data/twitter-machine.db` on first request. Delete the file to reset.

## Recommended first run

1. Go to **Voice Training** and paste 30–100 of your past tweets (separated by blank lines or `---`).
2. Go to **Target Accounts** and add the 10–30 accounts you care about most.
3. See a tweet you want to react to? Go to **Generate**, paste it, pick mode, generate.
4. Review candidates in the **Approval Queue**. Edit, approve, copy, post.

## When you get X API access

Swap in a `TwitterClient` adapter (read = poll target accounts, post = auto-publish approved drafts). The DB schema is already shaped for it — the `drafts` table has `source_url`, `source_handle`, `scheduled_for`, and `status: posted` ready to use.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Drizzle ORM + better-sqlite3 (zero-setup local DB)
- Anthropic SDK (Sonnet 4.6 for generation)
- Zod for input validation
