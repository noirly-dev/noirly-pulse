import { describe, expect, it } from "vitest";
import { can, roleAtLeast } from "@/src/core/permissions/can";

describe("can", () => {
  it("lets members view and send, not manage channels", () => {
    expect(can("member", "workspace.view")).toBe(true);
    expect(can("member", "message.send")).toBe(true);
    expect(can("member", "channel.create")).toBe(false);
    expect(can("member", "channel.manage")).toBe(false);
    expect(can("member", "members.manage")).toBe(false);
    expect(can("member", "workspace.delete")).toBe(false);
  });

  it("lets admins create channels and manage members", () => {
    expect(can("admin", "channel.create")).toBe(true);
    expect(can("admin", "channel.manage")).toBe(true);
    expect(can("admin", "members.manage")).toBe(true);
    expect(can("admin", "message.moderate")).toBe(true);
    expect(can("admin", "workspace.delete")).toBe(false);
  });

  it("lets owners delete the workspace", () => {
    expect(can("owner", "members.manage")).toBe(true);
    expect(can("owner", "workspace.delete")).toBe(true);
  });
});

describe("roleAtLeast", () => {
  it("compares ranks", () => {
    expect(roleAtLeast("member", "member")).toBe(true);
    expect(roleAtLeast("admin", "member")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("owner", "admin")).toBe(true);
  });
});
