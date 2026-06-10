"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { htmlToPlainText } from "@/lib/signature/html-to-plain-text";

interface CopyButtonProps {
  html: string;
}

export function CopyButton({ html }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  async function handleCopy() {
    setShowFallback(false);

    const plainText = htmlToPlainText(html);

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(html);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }

      setShowFallback(true);
    } catch {
      setShowFallback(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleCopy} className="self-start">
        {copied ? (
          <>
            <Check />
            Copied!
          </>
        ) : (
          <>
            <ClipboardCopy />
            Copy for Gmail
          </>
        )}
      </Button>
      {showFallback ? (
        <p className="text-sm text-muted-foreground">
          Clipboard access is unavailable. Select the signature in the preview
          above, press{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 text-xs">⌘C</kbd>{" "}
          /{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 text-xs">
            Ctrl+C
          </kbd>
          , then paste into Gmail Settings → Signature.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Paste into Gmail Settings → General → Signature. Use the rendered
          preview copy for best results.
        </p>
      )}
    </div>
  );
}
