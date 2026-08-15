"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { highlightTerms } from "@/src/core/search/highlight";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { Input } from "@/src/ui/Input";

type Props = {
  workspaceId: string;
};

export function WorkspaceSearchPanel({ workspaceId }: Props) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: qk.search(workspaceId, q),
    queryFn: () => api.searchMessages({ q, workspaceId }),
    enabled: q.trim().length >= 2,
  });
  const hits = data?.hits ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Search</h1>
        <p className="mt-1 text-sm text-[#737373]">
          Search messages across channels you can access in this workspace.
        </p>
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search messages…"
        autoFocus
      />
      {isFetching ? <p className="text-sm text-[#737373]">Searching…</p> : null}
      <ul className="space-y-2">
        {hits.map((hit) => {
          const href = `/w/${workspaceId}/channel/${hit.conversationId}?msg=${hit.id}`;
          return (
            <li key={hit.id}>
              <Link
                href={href}
                className="block rounded-lg border border-np-border bg-np-surface px-4 py-3 text-sm transition hover:bg-np-surface-hover"
              >
                <p className="font-mono text-[10px] text-[#737373]">
                  #{hit.conversation.name ?? hit.conversation.slug}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">
                  {highlightTerms(hit.content, q).map((segment, index) =>
                    segment.highlight ? (
                      <mark
                        key={`${hit.id}-${index}`}
                        className="rounded bg-np-accent/25 text-[#F5F5F5]"
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={`${hit.id}-${index}`}>{segment.text}</span>
                    ),
                  )}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {q.trim().length >= 2 && !isFetching && hits.length === 0 ? (
        <p className="text-sm text-[#737373]">No results.</p>
      ) : null}
    </div>
  );
}
