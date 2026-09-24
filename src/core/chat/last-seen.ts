/** "Last seen" copy for a peer who is not present right now (§8.3 LastSeenLabel). */
export function lastSeenLabel(lastSeenAt: string, now: number = Date.now()): string {
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return "Offline";
  const minutes = Math.floor((now - seen) / 60_000);
  if (minutes < 2) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${new Date(seen).toLocaleDateString()}`;
}
