import type { InfiniteData } from "@tanstack/react-query";
import type { Message } from "@/src/core/models/types";
import type { MessagePage } from "@/src/core/sync/types";

export type MessagesInfinite = InfiniteData<MessagePage, string | undefined>;

function empty(): MessagesInfinite {
  return {
    pages: [{ messages: [], nextCursor: null, prevCursor: null }],
    pageParams: [undefined],
  };
}

function matches(message: Message, incoming: Message): boolean {
  return (
    message.id === incoming.id ||
    (Boolean(incoming.clientNonce) && message.clientNonce === incoming.clientNonce)
  );
}

export function appendMessage(
  data: MessagesInfinite | undefined,
  incoming: Message,
): MessagesInfinite {
  const current = data ?? empty();
  const exists = current.pages.some((page) =>
    page.messages.some((message) => matches(message, incoming)),
  );
  if (exists) {
    return replaceMessage(current, incoming);
  }
  if (current.pages.length === 0) {
    return {
      pages: [{ messages: [incoming], nextCursor: null, prevCursor: null }],
      pageParams: current.pageParams.length ? current.pageParams : [undefined],
    };
  }
  const pages = current.pages.map((page, index) =>
    index === 0 ? { ...page, messages: [...page.messages, incoming] } : page,
  );
  return { ...current, pages };
}

export function replaceNonce(
  data: MessagesInfinite | undefined,
  nonce: string,
  incoming: Message,
): MessagesInfinite {
  const current = data ?? empty();
  let found = false;
  const pages = current.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => {
      if (message.clientNonce === nonce || message.id === incoming.id) {
        found = true;
        return { ...incoming, localStatus: undefined };
      }
      return message;
    }),
  }));
  if (!found) return appendMessage(current, incoming);
  return { ...current, pages };
}

export function replaceMessage(
  data: MessagesInfinite,
  incoming: Message,
): MessagesInfinite {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        matches(message, incoming)
          ? { ...incoming, localStatus: message.localStatus && incoming.localStatus === undefined ? undefined : incoming.localStatus }
          : message,
      ),
    })),
  };
}

export function patchMessage(
  data: MessagesInfinite | undefined,
  messageId: string,
  patch: Partial<Message>,
): MessagesInfinite {
  const current = data ?? empty();
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    })),
  };
}

export function tombstoneMessage(
  data: MessagesInfinite | undefined,
  messageId: string,
  deletedAt: string,
): MessagesInfinite {
  return patchMessage(data, messageId, {
    deletedAt,
    content: "",
    attachments: [],
  });
}

export function markFailed(
  data: MessagesInfinite | undefined,
  nonce: string,
): MessagesInfinite {
  const current = data ?? empty();
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.clientNonce === nonce ? { ...message, localStatus: "failed" } : message,
      ),
    })),
  };
}

export function removeByNonce(
  data: MessagesInfinite | undefined,
  nonce: string,
): MessagesInfinite {
  const current = data ?? empty();
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.clientNonce !== nonce),
    })),
  };
}

export function newestMessageId(data: MessagesInfinite | undefined): string | null {
  const first = data?.pages[0]?.messages;
  if (!first?.length) return null;
  return first[first.length - 1]?.id ?? null;
}
