import { describe, expect, it } from "vitest";
import { preferredSpatialLayer, tileColumns } from "./grid-layout";

describe("tileColumns", () => {
  it("spotlights a single tile", () => {
    expect(tileColumns(1)).toBe(1);
  });

  it("splits two tiles", () => {
    expect(tileColumns(2)).toBe(2);
  });

  it("uses a 2x2 grid for three or four tiles", () => {
    expect(tileColumns(3)).toBe(2);
    expect(tileColumns(4)).toBe(2);
  });

  it("uses a 3x3 grid for five to nine tiles", () => {
    expect(tileColumns(5)).toBe(3);
    expect(tileColumns(9)).toBe(3);
  });

  it("uses four columns once there are ten or more tiles", () => {
    expect(tileColumns(10)).toBe(4);
    expect(tileColumns(16)).toBe(4);
  });
});

describe("preferredSpatialLayer", () => {
  it("requests the full layer for one or two tiles", () => {
    expect(preferredSpatialLayer(1)).toBe(2);
    expect(preferredSpatialLayer(2)).toBe(2);
  });

  it("requests the middle layer for three to eight tiles", () => {
    expect(preferredSpatialLayer(3)).toBe(1);
    expect(preferredSpatialLayer(8)).toBe(1);
  });

  it("requests the lowest layer for nine or more tiles", () => {
    expect(preferredSpatialLayer(9)).toBe(0);
  });
});
