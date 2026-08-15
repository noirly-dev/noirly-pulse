import { create } from "zustand";
import type { TypingState } from "@/src/core/models/types";

type UIState = {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}));

type WorkspaceUiState = {
  activeWorkspaceId: "personal" | string;
  setActiveWorkspaceId: (id: "personal" | string) => void;
};

export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  activeWorkspaceId: "personal",
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
}));

type ComposerState = {
  drafts: Record<string, string>;
  setDraft: (key: string, value: string) => void;
};

export const useComposerStore = create<ComposerState>((set) => ({
  drafts: {},
  setDraft: (key, value) =>
    set((state) => ({ drafts: { ...state.drafts, [key]: value } })),
}));

type TypingStore = {
  byConv: Record<string, Record<string, TypingState>>;
  onStart: (state: Omit<TypingState, "expiresAt">) => void;
  onStop: (conversationId: string, userId: string, threadParentId: string | null) => void;
  pruneExpired: () => void;
};

export const useTypingStore = create<TypingStore>((set) => ({
  byConv: {},
  onStart: (incoming) =>
    set((state) => {
      const expiresAt = Date.now() + 3500;
      const next = { ...incoming, expiresAt };
      const conv = { ...(state.byConv[incoming.conversationId] ?? {}) };
      conv[`${incoming.userId}:${incoming.threadParentId ?? "root"}`] = next;
      return { byConv: { ...state.byConv, [incoming.conversationId]: conv } };
    }),
  onStop: (conversationId, userId, threadParentId) =>
    set((state) => {
      const conv = { ...(state.byConv[conversationId] ?? {}) };
      delete conv[`${userId}:${threadParentId ?? "root"}`];
      return { byConv: { ...state.byConv, [conversationId]: conv } };
    }),
  pruneExpired: () =>
    set((state) => {
      const now = Date.now();
      const byConv: TypingStore["byConv"] = {};
      for (const [convId, users] of Object.entries(state.byConv)) {
        const next: Record<string, TypingState> = {};
        for (const [key, value] of Object.entries(users)) {
          if (value.expiresAt > now) next[key] = value;
        }
        if (Object.keys(next).length) byConv[convId] = next;
      }
      return { byConv };
    }),
}));

type UnreadState = {
  byConversationId: Record<string, number>;
  bump: (conversationId: string) => void;
  setCount: (conversationId: string, count: number) => void;
  clear: (conversationId: string) => void;
};

export const useUnreadStore = create<UnreadState>((set) => ({
  byConversationId: {},
  bump: (conversationId) =>
    set((state) => ({
      byConversationId: {
        ...state.byConversationId,
        [conversationId]: (state.byConversationId[conversationId] ?? 0) + 1,
      },
    })),
  setCount: (conversationId, count) =>
    set((state) => ({
      byConversationId: { ...state.byConversationId, [conversationId]: count },
    })),
  clear: (conversationId) =>
    set((state) => ({
      byConversationId: { ...state.byConversationId, [conversationId]: 0 },
    })),
}));
