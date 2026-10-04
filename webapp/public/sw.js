/* Lexari service worker: shows push notifications and opens the right screen when you tap one. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Lexari", body: event.data ? event.data.text() : "" }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const looking = wins.some((w) => w.visibilityState === "visible" && w.focused !== false);
    // Agent replies while you're already in the app: the chat shows it, no system ping.
    if (looking && data.kind === "reply") return;
    wins.forEach((w) => w.postMessage({ type: "lexari-notify", data }));
    await self.registration.showNotification(data.title || "Lexari", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.kind === "reply" ? `reply:${data.url || ""}` : data.id || undefined,
      renotify: data.kind === "reply",
      data: { url: data.url || "/agents", id: data.id },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/agents", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ("navigate" in w) { try { await w.navigate(url); } catch {} }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
