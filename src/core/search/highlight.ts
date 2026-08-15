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
