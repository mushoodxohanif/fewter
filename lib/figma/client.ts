import { discoverFigmaAssets } from "@/lib/figma/extract-assets";
import type {
  FigmaFrameData,
  FigmaImageFillsResponse,
  FigmaImagesResponse,
  FigmaNode,
  FigmaNodesResponse,
} from "@/lib/figma/types";

export class FigmaApiError extends Error {
  readonly status: number;
  readonly body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "FigmaApiError";
    this.status = status;
    this.body = body;
  }
}

const FIGMA_API_BASE = "https://api.figma.com/v1";

const DEFAULT_IMAGE_RENDER_OPTIONS = {
  format: "png",
  scale: "2",
} as const;

async function figmaFetch<T>(
  path: string,
  accessToken: string,
  searchParams?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${FIGMA_API_BASE}${path}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new FigmaApiError(
      `Figma API request failed (${response.status})`,
      response.status,
      body,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch a node subtree with geometry paths.
 * @see https://www.figma.com/developers/api#get-file-nodes-endpoint
 */
export async function getFileNodes(
  fileKey: string,
  nodeIds: string[],
  accessToken: string,
): Promise<FigmaNodesResponse> {
  return figmaFetch<FigmaNodesResponse>(
    `/files/${fileKey}/nodes`,
    accessToken,
    {
      ids: nodeIds.join(","),
      geometry: "paths",
    },
  );
}

/**
 * Render nodes to temporary PNG (or other format) URLs.
 * @see https://www.figma.com/developers/api#get-images-endpoint
 */
export async function getImageRenders(
  fileKey: string,
  nodeIds: string[],
  accessToken: string,
  options: { format?: "png" | "jpg" | "svg" | "pdf"; scale?: number } = {},
): Promise<FigmaImagesResponse> {
  if (nodeIds.length === 0) {
    return { err: null, images: {} };
  }

  const { format = DEFAULT_IMAGE_RENDER_OPTIONS.format, scale = 2 } = options;

  return figmaFetch<FigmaImagesResponse>(`/images/${fileKey}`, accessToken, {
    ids: nodeIds.join(","),
    format,
    scale: String(scale),
  });
}

/**
 * Resolve embedded image fill references to temporary download URLs.
 * @see https://www.figma.com/developers/api#get-image-fills-endpoint
 */
export async function getImageFills(
  fileKey: string,
  accessToken: string,
): Promise<FigmaImageFillsResponse> {
  return figmaFetch<FigmaImageFillsResponse>(
    `/files/${fileKey}/images`,
    accessToken,
  );
}

function resolveRootNode(
  response: FigmaNodesResponse,
  nodeId: string,
): FigmaNode {
  const nodeEntry = response.nodes[nodeId];

  if (!nodeEntry?.document) {
    throw new FigmaApiError(
      `Node "${nodeId}" was not found in the Figma file.`,
      404,
    );
  }

  return nodeEntry.document;
}

/**
 * Fetch nodes, discover exportable assets, and resolve all temporary image URLs.
 */
export async function fetchFigmaFrameData(
  fileKey: string,
  nodeId: string,
  accessToken: string,
): Promise<FigmaFrameData> {
  const nodesResponse = await getFileNodes(fileKey, [nodeId], accessToken);
  const rootNode = resolveRootNode(nodesResponse, nodeId);
  const assets = discoverFigmaAssets(rootNode);

  const [renderResponse, fillsResponse] = await Promise.all([
    getImageRenders(fileKey, assets.renderNodeIds, accessToken),
    assets.imageRefs.length > 0
      ? getImageFills(fileKey, accessToken)
      : Promise.resolve<FigmaImageFillsResponse>({
          error: false,
          status: 200,
          meta: { images: {} },
        }),
  ]);

  const imageFillUrls: Record<string, string> = {};
  for (const imageRef of assets.imageRefs) {
    const url = fillsResponse.meta.images[imageRef];
    if (url) {
      imageFillUrls[imageRef] = url;
    }
  }

  return {
    fileName: nodesResponse.name,
    rootNodeId: nodeId,
    rootNode,
    renderUrls: renderResponse.images,
    imageFillUrls,
    assets,
  };
}
