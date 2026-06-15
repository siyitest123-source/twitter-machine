import { z } from "zod";
import { resolveTweets } from "@/lib/tweet-fetch";

const BodySchema = z.object({
  urls: z.array(z.string().min(1).max(500)).min(1).max(50),
});

/**
 * POST /api/voice/resolve — turn a batch of tweet URLs (or bare ids) into
 * their text. Does NOT save; the client reviews the resolved text, then
 * posts to /api/voice like normal. Keeps the human in the loop.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { resolved, failed } = await resolveTweets(parsed.data.urls);
  return Response.json({ resolved, failed });
}
