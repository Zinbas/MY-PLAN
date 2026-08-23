const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map(); const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
const allKeys = await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-'))`);
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(allKeys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); localStorage.setItem('my-plan-welcome-seen', 'true'); true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(900);
  await evaluate(`document.querySelector('.mobile-menu')?.click()`); await sleep(80);
  const openedTools = await evaluate(`(() => { const button = [...document.querySelectorAll('.side-nav button')].find(button => button.textContent.includes('Workspace tools')); button?.click(); return Boolean(button); })()`);
  if (!openedTools) throw new Error("Mobile navigation did not expose the Workspace tools destination");
  await sleep(160);
  const initial = await evaluate(`({ primary: [...document.querySelectorAll('.tools-primary button')].map(button => button.textContent.trim()), moreOpen: document.querySelector('.tools-more')?.open, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth })`);
  if (!initial.primary.some(text => text.includes('Import a schedule')) || !initial.primary.some(text => text.includes('Account & calendar')) || initial.moreOpen || initial.scrollWidth > initial.viewportWidth + 1) throw new Error(`Workspace tools did not render as a compact primary-first surface: ${JSON.stringify(initial)}`);
  await evaluate(`document.querySelector('.tools-more summary')?.click()`); await sleep(80);
  const expanded = await evaluate(`({ open: document.querySelector('.tools-more')?.open, hasSync: [...document.querySelectorAll('.tools-more button')].some(button => button.textContent.includes('Sync center')) })`);
  if (!expanded.open || !expanded.hasSync) throw new Error(`Workspace tools secondary utilities did not progressively disclose: ${JSON.stringify(expanded)}`);
  await evaluate(`([...document.querySelectorAll('.tools-primary button')].find(button => button.textContent.includes('Account & calendar')))?.click()`); await sleep(80);
  if (!(await evaluate(`document.body.innerText.includes('Account & connections')`))) throw new Error("Primary Workspace tools action did not open Account & connections");
  console.log(JSON.stringify({ passed: 5, results: ["compact mobile shell rendered", "two primary tools remain prominent", "secondary tools start collapsed", "secondary tools expand on demand", "primary tool navigation works"] }, null, 2));
} finally {
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => localStorage.setItem(key, value)); true`);
  await command("Emulation.clearDeviceMetricsOverride"); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
