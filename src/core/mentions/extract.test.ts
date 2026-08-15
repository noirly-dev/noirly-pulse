import { describe, expect, it } from "vitest";
import { extractMentionedUserIds } from "@/src/core/mentions/extract";

describe("extractMentionedUserIds", () => {
  it("pulls ObjectIds from pulse mention chips", () => {
    const a = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const b = "bbbbbbbbbbbbbbbbbbbbbbbb";
    expect(
      extractMentionedUserIds(`hello [@Ada](pulse://user/${a}) and [@Bo](pulse://user/${b})`),
    ).toEqual([a, b]);
  });

  it("dedupes and ignores plain @names", () => {
    const a = "aaaaaaaaaaaaaaaaaaaaaaaa";
    expect(
      extractMentionedUserIds(`@Ada [@Ada](pulse://user/${a}) [@Ada](pulse://user/${a})`),
    ).toEqual([a]);
  });
});
