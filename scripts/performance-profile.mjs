const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No headless browser page is available");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1; const waiting = new Map(); const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.id && waiting.has(message.id)) { const { resolve, reject } = waiting.get(message.id); waiting.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed"); return result.result.value; };
const keys = await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-'))`);
const previous = await evaluate(`Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, localStorage.getItem(key)]))`);
try {
  await command("Network.enable"); await command("Network.setCacheDisabled", { cacheDisabled: true });
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); localStorage.setItem('my-plan-welcome-seen', 'true'); true`);
  await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); await sleep(1200);
  const load = await evaluate(`(() => { const nav = performance.getEntriesByType('navigation')[0]; const resources = performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'script' || entry.initiatorType === 'link').map(entry => ({ name: entry.name.split('/').pop(), bytes: entry.transferSize || 0 })).sort((a, b) => b.bytes - a.bytes); return { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadEventMs: Math.round(nav.loadEventEnd), totalTransferBytes: resources.reduce((sum, entry) => sum + entry.bytes, 0), resources: resources.slice(0, 10) }; })()`);
  const interaction = await evaluate(`new Promise(resolve => { const next = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label')?.includes('Next month')); if (!next) throw new Error('Next month control not found'); const label = document.querySelector('.cursor-controls h2')?.textContent || ''; const start = performance.now(); next.click(); requestAnimationFrame(() => requestAnimationFrame(() => resolve({ elapsedMs: Math.round(performance.now() - start), changed: (document.querySelector('.cursor-controls h2')?.textContent || '') !== label }))); })`);
  console.log(JSON.stringify({ load, interaction }, null, 2));
} finally {
  await evaluate(`Object.keys(localStorage).filter(key => key.startsWith('my-plan-')).forEach(key => localStorage.removeItem(key)); const old = ${JSON.stringify(previous)}; Object.entries(old).forEach(([key, value]) => localStorage.setItem(key, value)); true`);
  await command("Network.setCacheDisabled", { cacheDisabled: false }); await command("Page.navigate", { url: "http://127.0.0.1:3000/" }); ws.close();
}
