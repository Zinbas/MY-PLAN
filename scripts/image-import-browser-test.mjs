const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map(); const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const user = { id: 997, openId: "image-import-test-user", email: "image-import@example.test", name: "Image importer", loginMethod: "test", role: "user", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", lastSignedIn: "2026-01-01T00:00:00.000Z" };
const candidates = [
  { id: "public-image-date", title: "First day of school", kind: "event", date: "2026-08-10", time: "", durationMinutes: 60, course: "Montgomery Public Schools", notes: "Public academic calendar image", weekdays: [], confidence: .96 },
  { id: "unselected-image-date", title: "Do not import image date", kind: "event", date: "2026-08-17", time: "", durationMinutes: 60, course: "Montgomery Public Schools", notes: "Unselected public image candidate", weekdays: [], confidence: .93 },
];
const bodyFor = value => Buffer.from(JSON.stringify([{ result: { data: { json: value } } }])).toString("base64");
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Fetch.requestPaused") { const url = message.params.request.url; const value = url.includes("/api/trpc/auth.me") ? user : url.includes("/api/trpc/schedule.extract") ? { file: { name: "montgomery-academic-calendar-2026-27.png", mimeType: "image/png", storageKey: "test-only" }, extractionMode: "vision", candidates } : null; if (value !== null) { ws.send(JSON.stringify({ id: nextId++, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: bodyFor(value) } })); return; } } if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }, { urlPattern: "*api/trpc/schedule.extract*" }] });
const keys = ["my-plan-tasks:user-997", "my-plan-events:user-997", "my-plan-blocks:user-997"];
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  await evaluate(`localStorage.setItem('my-plan-welcome-seen', 'true'); ${keys.map(key => `localStorage.removeItem(${JSON.stringify(key)})`).join(";")}; true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(1000);
  await evaluate(`(() => [...document.querySelectorAll('.side-nav button')].find(button => button.textContent.includes('Workspace tools'))?.click())()`); await sleep(100);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Import schedule'))?.click())()`); await sleep(750);
  if (!(await evaluate(`Boolean(document.querySelector('.import-file-input'))`))) throw new Error("Import workspace did not finish loading");
  await evaluate(`(() => { const input = document.querySelector('.import-file-input'); const data = new DataTransfer(); data.items.add(new File(['public image fixture'], 'montgomery-academic-calendar-2026-27.png', { type: 'image/png' })); Object.defineProperty(input, 'files', { value: data.files }); input.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(650);
  const reviewed = await evaluate(`({ titles: [...document.querySelectorAll('input[aria-label="Imported title"]')].map(input => input.value), times: [...document.querySelectorAll('input[aria-label="Imported time"]')].map(input => input.value) })`);
  if (!reviewed.titles.includes("First day of school") || !reviewed.titles.includes("Do not import image date") || reviewed.times[0] !== "time not found") throw new Error(`Image review candidates did not preserve the source state: ${JSON.stringify(reviewed)}`);
  await evaluate(`(() => { const row = document.querySelector('.import-review-row'); row.querySelector('input[type="checkbox"]')?.click(); const set = (selector, value) => { const input = row.querySelector(selector); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return input; }; set('input[aria-label="Imported title"]', 'Edited image first day'); set('input[aria-label="Imported date"]', '2026-08-12'); const time = row.querySelector('input[aria-label="Imported time"]'); time.focus(); set('input[aria-label="Imported time"]', '9:30 AM'); })()`); await sleep(80);
  await evaluate(`document.querySelector('.import-review-row input[aria-label="Imported time"]')?.blur()`); await sleep(80);
  await evaluate(`([...document.querySelectorAll('.import-confirm-bar button')].find(button => button.textContent.includes('Add selected')))?.click()`); await sleep(150);
  const imported = await evaluate(`JSON.parse(localStorage.getItem('my-plan-events:user-997') || '[]')`);
  if (imported.length !== 1 || imported[0]?.title !== "Edited image first day" || !String(imported[0]?.startAt).includes("2026-08-12") || !String(imported[0]?.startAt).includes("09:30") || imported.some(event => event.title === "Do not import image date")) throw new Error(`Selected image import did not preserve the edited title, date, optional time, and selected-only boundary: ${JSON.stringify(imported)}`);
  console.log(JSON.stringify({ passed: 5, results: ["image review candidates rendered", "absent source time remained reviewable", "image title/date/time edited", "selected-only private event written", "unselected candidate excluded"] }, null, 2));
} finally {
  await evaluate(`const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); true`);
  await command("Fetch.disable"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
