"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { conversationTitle } from "@/src/core/chat/title";
import { qk } from "@/src/core/sync/query-keys";
import { StartConversationDialog } from "@/src/features/chat/StartConversationDialog";
import { api } from "@/src/lib/api-client";
import { cn } from "@/src/lib/cn";
import { useUnreadStore } from "@/src/stores/ui-store";
import { Avatar } from "@/src/ui/Avatar";
import { Badge } from "@/src/ui/Badge";

type Props = {
  currentUserId: string;
  onNavigate?: () => void;
};

function itemClass(active: boolean) {
  return cn(
    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
    active
      ? "bg-ink text-canvas"
      : "text-muted hover:bg-ink hover:text-canvas",
  );
}

export function DmSidebar({ currentUserId, onNavigate }: Props) {
  const pathname = usePathname();
  const [dialog, setDialog] = useState<"dm" | "group" | null>(null);
  const unread = useUnreadStore((s) => s.byConversationId);
  const { data } = useQuery({
    queryKey: qk.conversations("personal"),
    queryFn: () => api.listConversations(),
  });
  const conversations = data?.conversations ?? [];

  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-canvas">
      <div className="border-b border-dashed border-hairline px-4 py-4">
        <p className="px-0 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Direct messages
        </p>
        <div className="flex gap-px">
          <button
            type="button"
            onClick={() => setDialog("dm")}
            className="flex-1 px-2 py-2 text-left text-sm text-ink hover:bg-ink hover:text-canvas"
          >
            New DM
          </button>
          <button
            type="button"
            onClick={() => setDialog("group")}
            className="flex-1 px-2 py-2 text-left text-sm text-ink hover:bg-ink hover:text-canvas"
          >
            New group
          </button>
        </div>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 py-3">
        <Link href="/inbox" onClick={onNavigate} className={itemClass(pathname === "/inbox")}>
          Inbox
        </Link>
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted">
            No conversations yet. Start a DM to message someone who has opened Pulse.
          </p>
        ) : (
          conversations.map((conversation) => {
            const href = `/dm/${conversation.id}`;
            const active = pathname === href;
            const count = unread[conversation.id] ?? conversation.unreadCount;
            const title = conversationTitle(conversation, currentUserId);
            const other = conversation.members.find((m) => m.id !== currentUserId);
            return (
              <Link
                key={conversation.id}
                href={href}
                onClick={onNavigate}
                className={itemClass(active)}
              >
                <Avatar name={title} src={other?.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                {count > 0 ? <Badge>{count > 99 ? "99+" : count}</Badge> : null}
              </Link>
            );
          })
        )}
      </nav>
      <StartConversationDialog
        open={dialog !== null}
        mode={dialog === "group" ? "group" : "dm"}
        onClose={() => setDialog(null)}
      />
    </aside>
  );
}
