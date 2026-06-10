import type { AssetUrlMap } from "@/lib/imgbb/upload";

/** Pipeline stages surfaced to the UI for progress and error reporting. */
export const CONVERT_STEPS = [
  "parse-url",
  "fetch-figma",
  "upload-assets",
  "generate-html",
] as const;

export type ConvertStep = (typeof CONVERT_STEPS)[number];

export type ConvertFailureStep = ConvertStep | "auth";

export interface ConvertRequestBody {
  url: string;
}

export interface ConvertSuccessResponse {
  html: string;
  assets: AssetUrlMap;
  warnings: string[];
  meta: {
    fileName: string;
    fileKey: string;
    nodeId: string;
  };
}

export interface ConvertErrorResponse {
  error: string;
  step: ConvertFailureStep;
  code?: string;
}
