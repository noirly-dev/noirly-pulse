/** Escape special regex characters in a user search string. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split text into plain and highlighted segments for search result display. */
export function highlightTerms(
  text: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  if (terms.length === 0) return [{ text, highlight: false }];

  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlight: terms.some((term) => part.toLowerCase() === term.toLowerCase()),
    }));
}

/** Collapse markdown the search list cannot render (mention links, emphasis). */
export function plainTextForSnippet(content: string): string {
  return content
    .replace(/\[(@[^\]]+)\]\(pulse:\/\/user\/[^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ~`width` characters centred on the first matching term (§12.1: 180 chars),
 * with ellipses where the text was cut.
 */
export function snippetAround(content: string, query: string, width = 180): string {
  const text = plainTextForSnippet(content);
  if (text.length <= width) return text;
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  const lower = text.toLowerCase();
  const hit = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const centre = hit ?? 0;
  let start = Math.max(0, centre - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  start = Math.max(0, end - width);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
