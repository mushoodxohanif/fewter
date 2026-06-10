import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFigmaAccessToken } from "@/lib/auth/get-figma-access-token";
import {
  authRequiredError,
  ConvertPipelineError,
  sessionExpiredError,
} from "@/lib/convert/errors";
import { runConversion } from "@/lib/convert/run-conversion";
import type {
  ConvertErrorResponse,
  ConvertRequestBody,
  ConvertSuccessResponse,
} from "@/lib/convert/types";

export const runtime = "nodejs";
/** Conversion can take 10–30s depending on asset count and AI latency. */
export const maxDuration = 120;

function errorResponse(
  error: ConvertErrorResponse,
  status: number,
): NextResponse<ConvertErrorResponse> {
  return NextResponse.json(error, { status });
}

function invalidRequest(message: string): NextResponse<ConvertErrorResponse> {
  return errorResponse(
    {
      error: message,
      step: "parse-url",
      code: "INVALID_REQUEST",
    },
    400,
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<ConvertSuccessResponse | ConvertErrorResponse>> {
  const session = await auth();

  if (!session?.user) {
    return errorResponse(
      {
        error: authRequiredError().message,
        step: "auth",
        code: "AUTH_REQUIRED",
      },
      401,
    );
  }

  if (session.error) {
    return errorResponse(
      {
        error: sessionExpiredError().message,
        step: "auth",
        code: "SESSION_EXPIRED",
      },
      401,
    );
  }

  const accessToken = await getFigmaAccessToken();

  if (!accessToken) {
    return errorResponse(
      {
        error: authRequiredError().message,
        step: "auth",
        code: "AUTH_REQUIRED",
      },
      401,
    );
  }

  let body: ConvertRequestBody;

  try {
    body = (await request.json()) as ConvertRequestBody;
  } catch {
    return invalidRequest("Request body must be valid JSON.");
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return invalidRequest("A Figma URL is required.");
  }

  try {
    const result = await runConversion(body.url.trim(), accessToken);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ConvertPipelineError) {
      const status =
        error.step === "auth" ? 401 : error.step === "parse-url" ? 400 : 502;

      return errorResponse(
        {
          error: error.message,
          step: error.step,
          code: error.code,
        },
        status,
      );
    }

    console.error("[POST /api/convert] Unexpected error:", error);

    return errorResponse(
      {
        error: "Conversion failed unexpectedly. Please try again.",
        step: "generate-html",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}
