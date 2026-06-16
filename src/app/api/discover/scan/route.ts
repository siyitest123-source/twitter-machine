import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAccountId } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { parseHandles, runScan } from "@/lib/scan";
import { accounts, discoveredTweets } from "@/lib/schema";

const PostSchema = z.object({
  accountId: z.number().int().positive(),
  // Freeform handles to scan (the Discover input box). When provided they're
  // saved to the account so the daily 8am job reuses them. Omit (e.g. the
  // cron) to scan the account's saved handles.
  handles: z.string().max(2000).optional(),
});

/** POST /api/discover/scan — run a scan now (manual button + the 8am cron). */
export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "accountId required" }, { status: 400 });
  }
  const { accountId, handles } = parsed.data;
  const db = getDb();

  // If the caller passed handles, persist them as this account's scan list.
  let list: string[] | undefined;
  if (handles !== undefined) {
    list = parseHandles(handles);
    await db
      .update(accounts)
      .set({ scanHandles: list.join("\n") })
      .where(eq(accounts.id, accountId));
  }

  try {
    const summary = await runScan(accountId, list);
    return Response.json(summary);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** GET /api/discover/scan?accountId=&status=new — list discovered tweets. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = getDb();
  const accountId = await resolveAccountId(
    db,
    url.searchParams.get("accountId"),
  );
  if (accountId === null) {
    return Response.json({ error: "valid accountId required" }, { status: 400 });
  }
  const status = url.searchParams.get("status") ?? "new";

  const where =
    status === "all"
      ? eq(discoveredTweets.accountId, accountId)
      : and(
          eq(discoveredTweets.accountId, accountId),
          eq(
            discoveredTweets.status,
            status as "new" | "actioned" | "dismissed",
          ),
        );

  const rows = await db
    .select()
    .from(discoveredTweets)
    .where(where)
    .orderBy(desc(discoveredTweets.relevance), desc(discoveredTweets.scannedAt))
    .limit(200);

  return Response.json({ discovered: rows });
}
