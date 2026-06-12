# Twitter Factory

Multi-account crypto/DeFi Twitter content + engagement assistant. **Manual Mode**: you paste in target tweets, Claude generates drafts in each account's voice, you approve and copy to post on X manually. No X API required — swap in an API adapter later.

## Multiple accounts

Twitter Factory hosts **many handles at once**, each fully isolated:

- Pick the active account from the sidebar switcher (selection persists in your browser).
- Each account has its **own** voice samples, persona, target list, drafts, calendar, and performance history. Nothing bleeds between accounts.
- **Persona** (set on the Accounts page) is a short description of an account's role and tone, injected into every prompt on top of its voice samples — so a protocol's official account and your personal shitposting alt sound completely different even with the same engine.
- Manage accounts at `/accounts`: create, rename, set persona, switch, or delete (deleting removes all of that account's data).
- All data persists in the local SQLite DB across restarts. The schema auto-migrates; existing single-account data is folded into a "Main" account on first launch.

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

## Setup (fresh machine)

Prereqs: **Node 20+** (22 recommended) and, on macOS, the Xcode Command Line
Tools (`xcode-select --install`) — `better-sqlite3` is a native module that
compiles during install.

```bash
git clone https://github.com/siyitest123-source/twitter-machine.git
cd twitter-machine
npm install
```

**1. LLM access (the generation engine) — pick ONE:**

- **Claude subscription (recommended, no per-token cost):** install
  [Claude Code](https://claude.com/claude-code) and run `claude` once to log
  in with your Pro/Max account. Leave `ANTHROPIC_API_KEY` unset. Generation
  routes through your subscription via `@anthropic-ai/claude-agent-sdk`,
  which reads the login from `~/.claude`. Fine for interactive use;
  rate-limited if you mass-generate.
- **API key (pay-as-you-go):** create `.env.local` in the project root with
  `ANTHROPIC_API_KEY=sk-ant-...` from https://console.anthropic.com/.
  No Claude Code install needed.

**2. Optional integrations** (each feature degrades gracefully without its key):

- **AI images** — add `FAL_KEY=...` to `.env.local`
  (https://fal.ai, free $5 credit; ~$0.003/image).
- **Typefully team review** — no env var. Paste the API key per account in
  the **Accounts** page UI (Typefully Pro → Settings → API). Stored in the
  local database, not in the repo.

**3. Build and run:**

```bash
npm run build
npm start          # production server at http://localhost:3000
```

Use `npm run dev` only while actively editing code — dev mode runs a watcher
that burns multiple CPU cores; production mode idles at ~0%.

**Optional — keep it running on macOS:** create a LaunchAgent so the server
starts at login and restarts on crash. See `~/Library/LaunchAgents/` pattern
in the repo discussion, or just keep a terminal open with `npm start`.

### Where your data lives

Everything stateful is **outside the repo** in `~/.twitter-factory/`:

| Path | Contents |
|---|---|
| `~/.twitter-factory/twitter-machine.db` | accounts, voice samples, targets, drafts, metrics, Typefully keys |
| `~/.twitter-factory/images/` | generated images |

Override with `TWITTER_FACTORY_DB_PATH` / `TWITTER_FACTORY_IMAGES_DIR`.
Delete the directory to reset. **Moving to a new machine?** Copy
`~/.twitter-factory/` over (e.g. AirDrop the folder) and all your trained
voices, drafts, and Typefully keys come with you — the repo itself carries
no data.

## Recommended first run

1. Go to **Accounts** and create your first handle (+ persona).
2. Go to **Voice Training** and paste 30–100 of your past tweets (separated by blank lines or `---`).
3. Go to **Create** (or hit ⌘K from anywhere), pick a content type, write a brief, generate.
4. Preview the candidates inline — edit, regenerate, or save the ones you like.
5. Review in the **Queue**: approve, generate an image, send to Typefully.

## For collaborators

Same setup as above. Two things to know:

- **No shared keys in the repo.** `.env.local` is gitignored; Typefully keys
  live in each person's local DB. Everyone brings their own LLM auth.
- **Data is per-machine, not shared.** Everyone gets an empty database on
  first run. For a *shared* content pipeline (same queue + voice library for
  the whole team), migrate to a hosted Postgres — see "Going multiplayer".

## Going multiplayer (shared content pipeline)

The app is built on Drizzle, so moving from per-user SQLite to a shared Postgres is a contained change:

1. Swap `better-sqlite3` for a Postgres driver in `src/lib/db.ts` and point at a hosted DB (Neon / Supabase).
2. Translate the `ensureSchema()` DDL (or generate migrations with `drizzle-kit`).
3. Add auth so drafts can be attributed to who created/approved them.

Until then, treat the repo as shared *code*, with each person running their own local instance.

## When you get X API access

Swap in a `TwitterClient` adapter (read = poll target accounts, post = auto-publish approved drafts). The DB schema is already shaped for it — the `drafts` table has `source_url`, `source_handle`, `scheduled_for`, and `status: posted` ready to use.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Drizzle ORM + better-sqlite3 (zero-setup local DB)
- `@anthropic-ai/claude-agent-sdk` (Sonnet 4.6 for generation; subscription or API-key auth)
- Zod for input validation
