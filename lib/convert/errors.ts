import type { ConvertFailureStep } from "@/lib/convert/types";

export class ConvertPipelineError extends Error {
  readonly step: ConvertFailureStep;
  readonly code?: string;

  constructor(message: string, step: ConvertFailureStep, code?: string) {
    super(message);
    this.name = "ConvertPipelineError";
    this.step = step;
    this.code = code;
  }
}

export function authRequiredError(
  message = "Sign in with Figma to convert designs.",
): ConvertPipelineError {
  return new ConvertPipelineError(message, "auth", "AUTH_REQUIRED");
}

export function sessionExpiredError(): ConvertPipelineError {
  return new ConvertPipelineError(
    "Your Figma session expired. Please sign in again.",
    "auth",
    "SESSION_EXPIRED",
  );
}
