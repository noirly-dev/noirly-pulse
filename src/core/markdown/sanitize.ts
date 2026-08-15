const MAX_CONTENT = 8000;

export function sanitizeMessageContent(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/<[^>]*>/g, "").slice(0, MAX_CONTENT);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline markdown only: **bold** *italic* `code` [label](https://...). */
export function renderMarkdownToSafeHtml(raw: string): string {
  const sanitized = escapeHtml(sanitizeMessageContent(raw));
  return sanitized
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>',
    );
}
