"use client";

import { ChevronDown, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PreviewWidth = 320 | 600;

interface SignaturePreviewProps {
  html: string;
}

export function SignaturePreview({ html }: SignaturePreviewProps) {
  const [width, setWidth] = useState<PreviewWidth>(600);
  const [showSource, setShowSource] = useState(false);

  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank" rel="noopener noreferrer">
<style>
  body { margin: 0; padding: 16px; background: #fff; }
  a { pointer-events: auto; }
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <section
      className="flex w-full flex-col gap-4"
      aria-label="Signature preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            type="button"
            variant={width === 600 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setWidth(600)}
            aria-pressed={width === 600}
          >
            <Monitor />
            Desktop
          </Button>
          <Button
            type="button"
            variant={width === 320 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setWidth(320)}
            aria-pressed={width === 320}
          >
            <Smartphone />
            Mobile
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-muted/30 p-4">
        <div
          className="mx-auto transition-[width] duration-200"
          style={{ width: `${width}px`, maxWidth: "100%" }}
        >
          <iframe
            title="Email signature preview"
            srcDoc={iframeSrcDoc}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="w-full min-h-[120px] rounded-md border bg-white shadow-sm"
            style={{ height: "auto" }}
            onLoad={(event) => {
              const iframe = event.currentTarget;
              try {
                const doc = iframe.contentDocument;
                if (doc?.body) {
                  iframe.style.height = `${Math.max(doc.body.scrollHeight + 32, 120)}px`;
                }
              } catch {
                iframe.style.height = "240px";
              }
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowSource((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
          aria-expanded={showSource}
        >
          View HTML source
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              showSource && "rotate-180",
            )}
          />
        </button>
        {showSource ? (
          <pre className="max-h-64 overflow-auto border-t bg-muted/30 p-4 text-xs leading-relaxed">
            <code>{html}</code>
          </pre>
        ) : null}
      </div>
    </section>
  );
}
