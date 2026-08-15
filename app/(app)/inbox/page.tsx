import { EmptyState } from "@/src/components/EmptyState";

export default function InboxPage() {
  return (
    <EmptyState
      title="Inbox"
      description="Pick a conversation or start a new DM. Unread messages from people you chat with land here."
    />
  );
}
