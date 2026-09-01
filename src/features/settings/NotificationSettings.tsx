"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { NotificationPref } from "@/src/core/models/enums";
import { qk } from "@/src/core/sync/query-keys";
import { api } from "@/src/lib/api-client";
import { Button } from "@noirly-dev/ui";

const PREFS: Array<{ value: NotificationPref; label: string; description: string }> = [
  {
    value: "all",
    label: "All activity",
    description: "DMs, mentions, and thread replies.",
  },
  {
    value: "mentions",
    label: "Mentions & direct messages",
    description: "Skip channel-wide noise; still get @mentions and DMs.",
  },
  {
    value: "none",
    label: "Mute",
    description: "No in-app or push notifications.",
  },
];

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: qk.me, queryFn: () => api.me() });
  const pref = data?.user.defaultNotificationPref ?? "all";
  const [pushState, setPushState] = useState<"unsupported" | "denied" | "off" | "on">("off");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    void navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      setPushState(reg?.active ? "on" : "off");
    });
  }, []);

  const savePref = useMutation({
    mutationFn: (next: NotificationPref) => api.updatePreferences({ defaultNotificationPref: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });

  async function enablePush() {
    setPushBusy(true);
    try {
      const { publicKey } = await api.pushVapidKey();
      if (!publicKey) throw new Error("Push is not configured on this server.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await registration.update();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.subscribePush(subscription.toJSON() as PushSubscriptionJSON);
      setPushState("on");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushState("off");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 border border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-foreground">Default notifications</h2>
        <p className="text-sm text-muted-foreground">
          Applies to new conversations. Override per channel from channel settings later.
        </p>
        <div className="space-y-2">
          {PREFS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer gap-3 border border border-[var(--hairline)] px-3 py-3 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <input
                type="radio"
                name="notification-pref"
                checked={pref === option.value}
                onChange={() => savePref.mutate(option.value)}
                className="mt-1 accent-ink"
              />
              <span>
                <span className="block text-sm text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 border border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-foreground">Browser push</h2>
        {pushState === "unsupported" ? (
          <p className="text-sm text-muted-foreground">Push is not supported in this browser.</p>
        ) : pushState === "denied" ? (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked. Enable them in your browser settings for this site.
          </p>
        ) : pushState === "on" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Push is enabled for mentions, DMs, and thread replies.</p>
            <Button variant="ghost" disabled={pushBusy} onClick={() => void disablePush()}>
              Disable
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Get notified when you are away from Pulse.
            </p>
            <Button disabled={pushBusy} onClick={() => void enablePush()}>
              Enable push
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
