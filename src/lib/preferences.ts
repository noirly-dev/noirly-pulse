/**
 * Per-browser UI preferences (ARCHITECTURE §8.5, settings/preferences).
 * Reads never throw: private windows or blocked storage fall back to defaults.
 */
const ENTER_TO_SEND_KEY = "pulse:enter-to-send";

export function readEnterToSend(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ENTER_TO_SEND_KEY) !== "false";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();

/** For useSyncExternalStore: same-tab writes plus other tabs' storage events. */
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function writeEnterToSend(value: boolean): void {
  try {
    window.localStorage.setItem(ENTER_TO_SEND_KEY, value ? "true" : "false");
  } catch {
    /* storage unavailable */
  }
  for (const listener of listeners) listener();
}
