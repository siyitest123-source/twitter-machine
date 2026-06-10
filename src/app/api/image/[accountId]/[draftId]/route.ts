import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IMAGES_DIR } from "@/lib/image";

/**
 * GET /api/image/[accountId]/[draftId] — serve a generated image from the
 * out-of-tree storage at ~/.twitter-factory/images/. Long-cache the bytes
 * since they're immutable per-draft (regen rewrites the file in place,
 * URL stays the same — fine, we cache-bust client-side with ?t=updatedAt).
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/image/[accountId]/[draftId]">,
) {
  const { accountId, draftId } = await ctx.params;
  if (!/^\d+$/.test(accountId) || !/^\d+$/.test(draftId)) {
    return new Response("bad request", { status: 400 });
  }

  const fsPath = join(IMAGES_DIR, accountId, `${draftId}.jpg`);
  if (!existsSync(fsPath)) {
    return new Response("not found", { status: 404 });
  }

  const bytes = readFileSync(fsPath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300, must-revalidate",
    },
  });
}
