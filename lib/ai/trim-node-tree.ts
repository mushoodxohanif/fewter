import type { FigmaNode, FigmaPaint } from "@/lib/figma/types";

/** Trimmed node shape sent to the AI model (layout + content only). */
export interface TrimmedFigmaNode {
  id: string;
  name: string;
  type: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  characters?: string;
  textStyle?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
  };
  fills?: Array<{
    type: string;
    color?: string;
    imageRef?: string;
    opacity?: number;
  }>;
  layout?: {
    layoutMode?: string;
    itemSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
  };
  hyperlink?: { type: string; url: string };
  children?: TrimmedFigmaNode[];
}

function rgbaToHex(paint: FigmaPaint): string | undefined {
  const color = paint.color;
  if (!color) {
    return undefined;
  }

  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? paint.opacity ?? 1;

  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function trimPaints(
  paints: FigmaPaint[] | undefined,
): TrimmedFigmaNode["fills"] {
  if (!paints) {
    return undefined;
  }

  const trimmed = paints
    .filter((paint) => paint.visible !== false)
    .map((paint) => {
      if (paint.type === "IMAGE" && paint.imageRef) {
        return {
          type: paint.type,
          imageRef: paint.imageRef,
          opacity: paint.opacity,
        };
      }

      if (paint.type === "SOLID") {
        return {
          type: paint.type,
          color: rgbaToHex(paint),
          opacity: paint.opacity,
        };
      }

      return { type: paint.type, opacity: paint.opacity };
    });

  return trimmed.length > 0 ? trimmed : undefined;
}

function trimNode(node: FigmaNode): TrimmedFigmaNode | null {
  if (node.visible === false) {
    return null;
  }

  const trimmed: TrimmedFigmaNode = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (node.absoluteBoundingBox) {
    const { x, y, width, height } = node.absoluteBoundingBox;
    trimmed.boundingBox = { x, y, width, height };
  }

  if (node.characters) {
    trimmed.characters = node.characters;
  }

  if (node.style) {
    trimmed.textStyle = {
      fontFamily: node.style.fontFamily,
      fontSize: node.style.fontSize,
      fontWeight: node.style.fontWeight,
      lineHeightPx: node.style.lineHeightPx,
      letterSpacing: node.style.letterSpacing,
      textAlignHorizontal: node.style.textAlignHorizontal,
    };
  }

  const fills = trimPaints(node.fills);
  if (fills) {
    trimmed.fills = fills;
  }

  const hasLayout =
    node.layoutMode ||
    node.itemSpacing !== undefined ||
    node.paddingLeft !== undefined ||
    node.paddingRight !== undefined ||
    node.paddingTop !== undefined ||
    node.paddingBottom !== undefined ||
    node.primaryAxisAlignItems ||
    node.counterAxisAlignItems;

  if (hasLayout) {
    trimmed.layout = {
      layoutMode: node.layoutMode,
      itemSpacing: node.itemSpacing,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
    };
  }

  if (node.hyperlink?.url) {
    trimmed.hyperlink = node.hyperlink;
  }

  if (node.children) {
    const children = node.children
      .map(trimNode)
      .filter((child): child is TrimmedFigmaNode => child !== null);

    if (children.length > 0) {
      trimmed.children = children;
    }
  }

  return trimmed;
}

/** Produce a compact node tree for the AI model (no geometry paths or heavy metadata). */
export function trimNodeTree(rootNode: FigmaNode): TrimmedFigmaNode {
  const trimmed = trimNode(rootNode);

  if (!trimmed) {
    return {
      id: rootNode.id,
      name: rootNode.name,
      type: rootNode.type,
    };
  }

  return trimmed;
}
