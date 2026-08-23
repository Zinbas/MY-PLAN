const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map(); const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const user = { id: 996, openId: "explicit-image-import-test-user", email: "explicit-image-import@example.test", name: "Explicit image importer", loginMethod: "test", role: "user", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", lastSignedIn: "2026-01-01T00:00:00.000Z" };
const candidates = [
  { id: "gate-fn", title: "GATE 2026 — Forenoon session: AG, ES, GG, IN, MA, MN, TF, XE, XL", kind: "event", date: "2026-02-07", time: "09:30", durationMinutes: 180, course: "GATE 2026", notes: "Public IIT Guwahati timetable image", weekdays: [], confidence: .99 },
  { id: "gate-unselected", title: "Do not import GATE afternoon session", kind: "event", date: "2026-02-07", time: "14:30", durationMinutes: 180, course: "GATE 2026", notes: "Unselected public image candidate", weekdays: [], confidence: .99 },
];
const bodyFor = value => Buffer.from(JSON.stringify([{ result: { data: { json: value } } }])).toString("base64");
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Fetch.requestPaused") { const url = message.params.request.url; const value = url.includes("/api/trpc/auth.me") ? user : url.includes("/api/trpc/schedule.extract") ? { file: { name: "gate-2026-examination-schedule.jpeg", mimeType: "image/jpeg", storageKey: "test-only" }, extractionMode: "vision", candidates } : null; if (value !== null) { ws.send(JSON.stringify({ id: nextId++, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: bodyFor(value) } })); return; } } if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }, { urlPattern: "*api/trpc/schedule.extract*" }] });
const keys = ["my-plan-tasks:user-996", "my-plan-events:user-996", "my-plan-blocks:user-996"];
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  await evaluate(`localStorage.setItem('my-plan-welcome-seen', 'true'); ${keys.map(key => `localStorage.removeItem(${JSON.stringify(key)})`).join(";")}; true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(1000);
  await evaluate(`(() => [...document.querySelectorAll('.side-nav button')].find(button => button.textContent.includes('Workspace tools'))?.click())()`); await sleep(100);
  await evaluate(`(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Import schedule'))?.click())()`); await sleep(750);
  await evaluate(`(() => { const input = document.querySelector('.import-file-input'); const data = new DataTransfer(); data.items.add(new File(['public GATE image fixture'], 'gate-2026-examination-schedule.jpeg', { type: 'image/jpeg' })); Object.defineProperty(input, 'files', { value: data.files }); input.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(650);
  const review = await evaluate(`({ titles: [...document.querySelectorAll('input[aria-label="Imported title"]')].map(input => input.value), dates: [...document.querySelectorAll('input[aria-label="Imported date"]')].map(input => input.value), times: [...document.querySelectorAll('input[aria-label="Imported time"]')].map(input => input.value) })`);
  if (!review.titles.includes(candidates[0].title) || !review.dates.includes("2026-02-07") || !review.times.includes("9:30 AM")) throw new Error(`Public explicit image candidate did not render its visible date/time: ${JSON.stringify(review)}`);
  await evaluate(`document.querySelector('.import-review-row input[type="checkbox"]')?.click()`); await sleep(50);
  await evaluate(`([...document.querySelectorAll('.import-confirm-bar button')].find(button => button.textContent.includes('Add selected')))?.click()`); await sleep(150);
  const imported = await evaluate(`JSON.parse(localStorage.getItem('my-plan-events:user-996') || '[]')`);
  if (imported.length !== 1 || imported[0]?.title !== candidates[0].title || !String(imported[0]?.startAt).includes("2026-02-07T09:30") || !String(imported[0]?.endAt).includes("2026-02-07T12:30") || imported.some(event => event.title === candidates[1].title)) throw new Error(`Explicit image selected import did not preserve source date/time and selected-only scope: ${JSON.stringify(imported)}`);
  console.log(JSON.stringify({ passed: 5, results: ["explicit image review rendered", "source date retained", "source time retained", "selected event written with 180-minute duration", "unselected image event excluded"] }, null, 2));
} finally {
  await evaluate(`const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); true`);
  await command("Fetch.disable"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
