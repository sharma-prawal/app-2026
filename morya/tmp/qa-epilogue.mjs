import { writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = pages.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:5173'));
if (!page) throw new Error('Morya page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (!msg.id) return;
  const waiter = pending.get(msg.id);
  if (!waiter) return;
  pending.delete(msg.id);
  msg.error ? waiter.reject(msg.error) : waiter.resolve(msg.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id;
  pending.set(callId, { resolve, reject });
  ws.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const skipFilm = process.argv.includes('--skip');
const startMuted = process.argv.includes('--muted');
const shot = async (name) => {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`tmp/${name}.png`, Buffer.from(result.data, 'base64'));
};
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.reload', { ignoreCache: true });
await wait(2200);
const initialVideoRequests = await evaluate(`performance.getEntriesByType('resource').filter(e => e.name.includes('morya-blessing')).length`);

await evaluate(`(() => {
  const e = window.__morya;
  e.setMuted(${startMuted});
  e.setPhase('living'); e.beginLiving();
  const ids = ['diya','bell','lotus','modak','window'];
  e.memoriesSeen = new Set(ids); e.setUI({ seenMemories: ids }); e.offerLetter(); e.openLetter();
  return e.ui;
})()`);
await wait(500);
const prepared = await evaluate(`({ preload: document.querySelector('video').preload, requests: performance.getEntriesByType('resource').filter(e => e.name.includes('morya-blessing')).length })`);
await evaluate(`window.__morya.closeLetter()`);
await wait(2200);
await shot('qa-one-last-blessing-390');
const offer = await evaluate(`(() => { const b=document.querySelector('.epilogue-offer'); const r=b?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2,text:b.textContent}; })()`);
await click(offer.x, offer.y);
await wait(900);
await shot('qa-epilogue-playing-390');
const playing = await evaluate(`(() => { const v=document.querySelector('video'); return { paused:v.paused, muted:v.muted, readyState:v.readyState, layer:document.querySelector('.epilogue-layer').className, controls:document.querySelectorAll('.epilogue-controls button').length }; })()`);

if (skipFilm) {
  const close = await evaluate(`(() => { const b=document.querySelector('.epilogue-controls button'); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await click(close.x, close.y);
} else {
  await evaluate(`document.querySelector('video').currentTime = 31.75`);
}
await wait(2600);
await shot('qa-final-blessing-390');
const ending = await evaluate(`({ blessing: document.querySelector('.final-blessing').className, farewell: document.querySelector('.final-farewell').className, layer: document.querySelector('.epilogue-layer').className })`);
await wait(3000);
await shot('qa-final-farewell-390');
const farewell = await evaluate(`({ className: document.querySelector('.final-farewell').className, text: document.querySelector('.final-farewell').textContent, prompt: document.querySelector('.letter-prompt').className })`);

const fullscreenSupported = await evaluate(`document.fullscreenEnabled`);
const immersive = await evaluate(`(() => { const b=document.querySelector('.immersive'); const r=b?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
if (fullscreenSupported && immersive) {
  await click(immersive.x, immersive.y);
  await wait(400);
}
const fullscreenEntered = await evaluate(`document.fullscreenElement?.className || null`);
if (fullscreenEntered) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait(300);
}

await evaluate(`(() => {
  localStorage.removeItem('morya.immersiveHintDismissed');
  Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
  const e=window.__morya; e.setUI({ ready: !e.ui.ready });
})()`);
const fallbackButton = await evaluate(`(() => { const b=document.querySelector('.immersive'); const r=b?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
if (fallbackButton) await click(fallbackButton.x, fallbackButton.y);
await wait(150);
const fallbackHint = await evaluate(`document.querySelector('.immersive-hint')?.textContent.trim() || null`);
const dismiss = await evaluate(`(() => { const b=document.querySelector('.immersive-hint button'); const r=b?.getBoundingClientRect(); return r && {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
if (dismiss) await click(dismiss.x, dismiss.y);
if (fallbackButton) await click(fallbackButton.x, fallbackButton.y);
await wait(100);
const fallbackRemembered = await evaluate(`!document.querySelector('.immersive-hint') && localStorage.getItem('morya.immersiveHintDismissed') === '1'`);
await evaluate(`(() => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  const e=window.__morya; e.setUI({ ready: !e.ui.ready });
})()`);
await wait(100);
const standaloneSuppressed = await evaluate(`!document.querySelector('.immersive')`);

console.log(JSON.stringify({ initialVideoRequests, prepared, offer, playing, ending, farewell, fullscreenSupported, fullscreenEntered, fallbackHint, fallbackRemembered, standaloneSuppressed }, null, 2));
ws.close();
