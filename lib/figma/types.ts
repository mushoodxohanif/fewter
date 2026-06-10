/** Figma REST API node types relevant to signature conversion. */
export type FigmaNodeType =
  | "DOCUMENT"
  | "CANVAS"
  | "FRAME"
  | "GROUP"
  | "VECTOR"
  | "BOOLEAN_OPERATION"
  | "STAR"
  | "LINE"
  | "ELLIPSE"
  | "REGULAR_POLYGON"
  | "RECTANGLE"
  | "TEXT"
  | "SLICE"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE"
  | "IMAGE";

export interface FigmaPaint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  imageRef?: string;
  scaleMode?: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType | string;
  visible?: boolean;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  characters?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  hyperlink?: { type: string; url: string };
}

export interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
  nodes: Record<
    string,
    {
      document: FigmaNode;
      components?: Record<string, unknown>;
      componentSets?: Record<string, unknown>;
      schemaVersion: number;
      styles?: Record<string, unknown>;
    }
  >;
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaImageFillsResponse {
  error: boolean;
  status: number;
  meta: {
    images: Record<string, string>;
  };
}

export interface ParsedFigmaUrl {
  fileKey: string;
  /** Node id in API format, e.g. `1:2`. */
  nodeId: string;
}

export type FigmaAssetKind = "node-render" | "image-fill";

export interface FigmaAssetRef {
  /** Unique key for asset maps — node id or imageRef. */
  key: string;
  kind: FigmaAssetKind;
  nodeId?: string;
  imageRef?: string;
  name?: string;
}

export interface FigmaAssetDiscovery {
  /** Node ids to request from the `/images` render endpoint. */
  renderNodeIds: string[];
  /** `imageRef` values to resolve via `/files/:key/images`. */
  imageRefs: string[];
  assets: FigmaAssetRef[];
}

export interface FigmaFrameData {
  fileName: string;
  rootNodeId: string;
  rootNode: FigmaNode;
  /** Temporary Figma CDN URLs for rendered nodes (vectors, icons, image nodes). */
  renderUrls: Record<string, string | null>;
  /** Temporary Figma CDN URLs for embedded image fills. */
  imageFillUrls: Record<string, string>;
  assets: FigmaAssetDiscovery;
}
