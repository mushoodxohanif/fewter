import type { ParsedFigmaUrl } from "@/lib/figma/types";

export class FigmaUrlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaUrlParseError";
  }
}

/**
 * Convert a Figma URL `node-id` query value to API format (`1-2` → `1:2`).
 */
export function formatNodeIdForApi(nodeIdParam: string): string {
  return decodeURIComponent(nodeIdParam).replace(/-/g, ":");
}

/**
 * Extract `fileKey` and `nodeId` from a Figma design URL.
 *
 * Supports standard design links and branch URLs (`/branch/:branchKey/` uses
 * branchKey as the file key). Rejects URLs without a `node-id` query param.
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    throw new FigmaUrlParseError("Invalid URL format.");
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "figma.com") {
    throw new FigmaUrlParseError("URL must be a figma.com link.");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  let fileKey: string | null = null;

  if (segments[0] === "design" && segments.length >= 2) {
    if (segments[2] === "branch" && segments.length >= 4) {
      fileKey = segments[3];
    } else {
      fileKey = segments[1];
    }
  } else if (segments[0] === "file" && segments.length >= 2) {
    fileKey = segments[1];
  }

  if (!fileKey) {
    throw new FigmaUrlParseError(
      "Could not extract a file key from the URL. Use a Figma design or file link.",
    );
  }

  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new FigmaUrlParseError(
      "URL must include a node-id parameter. Select a frame in Figma and copy the link.",
    );
  }

  return {
    fileKey,
    nodeId: formatNodeIdForApi(nodeIdParam),
  };
}
