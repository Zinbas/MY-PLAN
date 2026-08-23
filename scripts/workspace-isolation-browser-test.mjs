const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1;
const waiting = new Map();
let persona = null;
ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Fetch.requestPaused" && message.params.request.url.includes("/api/trpc/auth.me")) {
    const body = Buffer.from(JSON.stringify([{ result: { data: { json: persona } } }])).toString("base64");
    const id = nextId++;
    ws.send(JSON.stringify({ id, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body } }));
    return;
  }
  if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
});
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Evaluation failed");
  return result.result.value;
};
const task = (id, title) => ({ id, title, dueAt: "2030-01-01T09:00:00", priority: "normal", course: "Private", notes: "", completed: false, status: "open", createdAt: "2029-12-01T09:00:00", completedAt: null });
const admin = { id: 991, openId: "test-admin", email: "admin@example.test", name: "Admin", loginMethod: "test", role: "admin", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", lastSignedIn: "2026-01-01T00:00:00.000Z" };
const member = { ...admin, id: 992, openId: "test-member", email: "member@example.test", name: "Member", role: "user" };

await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }] });
const originalGuest = await evaluate(`localStorage.getItem('my-plan-tasks:guest')`);
try {
  await evaluate(`localStorage.setItem('my-plan-welcome-seen', 'true'); localStorage.setItem('my-plan-tasks:user-991', JSON.stringify([${JSON.stringify(task("admin-task", "Administrator-only task"))}])); localStorage.setItem('my-plan-tasks:user-992', JSON.stringify([${JSON.stringify(task("member-task", "Member-only task"))}])); true`);
  const results = [];
  for (const scenario of [
    { label: "Administrator", user: admin, own: "Administrator-only task", other: "Member-only task", adminVisible: true },
    { label: "Member", user: member, own: "Member-only task", other: "Administrator-only task", adminVisible: false },
    { label: "Guest", user: null, own: "Guest-only task", other: "Administrator-only task", adminVisible: false },
  ]) {
    if (scenario.label === "Guest") await evaluate(`localStorage.setItem('my-plan-tasks:guest', JSON.stringify([${JSON.stringify(task("guest-task", "Guest-only task"))}])); true`);
    persona = scenario.user;
    await command("Page.navigate", { url: "http://127.0.0.1:3000/" });
    await sleep(900);
    await evaluate(`(() => [...document.querySelectorAll('.side-nav button')].find(button => button.textContent.includes('To-do'))?.click())()`);
    await sleep(120);
    const state = await evaluate(`({ text: document.body.innerText, adminVisible: [...document.querySelectorAll('.side-nav button')].some(button => button.textContent.includes('Admin panel')) })`);
    if (!state.text.includes(scenario.own) || state.text.includes(scenario.other) || state.adminVisible !== scenario.adminVisible) throw new Error(`${scenario.label} workspace boundary failed`);
    results.push(scenario.label);
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally {
  await evaluate(`localStorage.removeItem('my-plan-tasks:user-991'); localStorage.removeItem('my-plan-tasks:user-992'); ${originalGuest == null ? "localStorage.removeItem('my-plan-tasks:guest')" : `localStorage.setItem('my-plan-tasks:guest', ${JSON.stringify(originalGuest)})`}; true`);
  persona = null;
  await command("Fetch.disable");
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" });
}
ws.close();
