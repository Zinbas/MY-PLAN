import { writeFile } from "node:fs/promises";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tabs = await fetch("http://127.0.0.1:9222/json").then(response => response.json());
const page = tabs.find(tab => tab.type === "page");
if (!page) throw new Error("No browser page is available for the mobile audit.");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 1;
const waiting = new Map();
ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Evaluation failed");
  return result.result.value;
};
const clickText = text => evaluate(`(() => { const target = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)} || button.textContent.includes(${JSON.stringify(text)})); if (!target) throw new Error('Button not found: ' + ${JSON.stringify(text)}); target.click(); return true; })()`);
const capture = async name => {
  const image = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = `/home/ubuntu/mobile-audit-${name}.png`;
  await writeFile(path, Buffer.from(image.data, "base64"));
  return path;
};

await command("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
await command("Page.navigate", { url: "http://127.0.0.1:3000/" });
await sleep(900);
const output = [];
output.push(await capture("calendar"));
for (const [label, name] of [["To-do", "todo"], ["Progress", "progress"]]) {
  await clickText(label);
  await sleep(150);
  output.push(await capture(name));
}
for (const [label, name] of [["Account center", "accounts"], ["Sync center", "sync"], ["Import schedule", "import"], ["Gemini Spark", "spark"]]) {
  await clickText("Workspace tools");
  await sleep(120);
  await clickText(label);
  await sleep(150);
  output.push(await capture(name));
}
await clickText("Calendar");
await sleep(120);
await clickText("Add task");
await sleep(120);
output.push(await capture("composer"));
await evaluate(`document.querySelector('.composer .close')?.click(); true`);
await sleep(100);
await evaluate(`(() => { const day = document.querySelector('.month-cell.today') || document.querySelector('.month-cell:not(.blank)'); if (!day) throw new Error('Calendar day missing'); day.click(); day.click(); return true; })()`);
await sleep(140);
output.push(await capture("double-tap-sheet"));
await evaluate(`document.querySelector('.mobile-date-sheet-backdrop')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); true`);
await command("Network.clearBrowserCookies");
await evaluate(`localStorage.removeItem('my-plan-welcome-seen'); localStorage.removeItem('my-plan-welcome-retired'); localStorage.removeItem('my-plan-tour-complete'); location.reload(); true`);
await sleep(800);
if (await evaluate(`document.body.innerText.includes('Welcome to') && document.body.innerText.includes('Take the 60-sec tour')`)) {
  output.push(await capture("welcome"));
  await clickText("Take the 60-sec tour");
  await sleep(120);
  output.push(await capture("tutorial"));
}
console.log(JSON.stringify({ output }, null, 2));
ws.close();
