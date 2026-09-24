"use client";

import { useSyncExternalStore } from "react";
import { readEnterToSend, subscribePreferences, writeEnterToSend } from "@/src/lib/preferences";

/** Composer send key (§8.5): Enter by default, or Cmd/Ctrl+Enter. */
export function PreferencesForm() {
  const enterSends = useSyncExternalStore(subscribePreferences, readEnterToSend, () => true);
  return (
    <section className="space-y-3 border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold">Sending messages</h2>
      <fieldset className="space-y-2 text-sm">
        <legend className="sr-only">Send key</legend>
        <label className="flex cursor-pointer gap-3 border border-[var(--hairline)] px-3 py-3">
          <input
            type="radio"
            name="send-key"
            checked={enterSends}
            onChange={() => writeEnterToSend(true)}
          />
          <span>
            <span className="block">Enter sends</span>
            <span className="block text-xs text-muted-foreground">Shift+Enter adds a new line.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 border border-[var(--hairline)] px-3 py-3">
          <input
            type="radio"
            name="send-key"
            checked={!enterSends}
            onChange={() => writeEnterToSend(false)}
          />
          <span>
            <span className="block">Ctrl/⌘+Enter sends</span>
            <span className="block text-xs text-muted-foreground">Enter adds a new line.</span>
          </span>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Saved in this browser.</p>
    </section>
  );
}
