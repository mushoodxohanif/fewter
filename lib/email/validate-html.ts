import type { AssetUrlMap } from "@/lib/imgbb/upload";

const FORBIDDEN_TAGS =
  /<\/?(?:script|style|svg|form|iframe|object|embed|base|link)\b[^>]*>/gi;

const FORBIDDEN_TAGS_TEST =
  /<\/?(?:script|style|svg|form|iframe|object|embed|base|link)\b[^>]*>/i;

const EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const EVENT_HANDLER_ATTR_TEST =
  /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i;

const JAVASCRIPT_URL =
  /(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

const JAVASCRIPT_URL_TEST =
  /(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/i;

const DATA_URI_SRC = /src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi;

const DATA_URI_SRC_TEST = /src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/i;

const IMGBB_HOST_PATTERN = /^(?:i\.)?ibb\.co$/i;

export interface ValidateHtmlOptions {
  /** Allowed imgbb URLs keyed by Figma node id or imageRef. */
  assetMap: AssetUrlMap;
}

export interface ValidateHtmlResult {
  html: string;
  warnings: string[];
}

function isAllowedImgSrc(url: string, allowedUrls: Set<string>): boolean {
  if (!url.startsWith("https://")) {
    return false;
  }

  if (allowedUrls.has(url)) {
    return true;
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return IMGBB_HOST_PATTERN.test(host);
  } catch {
    return false;
  }
}

function isAllowedHref(url: string): boolean {
  const trimmed = url.trim();

  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return !trimmed.toLowerCase().startsWith("javascript:");
  }

  return false;
}

function collectAttributeUrls(
  html: string,
  attribute: "src" | "href",
): string[] {
  const pattern = new RegExp(
    `${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "gi",
  );
  const urls: string[] = [];

  for (const match of html.matchAll(pattern)) {
    const value = match[1] ?? match[2];
    if (value) {
      urls.push(value);
    }
  }

  return urls;
}

/**
 * Sanitize and validate email signature HTML for Gmail compatibility.
 *
 * - Strips forbidden tags, event handlers, and dangerous URLs
 * - Verifies image src values point to allowed imgbb-hosted assets
 * - Verifies href values use safe schemes
 */
export function validateAndSanitizeHtml(
  rawHtml: string,
  options: ValidateHtmlOptions,
): ValidateHtmlResult {
  const warnings: string[] = [];
  let html = rawHtml.trim();

  if (!html) {
    return { html: "", warnings: ["Generated HTML was empty."] };
  }

  if (FORBIDDEN_TAGS_TEST.test(html)) {
    warnings.push("Removed forbidden tags (script, style, svg, etc.).");
    html = html.replace(FORBIDDEN_TAGS, "");
  }

  if (EVENT_HANDLER_ATTR_TEST.test(html)) {
    warnings.push("Removed JavaScript event handler attributes.");
    html = html.replace(EVENT_HANDLER_ATTR, "");
  }

  if (JAVASCRIPT_URL_TEST.test(html)) {
    warnings.push("Removed javascript: URLs.");
    html = html.replace(JAVASCRIPT_URL, "");
  }

  if (DATA_URI_SRC_TEST.test(html)) {
    warnings.push("Removed base64/data URI image sources.");
    html = html.replace(DATA_URI_SRC, "");
  }

  const allowedUrls = new Set(Object.values(options.assetMap));

  for (const src of collectAttributeUrls(html, "src")) {
    if (!isAllowedImgSrc(src, allowedUrls)) {
      warnings.push(`Rejected image src not hosted on imgbb: ${src}`);
      html = html.replace(
        new RegExp(
          `src\\s*=\\s*(?:"${escapeRegExp(src)}"|'${escapeRegExp(src)}')`,
          "gi",
        ),
        'src=""',
      );
    }
  }

  for (const href of collectAttributeUrls(html, "href")) {
    if (!isAllowedHref(href)) {
      warnings.push(`Rejected unsafe href: ${href}`);
      html = html.replace(
        new RegExp(
          `href\\s*=\\s*(?:"${escapeRegExp(href)}"|'${escapeRegExp(href)}')`,
          "gi",
        ),
        'href="#"',
      );
    }
  }

  if (!/<table[\s>]/i.test(html)) {
    warnings.push(
      "Output does not contain a <table> root — Gmail signatures require table-based layout.",
    );
  }

  return { html: html.trim(), warnings };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
