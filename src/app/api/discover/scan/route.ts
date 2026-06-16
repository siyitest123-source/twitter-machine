import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveAccountId } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { runScan } from "@/lib/scan";
import { discoveredTweets } from "@/lib/schema";

const PostSchema = z.object({
  accountId: z.number().int().positive(),
});

/** POST /api/discover/scan — run a scan now (manual button + the 8am cron). */
export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "accountId required" }, { status: 400 });
  }
  try {
    const summary = await runScan(parsed.data.accountId);
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
