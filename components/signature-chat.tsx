"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { extractHtmlFromResponse } from "@/lib/ai/extract-html-from-response";
import { validateAndSanitizeHtml } from "@/lib/email/validate-html";
import type { AssetUrlMap } from "@/lib/imgbb/upload";
import { getMessageText } from "@/lib/signature/signature-state";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Make the text larger",
  "Add a phone link",
  "Fix alignment",
] as const;

interface SignatureChatProps {
  html: string;
  assetMap: AssetUrlMap;
  onHtmlUpdate: (html: string, warnings: string[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Reset chat when a new conversion completes. */
  chatKey: string;
}

function isHtmlResponse(text: string): boolean {
  return /<table[\s>]/i.test(text);
}

function formatAssistantMessage(text: string): string {
  if (isHtmlResponse(text)) {
    return "Signature updated.";
  }
  return text.trim() || "Done.";
}

export function SignatureChat({
  html,
  assetMap,
  onHtmlUpdate,
  onUndo,
  canUndo,
  chatKey,
}: SignatureChatProps) {
  const [input, setInput] = useState("");
  const htmlRef = useRef(html);
  const assetMapRef = useRef(assetMap);

  htmlRef.current = html;
  assetMapRef.current = assetMap;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          currentHtml: htmlRef.current,
          assetMap: assetMapRef.current,
        }),
      }),
    [],
  );

  const processAssistantResponse = useCallback(
    (text: string) => {
      const extracted = extractHtmlFromResponse(text);
      if (!extracted || !isHtmlResponse(extracted)) {
        return;
      }

      const { html: sanitized, warnings } = validateAndSanitizeHtml(extracted, {
        assetMap: assetMapRef.current,
      });

      if (sanitized) {
        onHtmlUpdate(sanitized, warnings);
      }
    },
    [onHtmlUpdate],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: chatKey,
    transport,
    onFinish: ({ message, isError, isAbort }) => {
      if (isError || isAbort) {
        return;
      }

      if (message.role === "assistant") {
        processAssistantResponse(getMessageText(message));
      }
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) {
      return;
    }

    sendMessage({ text: trimmed });
    setInput("");
  }

  function handleQuickPrompt(prompt: string) {
    if (isBusy) {
      return;
    }
    sendMessage({ text: prompt });
  }

  return (
    <section
      className="flex min-h-[320px] flex-col rounded-lg border bg-card"
      aria-label="Refine signature with AI"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Refine with AI</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo || isBusy}
          aria-label="Undo last change"
        >
          <RotateCcw />
          Undo
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask for changes like &ldquo;make the name bolder&rdquo; or
            &ldquo;fix the LinkedIn URL&rdquo;. The preview updates after each
            response.
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto">
            {messages.map((message) => {
              const text = getMessageText(message);
              const displayText =
                message.role === "assistant"
                  ? formatAssistantMessage(text)
                  : text;

              return (
                <li
                  key={message.id}
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {displayText}
                </li>
              );
            })}
            {isBusy ? (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Updating signature…
              </li>
            ) : null}
          </ul>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => handleQuickPrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUndo || isBusy}
            onClick={onUndo}
          >
            Undo last change
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-auto flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe a change…"
            disabled={isBusy}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isBusy || !input.trim()}
            aria-label="Send message"
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </div>
    </section>
  );
}
