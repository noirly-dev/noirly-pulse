import { describe, expect, it } from "vitest";
import { renderMarkdownToSafeHtml, sanitizeMessageContent } from "@/src/core/markdown/sanitize";

describe("sanitizeMessageContent", () => {
  it("strips tags and null bytes, then truncates", () => {
    expect(sanitizeMessageContent("<script>x</script>hi\u0000")).toBe("xhi");
    expect(sanitizeMessageContent("a".repeat(9000)).length).toBe(8000);
  });
});

describe("renderMarkdownToSafeHtml", () => {
  it("escapes HTML then applies inline markdown", () => {
    const html = renderMarkdownToSafeHtml("**bold** *em* `code` [n](https://noirly.dev) <img>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('href="https://noirly.dev"');
    expect(html).not.toContain("<img>");
  });
});
