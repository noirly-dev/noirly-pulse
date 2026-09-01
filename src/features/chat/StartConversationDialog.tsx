"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { Button, Dialog, Input } from "@noirly-dev/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "dm" | "group";
};

export function StartConversationDialog({ open, onClose, mode }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: qk.users(q),
    queryFn: () => api.searchUsers(q),
    enabled: open && q.trim().length >= 1,
  });

  async function start(userId: string) {
    setPending(true);
    setError(null);
    try {
      const { conversation } = await api.createDm(userId);
      await queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
      onClose();
      router.push(`/dm/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start conversation");
    } finally {
      setPending(false);
    }
  }

  async function startGroup() {
    setPending(true);
    setError(null);
    try {
      const { conversation } = await api.createGroupDm(selected, name || undefined);
      await queryClient.invalidateQueries({ queryKey: qk.conversations("personal") });
      onClose();
      setSelected([]);
      setName("");
      router.push(`/dm/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create group");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={mode === "dm" ? "New message" : "New group"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people by name or email"
          autoFocus
        />
        {mode === "group" ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (optional)"
          />
        ) : null}
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {(data?.users ?? []).map((user) => {
            const checked = selected.includes(user.id);
            return (
              <li key={user.id}>
                {mode === "dm" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void start(user.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  >
                    <span>{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </button>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected((current) =>
                          checked
                            ? current.filter((id) => id !== user.id)
                            : [...current, user.id],
                        )
                      }
                    />
                    <span className="flex-1">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        {error ? <p className="text-sm text-foreground">{error}</p> : null}
        {mode === "group" ? (
          <Button disabled={pending || selected.length < 2} onClick={() => void startGroup()}>
            Create group
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
