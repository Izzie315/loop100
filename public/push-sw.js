// Notification-only worker: shows alerts, no page caching.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "TalkLoop", body: event.data ? event.data.text() : "" };
  }
  const isCall = data.kind === "call";
  event.waitUntil(
    self.registration.showNotification(data.title || "TalkLoop", {
      body: data.body || "",
      tag: data.tag,
      renotify: true,
      icon: "/icon-512.png",
      badge: "/icon-192.png",
      requireInteraction: isCall,
      vibrate: isCall ? [400, 200, 400, 200, 400] : [200],
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      return self.clients.openWindow("/");
    })(),
  );
});
