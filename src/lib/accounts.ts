import { eq } from "drizzle-orm";
import type { getDb } from "./db";
import { type Account, accounts } from "./schema";

export async function getAccount(
  db: ReturnType<typeof getDb>,
  id: number,
): Promise<Account | null> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return row ?? null;
}

export async function accountExists(
  db: ReturnType<typeof getDb>,
  id: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return !!row;
}

/**
 * Parse and validate an accountId from a value. Returns the numeric id if it
 * refers to a real account, otherwise null.
 */
export async function resolveAccountId(
  db: ReturnType<typeof getDb>,
  raw: unknown,
): Promise<number | null> {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return (await accountExists(db, id)) ? id : null;
}
