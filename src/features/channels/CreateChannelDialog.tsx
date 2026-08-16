"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/src/lib/api-client";
import { Button } from "@/src/ui/Button";
import { Dialog } from "@/src/ui/Dialog";
import { Input } from "@/src/ui/Input";

type Props = {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated?: () => void;
};

export function CreateChannelDialog({ open, workspaceId, onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { channel } = await api.createChannel(workspaceId, {
        name,
        visibility,
        topic: topic || undefined,
      });
      onCreated?.();
      onClose();
      setName("");
      setTopic("");
      setVisibility("public");
      router.push(`/w/${workspaceId}/channel/${channel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create channel");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="New channel" onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          autoFocus
        />
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (optional)"
        />
        <div className="flex gap-2 text-sm">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 py-2">
            <input
              type="radio"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            Public
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 py-2">
            <input
              type="radio"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            Private
          </label>
        </div>
        {error ? <p className="text-sm text-ink">{error}</p> : null}
        <Button disabled={pending || !name.trim()} onClick={() => void submit()}>
          Create channel
        </Button>
      </div>
    </Dialog>
  );
}
