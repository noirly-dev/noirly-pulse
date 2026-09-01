import { describe, expect, it } from "vitest";
import type { Message } from "@/src/core/models/types";
import {
  appendMessage,
  markFailed,
  newestMessageId,
  replaceNonce,
  tombstoneMessage,
  type MessagesInfinite,
} from "@/src/core/sync/message-cache";

function msg(partial: Partial<Message> & Pick<Message, "id" | "clientNonce">): Message {
  return {
    conversationId: "c1",
    senderId: "u1",
    kind: "user",
    content: "hi",
    callLog: null,
    mentionedUserIds: [],
    attachments: [],
    threadParentId: null,
    replyCount: 0,
    lastReplyAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reactions: [],
    ...partial,
  };
}

function data(messages: Message[]): MessagesInfinite {
  return {
    pages: [{ messages, nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  };
}

describe("message cache", () => {
  it("appends a new message to the newest page", () => {
    const next = appendMessage(data([msg({ id: "1", clientNonce: "a" })]), msg({ id: "2", clientNonce: "b" }));
    expect(next.pages[0]?.messages.map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("dedupes by clientNonce then id", () => {
    const optimistic = msg({ id: "tmp", clientNonce: "n1", localStatus: "sending" });
    const acked = msg({ id: "real", clientNonce: "n1", content: "hi" });
    const next = appendMessage(data([optimistic]), acked);
    expect(next.pages[0]?.messages).toHaveLength(1);
    expect(next.pages[0]?.messages[0]?.id).toBe("real");
  });

  it("replaceNonce swaps the optimistic row", () => {
    const next = replaceNonce(
      data([msg({ id: "tmp", clientNonce: "n1", localStatus: "sending" })]),
      "n1",
      msg({ id: "real", clientNonce: "n1" }),
    );
    expect(next.pages[0]?.messages[0]?.id).toBe("real");
    expect(next.pages[0]?.messages[0]?.localStatus).toBeUndefined();
  });

  it("marks failed and tombstones", () => {
    const failed = markFailed(data([msg({ id: "tmp", clientNonce: "n1", localStatus: "sending" })]), "n1");
    expect(failed.pages[0]?.messages[0]?.localStatus).toBe("failed");
    const gone = tombstoneMessage(data([msg({ id: "real", clientNonce: "n1", content: "x" })]), "real", "2026-01-02T00:00:00.000Z");
    expect(gone.pages[0]?.messages[0]?.deletedAt).toBeTruthy();
    expect(gone.pages[0]?.messages[0]?.content).toBe("");
  });

  it("reports newest id", () => {
    expect(newestMessageId(data([msg({ id: "1", clientNonce: "a" }), msg({ id: "2", clientNonce: "b" })]))).toBe("2");
  });
});
