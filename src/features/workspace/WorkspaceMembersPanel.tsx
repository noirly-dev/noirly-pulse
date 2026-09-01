"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { User } from "@/src/core/models/types";
import { qk } from "@/src/core/sync/query-keys";
import { useCan } from "@/src/features/workspace/WorkspaceRoleContext";
import { api } from "@/src/lib/api-client";
import { Button, Input } from "@noirly-dev/ui";
import { Avatar } from "@/src/components/Avatar";

type Props = {
  workspaceId: string;
  currentUserId: string;
};

export function WorkspaceMembersPanel({ workspaceId, currentUserId }: Props) {
  const queryClient = useQueryClient();
  const canManage = useCan("members.manage");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api.listMembers(workspaceId),
  });
  const members = data?.members ?? [];

  async function invite() {
    setPending(true);
    setError(null);
    try {
      await api.inviteMember(workspaceId, email, role);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setPending(false);
    }
  }

  async function changeRole(member: User, next: "admin" | "member") {
    await api.updateMemberRole(workspaceId, member.id, next);
    await queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  }

  async function remove(member: User) {
    if (!confirm(`Remove ${member.displayName} from this workspace?`)) return;
    await api.removeMember(workspaceId, member.id);
    await queryClient.invalidateQueries({ queryKey: qk.members(workspaceId) });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates by email. If they already use Pulse, they join immediately.
        </p>
      </div>
      {canManage ? (
        <div className="space-y-3 border border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-medium">Invite by email</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              type="email"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
              className="rounded-lg border border-[var(--hairline)] bg-background px-3 py-2 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button disabled={pending || !email.trim()} onClick={() => void invite()}>
              Invite
            </Button>
          </div>
          {error ? <p className="text-sm text-foreground">{error}</p> : null}
        </div>
      ) : null}
      <ul className="divide-y divide-[var(--hairline)] border border border-[var(--hairline)] bg-[var(--surface)]">
        {members.map(({ user, role: memberRole }) => (
          <li key={user.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="rounded bg-background px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {memberRole}
            </span>
            {canManage && user.id !== currentUserId && memberRole !== "owner" ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void changeRole(user, memberRole === "admin" ? "member" : "admin")
                  }
                >
                  {memberRole === "admin" ? "Demote" : "Promote"}
                </button>
                <button
                  type="button"
                  className="text-xs text-foreground"
                  onClick={() => void remove(user)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
