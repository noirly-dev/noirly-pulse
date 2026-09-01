/** CSS grid column count for an n-tile call stage. */
export function tileColumns(n: number): number {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

/** Preferred mediasoup spatial layer for the current tile count. */
export function preferredSpatialLayer(tileCount: number): number {
  if (tileCount <= 2) return 2;
  if (tileCount <= 8) return 1;
  return 0;
}
