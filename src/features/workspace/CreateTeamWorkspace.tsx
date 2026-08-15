"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/src/lib/api-client";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";

export function CreateTeamWorkspace() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { workspace } = await api.createWorkspace(name);
      setOpen(false);
      setName("");
      router.push(`/w/${workspace.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-lg border border-dashed border-np-border text-lg text-[#A3A3A3] hover:border-np-accent hover:text-np-accent"
        aria-label="New team workspace"
        title="New team workspace"
      >
        +
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="absolute left-16 top-20 z-50 w-64 space-y-2 rounded-lg border border-np-border bg-np-surface p-3 shadow-lg"
    >
      <label className="block text-xs text-[#A3A3A3]" htmlFor="team-name">
        Team name
      </label>
      <Input
        id="team-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Marketing"
        required
        autoFocus
      />
      {error ? <p className="text-xs text-np-warning">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-8 px-3 text-xs">
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-3 text-xs"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
