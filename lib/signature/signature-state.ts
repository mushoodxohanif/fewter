import type { AssetUrlMap } from "@/lib/imgbb/upload";

/** Max prior HTML versions kept for undo. */
export const MAX_HTML_HISTORY = 10;

export interface SignatureEditorState {
  html: string;
  htmlHistory: string[];
  assetMap: AssetUrlMap;
}

export interface ChatRequestBody {
  messages: import("ai").UIMessage[];
  currentHtml: string;
  assetMap: AssetUrlMap;
}

/** Push a prior HTML version onto the undo stack (capped at {@link MAX_HTML_HISTORY}). */
export function pushHtmlHistory(
  history: string[],
  previousHtml: string,
): string[] {
  return [...history, previousHtml].slice(-MAX_HTML_HISTORY);
}

/** Pop the most recent prior HTML version from the undo stack. */
export function popHtmlHistory(history: string[]): {
  history: string[];
  html: string | null;
} {
  if (history.length === 0) {
    return { history: [], html: null };
  }

  const html = history[history.length - 1] ?? null;
  return {
    history: history.slice(0, -1),
    html,
  };
}

/** Concatenate text parts from a UI message. */
export function getMessageText(message: import("ai").UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}
