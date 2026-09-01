import { describe, expect, it, vi } from "vitest";
import { createIceBatcher } from "./ice-batch";

describe("createIceBatcher", () => {
  it("flushes after maxBatch without waiting", () => {
    const onBatch = vi.fn();
    const batcher = createIceBatcher({ onBatch, maxBatch: 2, windowMs: 50_000 });
    batcher.add({ candidate: "a" });
    batcher.add({ candidate: "b" });
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0]?.[0]).toHaveLength(2);
    batcher.dispose();
  });

  it("flushes on complete even with one candidate", () => {
    const onBatch = vi.fn();
    const onComplete = vi.fn();
    const batcher = createIceBatcher({ onBatch, onComplete, maxBatch: 8, windowMs: 50_000 });
    batcher.add({ candidate: "a" });
    batcher.complete();
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    batcher.dispose();
  });
});
