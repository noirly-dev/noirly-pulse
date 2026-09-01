import { describe, expect, it } from "vitest";
import { mintIceServers, mintTurnCredential, mintTurnUsername } from "./ice";

describe("TURN REST credentials", () => {
  it("builds expiry:userId usernames", () => {
    const { username, expiry } = mintTurnUsername("user1", 1_700_000_000_000, 900);
    expect(username).toBe(`${expiry}:user1`);
    expect(expiry).toBe(1_700_000_000 + 900);
  });

  it("HMACs the username with SHA-1", () => {
    expect(mintTurnCredential("secret", "1700000900:user1")).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("mints time-limited TURN servers when TURN_SECRET is set", () => {
    const servers = mintIceServers("user1", {
      STUN_URLS: "stun:stun.example:3478",
      TURN_URLS: "turn:turn.example:3478?transport=udp",
      TURN_SECRET: "secret",
      TURN_TTL_SECONDS: "900",
    }, 1_700_000_000_000);
    expect(servers).toHaveLength(2);
    expect(servers[0]?.urls).toEqual(["stun:stun.example:3478"]);
    expect(servers[1]?.username).toBe("1700000900:user1");
    expect(servers[1]?.credential).toBe(mintTurnCredential("secret", "1700000900:user1"));
  });

  it("returns STUN only when TURN_URLS is empty", () => {
    const servers = mintIceServers("user1", { STUN_URLS: "stun:stun.example:3478" });
    expect(servers).toEqual([{ urls: ["stun:stun.example:3478"] }]);
  });
});
