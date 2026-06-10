import type {
  FigmaAssetDiscovery,
  FigmaAssetRef,
  FigmaNode,
  FigmaPaint,
} from "@/lib/figma/types";

/** Maximum raster/image assets collected per conversion (plan risk mitigation). */
export const MAX_FIGMA_ASSETS = 20;

const RENDER_NODE_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "LINE",
  "ELLIPSE",
  "REGULAR_POLYGON",
  "IMAGE",
  "COMPONENT",
  "INSTANCE",
]);

function isVisible(node: FigmaNode): boolean {
  return node.visible !== false;
}

function collectImageRefsFromPaints(
  paints: FigmaPaint[] | undefined,
  imageRefs: Set<string>,
  assets: FigmaAssetRef[],
  nodeName: string,
): void {
  if (!paints) {
    return;
  }

  for (const paint of paints) {
    if (paint.type !== "IMAGE" || !paint.imageRef || paint.visible === false) {
      continue;
    }

    if (imageRefs.has(paint.imageRef)) {
      continue;
    }

    imageRefs.add(paint.imageRef);
    assets.push({
      key: paint.imageRef,
      kind: "image-fill",
      imageRef: paint.imageRef,
      name: nodeName,
    });
  }
}

function walkNode(
  node: FigmaNode,
  renderNodeIds: Set<string>,
  imageRefs: Set<string>,
  assets: FigmaAssetRef[],
): void {
  if (!isVisible(node)) {
    return;
  }

  if (RENDER_NODE_TYPES.has(node.type)) {
    if (!renderNodeIds.has(node.id)) {
      renderNodeIds.add(node.id);
      assets.push({
        key: node.id,
        kind: "node-render",
        nodeId: node.id,
        name: node.name,
      });
    }
  }

  collectImageRefsFromPaints(node.fills, imageRefs, assets, node.name);
  collectImageRefsFromPaints(node.strokes, imageRefs, assets, node.name);

  if (node.children) {
    for (const child of node.children) {
      walkNode(child, renderNodeIds, imageRefs, assets);
    }
  }
}

export class FigmaAssetLimitError extends Error {
  constructor(limit: number) {
    super(
      `Design contains more than ${limit} exportable images. Simplify the frame or reduce icon count.`,
    );
    this.name = "FigmaAssetLimitError";
  }
}

/**
 * Walk a Figma node subtree and collect nodes/image fills that need hosting.
 *
 * - **node-render**: vectors, icons, components, instances, and IMAGE nodes
 * - **image-fill**: embedded bitmap fills referenced by `imageRef`
 */
export function discoverFigmaAssets(rootNode: FigmaNode): FigmaAssetDiscovery {
  const renderNodeIds = new Set<string>();
  const imageRefs = new Set<string>();
  const assets: FigmaAssetRef[] = [];

  walkNode(rootNode, renderNodeIds, imageRefs, assets);

  if (assets.length > MAX_FIGMA_ASSETS) {
    throw new FigmaAssetLimitError(MAX_FIGMA_ASSETS);
  }

  return {
    renderNodeIds: [...renderNodeIds],
    imageRefs: [...imageRefs],
    assets,
  };
}
