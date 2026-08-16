"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/src/lib/api-client";

export function CreateTeamWorkspace() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
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
        className="flex size-10 items-center justify-center border border-dashed border-hairline text-lg text-muted hover:bg-ink hover:text-canvas"
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
      className="absolute left-16 top-20 z-50 w-64 border border-dashed border-hairline bg-surface p-3"
    >
      <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted" htmlFor="team-name">
        Team name
      </label>
      <input
        id="team-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Marketing"
        required
        autoFocus
        className="mt-2 h-8 w-full border border-dashed border-hairline bg-canvas px-2 text-xs text-ink outline-none"
      />
      {error ? <p className="mt-2 text-xs text-ink">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 flex-1 bg-ink text-xs font-semibold text-canvas disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create"}
        </button>
        <button
          type="button"
          className="h-8 border border-dashed border-hairline px-2 text-xs text-muted"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
