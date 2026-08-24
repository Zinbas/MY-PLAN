self.addEventListener("push", event => {
  const payload = event.data ? event.data.json() : {};
  const title = typeof payload.title === "string" ? payload.title : "MY PLAN reminder";
  const body = typeof payload.body === "string" ? payload.body : "Something in your plan needs attention.";
  const route = typeof payload.route === "string" && payload.route.startsWith("/") ? payload.route : "/";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/manus-storage/my-plan-note-mark_567e5611.jpg",
    badge: "/manus-storage/my-plan-note-mark_567e5611.jpg",
    tag: typeof payload.tag === "string" ? payload.tag : "my-plan-reminder",
    renotify: false,
    data: { route },
    actions: [{ action: "open", title: "Open MY PLAN" }],
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const route = event.notification?.data?.route || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    const existing = clientList.find(client => client.url.startsWith(self.location.origin));
    if (existing) return existing.navigate(route).then(() => existing.focus());
    return clients.openWindow(route);
  }));
});
