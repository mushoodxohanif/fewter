"use client";

import { AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversionProgress } from "@/components/conversion-progress";
import { CopyButton } from "@/components/copy-button";
import { FigmaUrlInput } from "@/components/figma-url-input";
import { SignatureChat } from "@/components/signature-chat";
import { SignaturePreview } from "@/components/signature-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CONVERT_STEPS,
  type ConvertErrorResponse,
  type ConvertFailureStep,
  type ConvertStep,
  type ConvertSuccessResponse,
} from "@/lib/convert/types";
import type { AssetUrlMap } from "@/lib/imgbb/upload";
import {
  popHtmlHistory,
  pushHtmlHistory,
} from "@/lib/signature/signature-state";

/** Estimated dwell time per step while the single POST request is in flight. */
const STEP_INTERVAL_MS = 4000;

interface ConversionResult {
  html: string;
  assets: AssetUrlMap;
  warnings: string[];
  meta: ConvertSuccessResponse["meta"];
}

export function SignatureConverter() {
  const { data: session, status: sessionStatus } = useSession();
  const [url, setUrl] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [failedStep, setFailedStep] = useState<ConvertStep | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [currentHtml, setCurrentHtml] = useState("");
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [refineWarnings, setRefineWarnings] = useState<string[]>([]);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStepTimer = useCallback(() => {
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }, []);

  const startProgressSimulation = useCallback(() => {
    clearStepTimer();
    setActiveStepIndex(0);
    setFailedStep(undefined);

    stepTimerRef.current = setInterval(() => {
      setActiveStepIndex((current) => {
        if (current >= CONVERT_STEPS.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, STEP_INTERVAL_MS);
  }, [clearStepTimer]);

  useEffect(() => clearStepTimer, [clearStepTimer]);

  async function handleConvert() {
    setError(null);
    setResult(null);
    setCurrentHtml("");
    setHtmlHistory([]);
    setRefineWarnings([]);
    setIsConverting(true);
    startProgressSimulation();

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data: ConvertSuccessResponse | ConvertErrorResponse =
        await response.json();

      if (!response.ok) {
        const failure = data as ConvertErrorResponse;
        const failureStep = normalizeFailureStep(failure.step);
        if (failureStep) {
          setFailedStep(failureStep);
        }
        setError(failure.error ?? "Conversion failed. Please try again.");
        return;
      }

      const success = data as ConvertSuccessResponse;
      setActiveStepIndex(CONVERT_STEPS.length - 1);
      setResult({
        html: success.html,
        assets: success.assets,
        warnings: success.warnings,
        meta: success.meta,
      });
      setCurrentHtml(success.html);
      setHtmlHistory([]);
      setRefineWarnings([]);
    } catch {
      setFailedStep("generate-html");
      setError("Network error. Check your connection and try again.");
    } finally {
      clearStepTimer();
      setIsConverting(false);
    }
  }

  const isAuthenticated = sessionStatus === "authenticated" && !!session?.user;
  const isSessionLoading = sessionStatus === "loading";
  const authDisabledReason = isSessionLoading
    ? "Checking sign-in status…"
    : !isAuthenticated
      ? "Sign in with Figma to convert a design."
      : undefined;

  const handleHtmlUpdate = useCallback((html: string, warnings: string[]) => {
    setCurrentHtml((previousHtml) => {
      setHtmlHistory((history) => pushHtmlHistory(history, previousHtml));
      return html;
    });
    if (warnings.length > 0) {
      setRefineWarnings(warnings);
    }
  }, []);

  const handleUndo = useCallback(() => {
    setHtmlHistory((history) => {
      const { history: nextHistory, html } = popHtmlHistory(history);
      if (html) {
        setCurrentHtml(html);
      }
      return nextHistory;
    });
  }, []);

  const allWarnings = result ? [...result.warnings, ...refineWarnings] : [];

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Figma → Gmail Signature
          </h1>
          <p className="mt-1 text-muted-foreground">
            Paste a Figma frame URL to generate a table-based, inline-styled
            HTML signature ready for Gmail.
          </p>
        </div>

        <FigmaUrlInput
          url={url}
          onUrlChange={setUrl}
          onConvert={handleConvert}
          isConverting={isConverting}
          disabled={!isAuthenticated || isSessionLoading}
          disabledReason={authDisabledReason}
        />

        <ConversionProgress
          visible={isConverting || !!failedStep}
          activeStepIndex={
            failedStep
              ? CONVERT_STEPS.indexOf(failedStep)
              : isConverting
                ? activeStepIndex
                : CONVERT_STEPS.length - 1
          }
          failedStep={failedStep}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Conversion failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      {result ? (
        <section className="flex flex-col gap-6 border-t pt-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{result.meta.fileName}</Badge>
            {allWarnings.length > 0 ? (
              <Badge variant="outline">
                {allWarnings.length} warning
                {allWarnings.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>

          {allWarnings.length > 0 ? (
            <Alert>
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {allWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-8">
            <SignaturePreview html={currentHtml} />
            <SignatureChat
              key={`${result.meta.fileKey}:${result.meta.nodeId}`}
              html={currentHtml}
              assetMap={result.assets}
              onHtmlUpdate={handleHtmlUpdate}
              onUndo={handleUndo}
              canUndo={htmlHistory.length > 0}
              chatKey={`${result.meta.fileKey}:${result.meta.nodeId}`}
            />
          </div>
          <CopyButton html={currentHtml} />
        </section>
      ) : null}
    </div>
  );
}

function normalizeFailureStep(
  step: ConvertFailureStep | undefined,
): ConvertStep | undefined {
  if (!step || step === "auth") {
    return undefined;
  }
  return step;
}
