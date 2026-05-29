import { and, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveAccountId } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { drafts } from "@/lib/schema";

const QuerySchema = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "posted", "all"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  unscheduled: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    unscheduled: url.searchParams.get("unscheduled") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }
  const { from, to, unscheduled } = parsed.data;
  const status = parsed.data.status ?? "pending";
  const limit = parsed.data.limit ?? 100;
  const db = getDb();

  const accountId = await resolveAccountId(db, url.searchParams.get("accountId"));
  if (accountId === null) {
    return Response.json({ error: "valid accountId required" }, { status: 400 });
  }

  const conditions = [eq(drafts.accountId, accountId)];
  if (status !== "all") conditions.push(eq(drafts.status, status));
  if (unscheduled) {
    conditions.push(isNull(drafts.scheduledFor));
  } else {
    if (from !== undefined) conditions.push(gte(drafts.scheduledFor, from));
    if (to !== undefined) conditions.push(lt(drafts.scheduledFor, to));
  }
  // For calendar/scheduled views, hide rejected unless explicitly requested.
  if ((from !== undefined || to !== undefined) && status === "all") {
    conditions.push(ne(drafts.status, "rejected"));
  }

  const rows = await db
    .select()
    .from(drafts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(drafts.createdAt))
    .limit(limit);

  const counts = await db
    .select({ status: drafts.status, count: sql<number>`count(*)` })
    .from(drafts)
    .where(eq(drafts.accountId, accountId))
    .groupBy(drafts.status);

  return Response.json({ drafts: rows, counts });
}
