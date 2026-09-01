export type IceBatcher = {
  add: (candidate: RTCIceCandidateInit) => void;
  flush: () => void;
  complete: () => void;
  dispose: () => void;
};

export function createIceBatcher(opts: {
  onBatch: (candidates: RTCIceCandidateInit[]) => void;
  onComplete?: () => void;
  windowMs?: number;
  maxBatch?: number;
}): IceBatcher {
  const windowMs = opts.windowMs ?? 50;
  const maxBatch = opts.maxBatch ?? 8;
  let buffer: RTCIceCandidateInit[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function emit() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) return;
    const next = buffer;
    buffer = [];
    opts.onBatch(next);
  }

  return {
    add(candidate) {
      if (disposed) return;
      buffer.push(candidate);
      if (buffer.length >= maxBatch) {
        emit();
        return;
      }
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          emit();
        }, windowMs);
      }
    },
    flush: emit,
    complete() {
      emit();
      opts.onComplete?.();
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      buffer = [];
    },
  };
}
