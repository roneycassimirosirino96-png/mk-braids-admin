self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Novo pedido de agendamento";
  const options = {
    body: payload.body || "Uma cliente enviou um novo pedido para a MK Braids.",
    icon: "/mk-braids-admin/icons/mk-braids-192.png",
    badge: "/mk-braids-admin/icons/mk-braids-192.png",
    tag: payload.tag || "mk-braids-new-appointment",
    data: { url: payload.url || "/mk-braids-admin/" },
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = new URL(
    event.notification.data?.url || "/mk-braids-admin/",
    self.location.origin
  ).href;
  const appScope = new URL("/mk-braids-admin/", self.location.origin).href;
  const targetUrl = requestedUrl.startsWith(appScope) ? requestedUrl : appScope;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(appScope) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== targetUrl) {
          await client.navigate(targetUrl);
        }
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(fetch(event.request));
});
