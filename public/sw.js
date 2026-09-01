self.addEventListener("push", (event) => {
  const payload = event.data?.json() as
    | { title?: string; body?: string; url?: string }
    | undefined;
  if (!payload) return;
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Noirly Pulse", {
      body: payload.body ?? "",
      data: { url: payload.url ?? "/" },
      tag: payload.url ?? "pulse",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
