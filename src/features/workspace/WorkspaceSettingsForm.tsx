"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input } from "@noirly-dev/ui";
import { qk } from "@/src/core/sync/query-keys";
import { useCan } from "@/src/features/workspace/WorkspaceRoleContext";
import { api } from "@/src/lib/api-client";
import { zodResolver } from "@/src/lib/zod-resolver";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
});
type Values = z.infer<typeof schema>;

type Props = {
  workspaceId: string;
  name: string;
  slug: string;
};

export function WorkspaceSettingsForm({ workspaceId, name, slug }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan("channel.manage");
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name, slug },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: Values) {
    setSaved(false);
    try {
      await api.updateWorkspace(workspaceId, values);
      form.reset(values);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: qk.workspaces });
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Could not save",
      });
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 border border-[var(--hairline)] bg-[var(--surface)] p-5"
      noValidate
    >
      <div className="space-y-1">
        <label htmlFor="ws-name" className="text-sm font-medium">
          Workspace name
        </label>
        <Input id="ws-name" disabled={!canManage} {...form.register("name")} />
        {errors.name ? <p className="text-xs text-[var(--warning,#d9a759)]">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="ws-slug" className="text-sm font-medium">
          Slug
        </label>
        <Input id="ws-slug" disabled={!canManage} {...form.register("slug")} />
        {errors.slug ? <p className="text-xs text-[var(--warning,#d9a759)]">{errors.slug.message}</p> : null}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-[var(--warning,#d9a759)]">
          {errors.root.message}
        </p>
      ) : null}
      {canManage ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
          {saved && !isDirty ? (
            <span role="status" className="text-sm text-muted-foreground">
              Saved
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only admins and owners can change these.</p>
      )}
    </form>
  );
}
