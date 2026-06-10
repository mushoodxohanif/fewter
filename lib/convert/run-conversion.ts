import {
  GeminiConfigError,
  generateSignatureHtml,
} from "@/lib/ai/generate-signature-html";
import { ConvertPipelineError } from "@/lib/convert/errors";
import type { ConvertSuccessResponse } from "@/lib/convert/types";
import {
  FigmaApiError,
  fetchFigmaFrameData,
  getImageRenders,
} from "@/lib/figma/client";
import { FigmaAssetLimitError } from "@/lib/figma/extract-assets";
import { FigmaUrlParseError, parseFigmaUrl } from "@/lib/figma/parse-url";
import {
  ImgbbConfigError,
  ImgbbUploadError,
  uploadFigmaAssetsToImgbb,
} from "@/lib/imgbb/upload";

async function downloadBinary(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new ConvertPipelineError(
      `Failed to download Figma frame preview (${response.status}).`,
      "fetch-figma",
      "SCREENSHOT_DOWNLOAD_FAILED",
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function mapFigmaApiError(error: FigmaApiError): ConvertPipelineError {
  if (error.status === 403) {
    return new ConvertPipelineError(
      "You do not have access to this Figma file. Check sharing permissions and try again.",
      "fetch-figma",
      "FIGMA_ACCESS_DENIED",
    );
  }

  if (error.status === 404) {
    return new ConvertPipelineError(
      error.message,
      "fetch-figma",
      "FIGMA_NOT_FOUND",
    );
  }

  if (error.status === 401) {
    return new ConvertPipelineError(
      "Figma rejected the access token. Please sign in again.",
      "auth",
      "FIGMA_UNAUTHORIZED",
    );
  }

  return new ConvertPipelineError(
    "Failed to fetch design data from Figma. Please try again.",
    "fetch-figma",
    "FIGMA_API_ERROR",
  );
}

/**
 * Run the full Figma → Gmail signature conversion pipeline.
 */
export async function runConversion(
  url: string,
  accessToken: string,
): Promise<ConvertSuccessResponse> {
  let fileKey: string;
  let nodeId: string;

  try {
    ({ fileKey, nodeId } = parseFigmaUrl(url));
  } catch (error) {
    if (error instanceof FigmaUrlParseError) {
      throw new ConvertPipelineError(error.message, "parse-url", "INVALID_URL");
    }

    throw error;
  }

  let frameData: Awaited<ReturnType<typeof fetchFigmaFrameData>>;

  try {
    frameData = await fetchFigmaFrameData(fileKey, nodeId, accessToken);
  } catch (error) {
    if (error instanceof FigmaAssetLimitError) {
      throw new ConvertPipelineError(
        error.message,
        "fetch-figma",
        "ASSET_LIMIT_EXCEEDED",
      );
    }

    if (error instanceof FigmaApiError) {
      throw mapFigmaApiError(error);
    }

    throw new ConvertPipelineError(
      "Failed to fetch design data from Figma. Please try again.",
      "fetch-figma",
      "FIGMA_FETCH_FAILED",
    );
  }

  let screenshot: Buffer;

  try {
    const renderResponse = await getImageRenders(
      fileKey,
      [nodeId],
      accessToken,
    );
    const screenshotUrl = renderResponse.images[nodeId];

    if (!screenshotUrl) {
      throw new ConvertPipelineError(
        "Figma could not render a preview of the selected frame.",
        "fetch-figma",
        "SCREENSHOT_UNAVAILABLE",
      );
    }

    screenshot = await downloadBinary(screenshotUrl);
  } catch (error) {
    if (error instanceof ConvertPipelineError) {
      throw error;
    }

    if (error instanceof FigmaApiError) {
      throw mapFigmaApiError(error);
    }

    throw new ConvertPipelineError(
      "Failed to fetch a preview image from Figma.",
      "fetch-figma",
      "SCREENSHOT_FETCH_FAILED",
    );
  }

  let assetMap: Awaited<
    ReturnType<typeof uploadFigmaAssetsToImgbb>
  >["assetMap"];
  const warnings: string[] = [];

  try {
    const uploadResult = await uploadFigmaAssetsToImgbb(frameData);
    assetMap = uploadResult.assetMap;
    warnings.push(...uploadResult.warnings);
  } catch (error) {
    if (error instanceof ImgbbConfigError) {
      throw new ConvertPipelineError(
        error.message,
        "upload-assets",
        "IMGBB_NOT_CONFIGURED",
      );
    }

    if (error instanceof ImgbbUploadError) {
      throw new ConvertPipelineError(
        error.message,
        "upload-assets",
        "IMGBB_UPLOAD_FAILED",
      );
    }

    throw new ConvertPipelineError(
      "Failed to upload images. Please try again.",
      "upload-assets",
      "UPLOAD_FAILED",
    );
  }

  try {
    const generation = await generateSignatureHtml({
      rootNode: frameData.rootNode,
      assetMap,
      screenshot,
    });

    warnings.push(...generation.warnings);

    if (!generation.html) {
      throw new ConvertPipelineError(
        "AI did not produce valid signature HTML. Try again or simplify the design.",
        "generate-html",
        "EMPTY_HTML",
      );
    }

    return {
      html: generation.html,
      assets: assetMap,
      warnings,
      meta: {
        fileName: frameData.fileName,
        fileKey,
        nodeId,
      },
    };
  } catch (error) {
    if (error instanceof ConvertPipelineError) {
      throw error;
    }

    if (error instanceof GeminiConfigError) {
      throw new ConvertPipelineError(
        error.message,
        "generate-html",
        "GEMINI_NOT_CONFIGURED",
      );
    }

    throw new ConvertPipelineError(
      "Failed to generate signature HTML. Please try again.",
      "generate-html",
      "GENERATION_FAILED",
    );
  }
}
