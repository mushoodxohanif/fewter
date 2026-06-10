import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { REFINE_SIGNATURE_SYSTEM_PROMPT } from "@/lib/ai/email-signature-prompt";
import {
  GeminiConfigError,
  SIGNATURE_GENERATION_MODEL,
} from "@/lib/ai/generate-signature-html";
import { authRequiredError, sessionExpiredError } from "@/lib/convert/errors";
import type { AssetUrlMap } from "@/lib/imgbb/upload";
import type { ChatRequestBody } from "@/lib/signature/signature-state";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatErrorResponse {
  error: string;
  code?: string;
}

function errorResponse(
  error: ChatErrorResponse,
  status: number,
): NextResponse<ChatErrorResponse> {
  return NextResponse.json(error, { status });
}

function buildRefinementSystemPrompt(
  currentHtml: string,
  assetMap: AssetUrlMap,
): string {
  return `${REFINE_SIGNATURE_SYSTEM_PROMPT}

## Current signature HTML
${currentHtml}

## Available assets (imgbb URLs — preserve unless the user asks to remove an image)
${JSON.stringify(assetMap)}`;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();

  if (!session?.user) {
    return errorResponse(
      {
        error: authRequiredError().message,
        code: "AUTH_REQUIRED",
      },
      401,
    );
  }

  if (session.error) {
    return errorResponse(
      {
        error: sessionExpiredError().message,
        code: "SESSION_EXPIRED",
      },
      401,
    );
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return errorResponse(
      { error: "Request body must be valid JSON.", code: "INVALID_REQUEST" },
      400,
    );
  }

  const { messages, currentHtml, assetMap } = body;

  if (!Array.isArray(messages)) {
    return errorResponse(
      { error: "messages must be an array.", code: "INVALID_REQUEST" },
      400,
    );
  }

  if (typeof currentHtml !== "string" || !currentHtml.trim()) {
    return errorResponse(
      {
        error: "currentHtml is required for signature refinement.",
        code: "INVALID_REQUEST",
      },
      400,
    );
  }

  if (!assetMap || typeof assetMap !== "object") {
    return errorResponse(
      { error: "assetMap is required.", code: "INVALID_REQUEST" },
      400,
    );
  }

  try {
    const result = streamText({
      model: google(SIGNATURE_GENERATION_MODEL),
      system: buildRefinementSystemPrompt(currentHtml.trim(), assetMap),
      messages: await convertToModelMessages(messages as UIMessage[]),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return errorResponse({ error: error.message, code: "CONFIG_ERROR" }, 500);
    }

    console.error("[POST /api/chat] Unexpected error:", error);

    return errorResponse(
      {
        error: "Failed to refine signature. Please try again.",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}
