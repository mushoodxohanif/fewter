/**
 * Extract an HTML signature fragment from a model response.
 *
 * Models sometimes wrap output in markdown fences or add prose — strip those
 * and return the innermost <table>…</table> block when possible.
 */
export function extractHtmlFromResponse(raw: string): string {
  let text = raw.trim();

  if (!text) {
    return "";
  }

  // Strip markdown code fences (```html ... ``` or ``` ... ```)
  const fenceMatch = text.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenceMatch?.[1]) {
    text = fenceMatch[1].trim();
  }

  // If the response contains prose around HTML, extract the table block.
  const tableMatch = text.match(/<table[\s\S]*<\/table>/i);
  if (tableMatch?.[0]) {
    return tableMatch[0].trim();
  }

  // Fall back to any HTML-looking content.
  const htmlTagMatch = text.match(/<[\s\S]*>/);
  if (htmlTagMatch?.[0]) {
    return htmlTagMatch[0].trim();
  }

  return text;
}
