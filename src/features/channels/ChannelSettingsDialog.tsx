"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Dialog, Input } from "@noirly-dev/ui";
import type { ConversationSummary } from "@/src/core/models/types";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { zodResolver } from "@/src/lib/zod-resolver";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  topic: z.string().trim().max(500),
  visibility: z.enum(["public", "private"]),
});
type Values = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  channel: ConversationSummary;
  workspaceId: string;
  currentUserId: string;
  /** admin+ (channel.manage). Members only see "Leave" for private channels. */
  canManage: boolean;
};

/** ChannelSettingsForm + PrivateChannelInvite (§8.3), archive (§9.2). */
export function ChannelSettingsDialog({
  open,
  onClose,
  channel,
  workspaceId,
  currentUserId,
  canManage,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const isPrivate = channel.visibility === "private";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: channel.name ?? "",
      topic: channel.topic ?? "",
      visibility: channel.visibility ?? "public",
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const workspaceMembers = useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api.listMembers(workspaceId),
    enabled: open && isPrivate && canManage,
  });
  const inChannel = new Set(channel.members.map((m) => m.id));
  const candidates = (workspaceMembers.data?.members ?? [])
    .map((row) => row.user)
    .filter((user) => !inChannel.has(user.id));

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.conversation(channel.id) }),
      queryClient.invalidateQueries({ queryKey: qk.channels(workspaceId) }),
    ]);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(values: Values) {
    await run(() =>
      api.updateChannel(channel.id, {
        name: values.name,
        topic: values.topic ? values.topic : null,
        visibility: values.visibility,
      }),
    );
  }

  return (
    <Dialog open={open} title={`#${channel.name ?? channel.slug} settings`} onClose={onClose}>
      <div className="space-y-5">
        {canManage ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1">
              <label htmlFor="ch-name" className="text-sm font-medium">
                Name
              </label>
              <Input id="ch-name" {...form.register("name")} />
              {errors.name ? <p className="text-xs">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="ch-topic" className="text-sm font-medium">
                Topic
              </label>
              <Input id="ch-topic" {...form.register("topic")} placeholder="What is this channel about?" />
            </div>
            <fieldset className="flex gap-2 text-sm">
              <legend className="sr-only">Visibility</legend>
              {(["public", "private"] as const).map((value) => (
                <label
                  key={value}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--hairline)] px-3 py-2 capitalize"
                >
                  <input type="radio" value={value} {...form.register("visibility")} />
                  {value}
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy || isSubmitting || !isDirty}>
              Save changes
            </Button>
          </form>
        ) : channel.topic ? (
          <p className="text-sm text-muted-foreground">{channel.topic}</p>
        ) : null}

        <section className="space-y-2" aria-labelledby="ch-notify">
          <h3 id="ch-notify" className="text-sm font-medium">
            Notifications for this channel
          </h3>
          <select
            aria-labelledby="ch-notify"
            defaultValue={channel.myNotifications ?? "all"}
            disabled={busy}
            onChange={(e) =>
              void run(() =>
                api.updateConversationNotifications(
                  channel.id,
                  e.target.value as "all" | "mentions" | "none",
                ),
              )
            }
            className="w-full border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2 text-sm"
          >
            <option value="all">All messages</option>
            <option value="mentions">Mentions only</option>
            <option value="none">Mute</option>
          </select>
        </section>

        {isPrivate ? (
          <section className="space-y-2" aria-labelledby="ch-members">
            <h3 id="ch-members" className="text-sm font-medium">
              Members ({channel.members.length})
            </h3>
            <ul className="max-h-48 divide-y divide-[var(--hairline)] overflow-y-auto border border-[var(--hairline)]">
              {channel.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate">
                    {member.displayName}
                    {member.id === currentUserId ? " (you)" : ""}
                  </span>
                  {canManage && member.id !== currentUserId ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      disabled={busy}
                      onClick={() => void run(() => api.removeChannelMember(channel.id, member.id))}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <div className="flex gap-2">
                <select
                  aria-label="Add a workspace member"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="min-w-0 flex-1 border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2 text-sm"
                >
                  <option value="">Add a workspace member…</option>
                  {candidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  disabled={busy || !addUserId}
                  onClick={() =>
                    void run(async () => {
                      await api.addChannelMembers(channel.id, [addUserId]);
                      setAddUserId("");
                    })
                  }
                >
                  Add
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!confirm("Leave this private channel? You will need to be re-added.")) return;
                void run(async () => {
                  await api.removeChannelMember(channel.id, currentUserId);
                  onClose();
                  router.push(`/w/${workspaceId}`);
                });
              }}
            >
              Leave channel
            </Button>
          </section>
        ) : null}

        {canManage ? (
          <section className="space-y-2 border-t border-[var(--hairline)] pt-4">
            <h3 className="text-sm font-medium">Archive</h3>
            <p className="text-xs text-muted-foreground">
              Archived channels disappear for everyone. History is kept.
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Archive #${channel.name ?? channel.slug}?`)) return;
                void run(async () => {
                  await api.archiveChannel(channel.id);
                  onClose();
                  router.push(`/w/${workspaceId}`);
                });
              }}
            >
              Archive channel
            </Button>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
