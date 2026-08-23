const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map();
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Fetch.requestPaused" && message.params.request.url.includes("/api/trpc/auth.me")) { ws.send(JSON.stringify({ id: nextId++, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify([{ result: { data: { json: null } } }])).toString("base64") } })); return; } if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "Browser evaluation failed"); return value.result.value; };
await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }] });
const keys = ["my-plan-tasks:guest", "my-plan-notification-preferences:guest", "my-plan-notification-read:guest"];
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  const testTask = { id: "notification-browser-task", title: "Notification browser task", dueAt: "2026-08-22T09:00:00", priority: "high", course: "Review", notes: "", completed: false, status: "open", createdAt: "2026-08-01T09:00:00", completedAt: null };
  await evaluate(`localStorage.setItem('my-plan-welcome-seen', 'true'); localStorage.setItem('my-plan-tasks:guest', JSON.stringify([${JSON.stringify(testTask)}])); localStorage.removeItem('my-plan-notification-preferences:guest'); localStorage.removeItem('my-plan-notification-read:guest'); true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(850);
  let state = await evaluate(`({ button: document.querySelector('.notification-trigger')?.getAttribute('aria-label'), badge: document.querySelector('.notification-trigger b')?.textContent })`);
  if (!state.button?.includes('1 unread') || state.badge !== '1') throw new Error(`Notification trigger did not announce the unread derived reminder: ${JSON.stringify(state)}`);
  await evaluate(`document.querySelector('.notification-trigger')?.click()`); await sleep(80);
  state = await evaluate(`document.body.innerText`);
  if (!state.includes('Only what needs attention.') || !state.includes('Notification browser task') || !state.includes('Overdue')) throw new Error('Notification Center did not render its actionable reminder');
  await evaluate(`([...document.querySelectorAll('.notification-list article button')].find(button => button.textContent.includes('Notification browser task')))?.click()`); await sleep(100);
  state = await evaluate(`({ todo: document.body.innerText.includes('To-do, without the pile.') && document.body.innerText.includes('Notification browser task'), read: JSON.parse(localStorage.getItem('my-plan-notification-read:guest') || '[]').length })`);
  if (!state.todo || state.read !== 1) throw new Error('Notification action did not navigate to the task and persist its read state');
  await evaluate(`document.querySelector('.notification-trigger')?.click()`); await sleep(80);
  await evaluate(`(() => { const input = [...document.querySelectorAll('.notification-preferences input')][0]; input?.click(); })()`); await sleep(80);
  if (await evaluate(`Boolean([...document.querySelectorAll('.notification-list article')].find(item => item.textContent.includes('Notification browser task')))`)) throw new Error('Task deadline preference did not suppress the derived reminder');
  console.log(JSON.stringify({ passed: 4, results: ["unread badge", "notification center", "action/read state", "preference suppression"] }, null, 2));
} finally {
  await evaluate(`const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); true`);
  await command("Fetch.disable"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" });
  ws.close();
}
