"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FigmaUrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onConvert: () => void;
  isConverting: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function FigmaUrlInput({
  url,
  onUrlChange,
  onConvert,
  isConverting,
  disabled = false,
  disabledReason,
}: FigmaUrlInputProps) {
  const isDisabled = disabled || isConverting;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDisabled && url.trim()) {
      onConvert();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="figma-url">Figma frame URL</Label>
        <Input
          id="figma-url"
          type="url"
          placeholder="https://www.figma.com/design/…?node-id=1-2"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={isDisabled}
          aria-describedby={disabledReason ? "figma-url-hint" : undefined}
          required
        />
        {disabledReason ? (
          <p id="figma-url-hint" className="text-sm text-muted-foreground">
            {disabledReason}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Paste a Figma design URL that includes a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              node-id
            </code>{" "}
            pointing to your signature frame.
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isDisabled || !url.trim()}
        className="self-start"
      >
        {isConverting ? (
          <>
            <Loader2 className="animate-spin" />
            Converting…
          </>
        ) : (
          "Convert"
        )}
      </Button>
    </form>
  );
}
