const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map(); const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorBody = Buffer.from(JSON.stringify([{ error: { json: { message: "Test-only authentication service unavailable", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503, path: "auth.me" } } } }])).toString("base64");
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Fetch.requestPaused") { ws.send(JSON.stringify({ id: nextId++, method: "Fetch.fulfillRequest", params: { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: errorBody } })); return; } if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
await command("Fetch.enable", { patterns: [{ urlPattern: "*api/trpc/auth.me*" }] });
const previous = await evaluate(`Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).map(key => [key, localStorage.getItem(key)]))`);
try {
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); localStorage.setItem('my-plan-welcome-seen', 'true'); true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(900);
  const state = await evaluate(`({ text: document.body.innerText, hasRoot: Boolean(document.querySelector('#root > *')), hasSignInGuidance: document.body.innerText.includes('Sign in') })`);
  if (!state.hasRoot || !state.text.includes("MY PLAN") || !state.text.includes("Calendar") || !state.hasSignInGuidance) throw new Error(`MY PLAN rendered a blank or unreachable authentication failure state: ${JSON.stringify(state)}`);
  console.log(JSON.stringify({ passed: 3, results: ["auth failure intercepted", "MY PLAN shell remained rendered", "local sign-in guidance stayed visible"] }, null, 2));
} finally {
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); const previous = ${JSON.stringify(previous)}; Object.entries(previous).forEach(([key, value]) => localStorage.setItem(key, value)); true`);
  await command("Fetch.disable"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
