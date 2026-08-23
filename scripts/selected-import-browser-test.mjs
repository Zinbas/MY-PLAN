const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map();
const user = { id: 998, openId: "import-test-user", email: "import@example.test", name: "Importer", loginMethod: "test", role: "user", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", lastSignedIn: "2026-01-01T00:00:00.000Z" };
const candidates = [
  { id: "public-deadline", title: "Module 1 deadline", kind: "task", date: "2026-03-14", time: "23:59", durationMinutes: 60, course: "Composition I", notes: "Public source deadline", weekdays: [], confidence: .98 },
  { id: "unselected-deadline", title: "Do not import", kind: "task", date: "2026-03-21", time: "23:59", durationMinutes: 60, course: "Composition I", notes: "Unselected public source candidate", weekdays: [], confidence: .98 },
];
const bodyFor = value => Buffer.from(JSON.stringify([{ result: { data: { json: value } } }])).toString("base64");
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Fetch.requestPaused") { const url = message.params.request.url; const value = url.includes("/api/trpc/auth.me") ? user : url.includes("/api/trpc/schedule.extract") ? { file: { name: "public-syllabus.pdf", mimeType: "application/pdf", storageKey: "test-only" }, extractionMode: "document", candidates } : null; if (value !== null) { ws.send(JSON.stringify({ id: nextId++, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: bodyFor(value) } })); return; } } if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }, { urlPattern: "*api/trpc/schedule.extract*" }] });
const keys = ["my-plan-tasks:user-998", "my-plan-events:user-998", "my-plan-blocks:user-998"];
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  await evaluate(`localStorage.setItem('my-plan-welcome-seen', 'true'); localStorage.removeItem('my-plan-tasks:user-998'); localStorage.removeItem('my-plan-events:user-998'); localStorage.removeItem('my-plan-blocks:user-998'); true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(1000);
  await evaluate(`(() => [...document.querySelectorAll('.side-nav button')].find(button => button.textContent.includes('Workspace tools'))?.click())()`); await sleep(100);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Import schedule'))?.click())()`); await sleep(750);
  if (!(await evaluate(`Boolean(document.querySelector('.import-file-input'))`))) throw new Error('Import workspace did not finish loading');
  await evaluate(`(() => { const input = document.querySelector('.import-file-input'); const data = new DataTransfer(); data.items.add(new File(['public syllabus fixture'], 'public-syllabus.pdf', { type: 'application/pdf' })); Object.defineProperty(input, 'files', { value: data.files }); input.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(650);
  const reviewed = await evaluate(`({ text: document.body.innerText, titles: [...document.querySelectorAll('input[aria-label="Imported title"]')].map(input => input.value) })`);
  if (!reviewed.titles.includes('Module 1 deadline') || !reviewed.titles.includes('Do not import')) throw new Error(`Mocked public review candidates did not render: ${JSON.stringify(reviewed)}`);
  await evaluate(`(() => { const checkbox = document.querySelector('.import-review-row input[type="checkbox"]'); checkbox?.click(); const title = document.querySelector('.import-review-row input[aria-label="Imported title"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(title, 'Edited public deadline'); title.dispatchEvent(new Event('input', { bubbles: true })); title.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(80);
  await evaluate(`([...document.querySelectorAll('.import-confirm-bar button')].find(button => button.textContent.includes('Add selected')))?.click()`); await sleep(150);
  const imported = await evaluate(`JSON.parse(localStorage.getItem('my-plan-tasks:user-998') || '[]')`);
  if (imported.length !== 1 || imported[0]?.title !== 'Edited public deadline' || imported.some(task => task.title === 'Do not import')) throw new Error('Selected-only manual import did not preserve the edited candidate boundary');
  console.log(JSON.stringify({ passed: 4, results: ["review candidates rendered", "one candidate approved", "title edited", "selected-only private task write"] }, null, 2));
} finally {
  await evaluate(`const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); true`);
  await command("Fetch.disable"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
