const MENTION_RE = /\[@[^\]]+\]\(pulse:\/\/user\/([a-f0-9]{24})\)/gi;

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(MENTION_RE)) {
    const id = match[1];
    if (id) ids.add(id.toLowerCase());
  }
  return [...ids];
}
