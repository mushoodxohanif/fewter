"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import { CONVERT_STEPS, type ConvertStep } from "@/lib/convert/types";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<ConvertStep, string> = {
  "parse-url": "Parse Figma URL",
  "fetch-figma": "Fetch design from Figma",
  "upload-assets": "Upload images to hosting",
  "generate-html": "Generate email-safe HTML",
};

type StepStatus = "pending" | "active" | "complete" | "error";

interface ConversionProgressProps {
  /** Index of the step currently in progress (0–3), or -1 when idle. */
  activeStepIndex: number;
  /** When set, marks this step (and prior steps) as failed. */
  failedStep?: ConvertStep;
  visible: boolean;
}

function getStepStatus(
  index: number,
  activeStepIndex: number,
  failedStep?: ConvertStep,
): StepStatus {
  if (failedStep) {
    const failedIndex = CONVERT_STEPS.indexOf(failedStep);
    if (index < failedIndex) return "complete";
    if (index === failedIndex) return "error";
    return "pending";
  }

  if (activeStepIndex < 0) return "pending";
  if (index < activeStepIndex) return "complete";
  if (index === activeStepIndex) return "active";
  return "pending";
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return <Check className="size-4 text-primary" aria-hidden />;
  }
  if (status === "active") {
    return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />;
  }
  if (status === "error") {
    return <X className="size-4 text-destructive" aria-hidden />;
  }
  return <Circle className="size-4 text-muted-foreground/40" aria-hidden />;
}

export function ConversionProgress({
  activeStepIndex,
  failedStep,
  visible,
}: ConversionProgressProps) {
  if (!visible) return null;

  return (
    <ol
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-4"
      aria-label="Conversion progress"
    >
      {CONVERT_STEPS.map((step, index) => {
        const status = getStepStatus(index, activeStepIndex, failedStep);

        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 text-sm",
              status === "pending" && "text-muted-foreground",
              status === "active" && "font-medium text-foreground",
              status === "complete" && "text-foreground",
              status === "error" && "font-medium text-destructive",
            )}
          >
            <StepIcon status={status} />
            <span>{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
