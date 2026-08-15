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
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
    active
      ? "bg-np-surface text-[#F5F5F5]"
      : "text-[#A3A3A3] hover:bg-np-surface hover:text-[#F5F5F5]",
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
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-np-border bg-np-bg">
      <div className="border-b border-np-border px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#737373]">
          Direct messages
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDialog("dm")}
            className="flex-1 rounded-lg bg-np-surface px-2 py-1.5 text-xs text-[#F5F5F5] hover:bg-np-surface-hover"
          >
            New DM
          </button>
          <button
            type="button"
            onClick={() => setDialog("group")}
            className="flex-1 rounded-lg bg-np-surface px-2 py-1.5 text-xs text-[#F5F5F5] hover:bg-np-surface-hover"
          >
            New group
          </button>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        <Link href="/inbox" onClick={onNavigate} className={itemClass(pathname === "/inbox")}>
          Inbox
        </Link>
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[#737373]">
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
