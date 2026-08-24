const defaultRoute = "/?section=calendar";

function safeRoute(value) {
  if (typeof value !== "string") return defaultRoute;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return defaultRoute;
    const section = url.searchParams.get("section");
    if (section !== "calendar" && section !== "todo") return defaultRoute;
    const reminder = url.searchParams.get("reminder");
    return `/?section=${section}${reminder ? `&reminder=${encodeURIComponent(reminder)}` : ""}`;
  } catch {
    return defaultRoute;
  }
}

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = typeof payload.title === "string" ? `MY PLAN · ${payload.title}` : "MY PLAN reminder";
  const body = typeof payload.body === "string" ? payload.body : "Something in your plan needs attention.";
  const route = safeRoute(payload.route);
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
  const route = safeRoute(event.notification?.data?.route);
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    const existing = clientList.find(client => client.url.startsWith(self.location.origin));
    if (existing) return existing.navigate(route).then(() => existing.focus());
    return clients.openWindow(route);
  }));
});
