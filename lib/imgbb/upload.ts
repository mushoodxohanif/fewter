import type { FigmaAssetRef, FigmaFrameData } from "@/lib/figma/types";

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
/** Max parallel imgbb uploads (plan risk mitigation). */
export const IMGBB_UPLOAD_CONCURRENCY = 5;

/** Maps Figma node ids and imageRef values to permanent imgbb URLs. */
export type AssetUrlMap = Record<string, string>;

export interface ImgbbUploadResult {
  assetMap: AssetUrlMap;
  warnings: string[];
}

export class ImgbbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImgbbConfigError";
  }
}

export class ImgbbUploadError extends Error {
  readonly status?: number;
  readonly body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "ImgbbUploadError";
    this.status = status;
    this.body = body;
  }
}

interface ImgbbUploadResponse {
  success?: boolean;
  status?: number;
  error?: { message?: string };
  data?: {
    url?: string;
    display_url?: string;
  };
}

function getImgbbApiKey(): string {
  const apiKey = process.env.IMGBB_API_KEY?.trim();

  if (!apiKey) {
    throw new ImgbbConfigError(
      "IMGBB_API_KEY is not configured. Add it to your environment variables.",
    );
  }

  return apiKey;
}

function resolveFigmaAssetUrl(
  asset: FigmaAssetRef,
  frameData: FigmaFrameData,
): string | null {
  if (asset.kind === "node-render" && asset.nodeId) {
    return frameData.renderUrls[asset.nodeId] ?? null;
  }

  if (asset.kind === "image-fill" && asset.imageRef) {
    return frameData.imageFillUrls[asset.imageRef] ?? null;
  }

  return null;
}

async function downloadFigmaAsset(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new ImgbbUploadError(
      `Failed to download Figma asset (${response.status})`,
      response.status,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadBufferToImgbb(
  image: Buffer,
  apiKey: string,
  name?: string,
): Promise<string> {
  const body = new URLSearchParams();
  body.set("image", image.toString("base64"));

  if (name) {
    body.set("name", name.slice(0, 100));
  }

  const response = await fetch(`${IMGBB_UPLOAD_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json()) as ImgbbUploadResponse;
  const hostedUrl = payload.data?.url ?? payload.data?.display_url;

  if (!response.ok || !payload.success || !hostedUrl) {
    const message =
      payload.error?.message ?? `imgbb upload failed (${response.status})`;
    throw new ImgbbUploadError(
      message,
      response.status,
      JSON.stringify(payload),
    );
  }

  return hostedUrl;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

interface AssetUploadTask {
  asset: FigmaAssetRef;
  sourceUrl: string;
}

interface AssetUploadOutcome {
  key: string;
  url?: string;
  warning?: string;
}

/**
 * Download Figma temporary asset URLs and re-host them on imgbb.
 *
 * Returns a map keyed by Figma node id or `imageRef` → permanent https URL.
 */
export async function uploadFigmaAssetsToImgbb(
  frameData: FigmaFrameData,
  options: { concurrency?: number } = {},
): Promise<ImgbbUploadResult> {
  const apiKey = getImgbbApiKey();
  const concurrency = options.concurrency ?? IMGBB_UPLOAD_CONCURRENCY;
  const warnings: string[] = [];
  const tasks: AssetUploadTask[] = [];

  for (const asset of frameData.assets.assets) {
    const sourceUrl = resolveFigmaAssetUrl(asset, frameData);

    if (!sourceUrl) {
      const label = asset.name ?? asset.key;
      warnings.push(
        `No download URL for asset "${label}" (${asset.kind}). It may have failed to render in Figma.`,
      );
      continue;
    }

    tasks.push({ asset, sourceUrl });
  }

  const outcomes = await mapWithConcurrency(
    tasks,
    concurrency,
    async ({ asset, sourceUrl }) => {
      const label = asset.name ?? asset.key;

      try {
        const image = await downloadFigmaAsset(sourceUrl);
        const url = await uploadBufferToImgbb(image, apiKey, label);

        return {
          key: asset.key,
          url,
        } satisfies AssetUploadOutcome;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown upload error";

        return {
          key: asset.key,
          warning: `Failed to upload "${label}": ${message}`,
        } satisfies AssetUploadOutcome;
      }
    },
  );

  const assetMap: AssetUrlMap = {};

  for (const outcome of outcomes) {
    if (outcome.url) {
      assetMap[outcome.key] = outcome.url;
      continue;
    }

    if (outcome.warning) {
      warnings.push(outcome.warning);
    }
  }

  return { assetMap, warnings };
}
