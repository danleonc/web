/* Push only: no fetch handler or offline cache, so deployments stay current. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let payload = {};
  try { const value = event.data?.json(); if (value && typeof value === "object" && !Array.isArray(value)) payload = value; } catch { /* Generic visible notice. */ }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 64) : "Nexafia";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "Tienes novedades en Nexafia. Abre la aplicación para revisarlas.";
  const tag = typeof payload.tag === "string" ? payload.tag.replace(/[^\w-]/g, "").slice(0, 48) : "nexafia";
  event.waitUntil(self.registration.showNotification(title, { body, tag, icon: new URL("icons/icon-192.png", self.registration.scope).href, badge: new URL("icons/icon-192.png", self.registration.scope).href }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const scope = self.registration.scope;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const current = windows.find(client => client.url.startsWith(scope));
    if (current) { await current.focus(); current.postMessage({ type: "nexafia-open-notifications" }); }
    else { const url = new URL(scope); url.searchParams.set("openNotifications", "1"); url.hash = "plaza"; await self.clients.openWindow(url.href); }
  })());
});
