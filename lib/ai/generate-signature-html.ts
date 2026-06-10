import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { EMAIL_SIGNATURE_SYSTEM_PROMPT } from "@/lib/ai/email-signature-prompt";
import { extractHtmlFromResponse } from "@/lib/ai/extract-html-from-response";
import { trimNodeTree } from "@/lib/ai/trim-node-tree";
import { validateAndSanitizeHtml } from "@/lib/email/validate-html";
import type { FigmaNode } from "@/lib/figma/types";
import type { AssetUrlMap } from "@/lib/imgbb/upload";

/** Default Gemini model for signature generation. */
export const SIGNATURE_GENERATION_MODEL = "gemini-2.5-flash";

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export interface GenerateSignatureHtmlInput {
  rootNode: FigmaNode;
  assetMap: AssetUrlMap;
  /** PNG screenshot of the Figma frame for visual reference. */
  screenshot: Buffer | Uint8Array;
}

export interface GenerateSignatureHtmlResult {
  html: string;
  warnings: string[];
  /** Raw model output before extraction and validation. */
  rawModelOutput: string;
}

function getGoogleApiKey(): string {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

  if (!apiKey) {
    throw new GeminiConfigError(
      "GOOGLE_GENERATIVE_AI_API_KEY is not configured. Add it to your environment variables.",
    );
  }

  return apiKey;
}

/**
 * Generate Gmail-compatible signature HTML from Figma design data using Gemini.
 *
 * Pipeline: trim node tree → multimodal generateText → extract HTML → validate/sanitize.
 */
export async function generateSignatureHtml(
  input: GenerateSignatureHtmlInput,
): Promise<GenerateSignatureHtmlResult> {
  getGoogleApiKey();

  const nodeTree = trimNodeTree(input.rootNode);
  const contextPayload = JSON.stringify({
    nodeTree,
    assetMap: input.assetMap,
  });

  const { text } = await generateText({
    model: google(SIGNATURE_GENERATION_MODEL),
    system: EMAIL_SIGNATURE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Convert this Figma design into a Gmail-compatible email signature.\n\nDesign data:\n${contextPayload}`,
          },
          {
            type: "image",
            image: input.screenshot,
            mediaType: "image/png",
          },
        ],
      },
    ],
  });

  const extracted = extractHtmlFromResponse(text);
  const { html, warnings } = validateAndSanitizeHtml(extracted, {
    assetMap: input.assetMap,
  });

  return {
    html,
    warnings,
    rawModelOutput: text,
  };
}
