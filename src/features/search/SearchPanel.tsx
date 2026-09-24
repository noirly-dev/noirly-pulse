"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@noirly-dev/ui";
import { conversationTitle } from "@/src/core/chat/title";
import { highlightTerms, snippetAround } from "@/src/core/search/highlight";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";

type Props = {
  /** Omit for personal scope (DMs + group DMs). */
  workspaceId?: string;
  currentUserId: string;
};

/**
 * Message search (§12.1). Personal: `/search`; workspace: `/w/{id}/search`.
 * Hits deep-link with `?msg=` so the list opens around the message.
 */
export function SearchPanel({ workspaceId, currentUserId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [input, setInput] = useState(initial);
  const [q, setQ] = useState(initial.trim());
  const field = useRef<HTMLInputElement>(null);

  // Debounce typing; keep ?q= in the URL so results are shareable/back-able.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = input.trim();
      setQ(next);
      const url = new URL(window.location.href);
      if (next) url.searchParams.set("q", next);
      else url.searchParams.delete("q");
      router.replace(url.pathname + url.search, { scroll: false });
    }, 250);
    return () => window.clearTimeout(id);
  }, [input, router]);

  const scope = workspaceId ?? "personal";
  const query = useInfiniteQuery({
    queryKey: qk.search(scope, q),
    queryFn: ({ pageParam }) =>
      api.searchMessages({ q, workspaceId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: q.length >= 2,
  });
  const hits = query.data?.pages.flatMap((page) => page.hits) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {workspaceId
            ? "Search messages across channels you can access in this workspace."
            : "Search your direct messages and group conversations."}
        </p>
      </div>
      <Input
        ref={field}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search messages…"
        aria-label="Search messages"
        autoFocus
      />
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {query.isFetching && !query.isFetchingNextPage ? "Searching…" : null}
        {q.length >= 2 && !query.isFetching && hits.length === 0 ? "No results." : null}
      </div>
      <ul className="space-y-2">
        {hits.map((hit) => {
          const conversation = hit.conversation;
          const href =
            conversation.kind === "channel" && conversation.workspaceId
              ? `/w/${conversation.workspaceId}/channel/${hit.conversationId}?msg=${hit.id}`
              : `/dm/${hit.conversationId}?msg=${hit.id}`;
          const where =
            conversation.kind === "channel"
              ? `#${conversation.name ?? conversation.slug}`
              : conversationTitle(conversation, currentUserId);
          const sender = conversation.members?.find((m) => m.id === hit.senderId);
          return (
            <li key={hit.id}>
              <Link
                href={href}
                className="block rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <p className="flex justify-between gap-3 font-mono text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {where}
                    {sender ? ` · ${sender.displayName}` : ""}
                  </span>
                  <time dateTime={hit.createdAt}>{new Date(hit.createdAt).toLocaleString()}</time>
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {highlightTerms(snippetAround(hit.content, q), q).map((segment, index) =>
                    segment.highlight ? (
                      <mark key={index} className="rounded bg-[var(--accent-soft)] text-foreground">
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {query.hasNextPage ? (
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "More results"}
        </button>
      ) : null}
    </div>
  );
}
