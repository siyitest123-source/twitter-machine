import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Outside the project tree (Turbopack watcher doesn't see it). Override
// with TWITTER_FACTORY_IMAGES_DIR if you want them elsewhere (e.g. shared
// volume in production).
export const IMAGES_DIR =
  process.env.TWITTER_FACTORY_IMAGES_DIR ??
  join(homedir(), ".twitter-factory", "images");

export type ImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

const FAL_FLUX_SCHNELL = "https://fal.run/fal-ai/flux/schnell";

type FalResponse = {
  images?: { url: string; content_type?: string }[];
  seed?: number;
};

/**
 * Generate an image via fal.ai's Flux schnell (~$0.003 / image, 1-2s) and
 * persist it locally. Returns the public-facing URL (served by our own
 * /api/image route) plus the file path on disk.
 *
 * Throws if FAL_KEY is missing or fal.ai returns no image.
 */
export async function generateAndStoreImage(args: {
  prompt: string;
  accountId: number;
  draftId: number;
  imageSize?: ImageSize;
}): Promise<{ url: string; path: string; bytes: number }> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error(
      "FAL_KEY not set. Get one at https://fal.ai (free $5 credit), add it to .env.local, rebuild and bounce the server.",
    );
  }

  const res = await fetch(FAL_FLUX_SCHNELL, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: args.prompt,
      image_size: args.imageSize ?? "landscape_16_9",
      num_images: 1,
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fal.ai ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as FalResponse;
  const first = data.images?.[0];
  if (!first?.url) {
    throw new Error("fal.ai returned no image url");
  }

  // Download the image bytes immediately — fal.ai deletes files after ~7d.
  const imgRes = await fetch(first.url);
  if (!imgRes.ok) {
    throw new Error(`image download failed (${imgRes.status})`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const dir = join(IMAGES_DIR, String(args.accountId));
  mkdirSync(dir, { recursive: true });
  const filename = `${args.draftId}.jpg`;
  const fsPath = join(dir, filename);
  writeFileSync(fsPath, buf);

  return {
    url: `/api/image/${args.accountId}/${args.draftId}`,
    path: fsPath,
    bytes: buf.length,
  };
}
