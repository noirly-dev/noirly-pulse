import { describe, expect, it } from "vitest";
import { canViewConversation } from "@/src/core/permissions/visibility";

describe("canViewConversation", () => {
  it("requires membership for DMs and group DMs", () => {
    expect(
      canViewConversation({
        kind: "dm",
        visibility: null,
        isWorkspaceMember: false,
        isConversationMember: true,
      }),
    ).toBe(true);
    expect(
      canViewConversation({
        kind: "group_dm",
        visibility: null,
        isWorkspaceMember: true,
        isConversationMember: false,
      }),
    ).toBe(false);
  });

  it("lets any workspace member see public channels", () => {
    expect(
      canViewConversation({
        kind: "channel",
        visibility: "public",
        isWorkspaceMember: true,
        isConversationMember: false,
      }),
    ).toBe(true);
    expect(
      canViewConversation({
        kind: "channel",
        visibility: "public",
        isWorkspaceMember: false,
        isConversationMember: false,
      }),
    ).toBe(false);
  });

  it("hides private channels from non-members, including workspace members", () => {
    expect(
      canViewConversation({
        kind: "channel",
        visibility: "private",
        isWorkspaceMember: true,
        isConversationMember: false,
      }),
    ).toBe(false);
    expect(
      canViewConversation({
        kind: "channel",
        visibility: "private",
        isWorkspaceMember: true,
        isConversationMember: true,
      }),
    ).toBe(true);
  });
});
