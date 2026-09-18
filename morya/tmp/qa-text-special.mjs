import { mkdir, writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9333/json').then((r) => r.json());
const page = pages.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:5173'));
if (!page) throw new Error('Morya page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (!msg.id || !pending.has(msg.id)) return;
  const p = pending.get(msg.id); pending.delete(msg.id);
  msg.error ? p.reject(msg.error) : p.resolve(msg.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id; pending.set(callId, { resolve, reject });
  ws.send(JSON.stringify({ id: callId, method, params }));
});
const evalx = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expression, limit = 10000) => {
  const end = Date.now() + limit;
  while (Date.now() < end) { if (await evalx(expression)) return; await wait(100); }
  throw new Error(`Timed out: ${expression}`);
};
const reload = async (suffix = '') => {
  await send('Page.navigate', { url: `http://127.0.0.1:5173/?special=${suffix}` });
  await waitFor(`Boolean(window.__morya?.ui.ready)`);
  await evalx(`(() => {
    document.querySelector('.threshold')?.remove();
    const s=document.createElement('style'); s.textContent='*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important}'; document.head.append(s);
    const e=window.__morya; e.beginLiving(); e.camTo='living'; e.camDur=0; e.camFrom=null;
    e.sketch.fill(); e.color.fill(); e.back.fill(); e.front.fill(); e.woman.fill(); e.values.set('living',1);
  })()`);
};
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`tmp/text-audit/${name}.png`, Buffer.from(s.data, 'base64'));
};
const boxes = async (selectors) => evalx(`(() => (${JSON.stringify(selectors)}).flatMap(sel => [...document.querySelectorAll(sel)].map(el => { const r=el.getBoundingClientRect(),s=getComputedStyle(el); return {sel,text:el.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:s.fontSize,opacity:s.opacity,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'} })))()`);

await send('Page.enable'); await send('Runtime.enable');
await mkdir('tmp/text-audit', { recursive: true });
await send('Emulation.setDeviceMetricsOverride', { width:390,height:844,screenWidth:390,screenHeight:844,deviceScaleFactor:1,mobile:true });
const report = {};

await reload('memory-1');
await evalx(`window.__morya.openMemoryById('diya')`);
await waitFor(`Boolean(window.__morya.ui.memory)`);
await wait(4600);
await shot('390x844-memory-1');
report.memory1 = await boxes(['.memory-back','.memory-year-label','.memory-count','.memory-next','.memory-swipe-hint']);

await reload('memory-5');
await evalx(`(() => { const e=window.__morya,ids=['diya','bell','lotus','modak']; e.memoriesSeen=new Set(ids); e.setUI({seenMemories:ids}); e.openMemoryById('window'); })()`);
await waitFor(`Boolean(window.__morya.ui.memory)`);
await wait(4600);
await shot('390x844-memory-5');
report.memory5 = await boxes(['.memory-back','.memory-year-label','.memory-count','.memory-next']);

await reload('video');
await evalx(`window.__morya.setUI({epilogueReady:true})`);
await waitFor(`Boolean(document.querySelector('.epilogue-offer'))`);
const offerPoint = await evalx(`(() => { const r=document.querySelector('.epilogue-offer').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:offerPoint.x,y:offerPoint.y,button:'left',clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:offerPoint.x,y:offerPoint.y,button:'left',clickCount:1});
await waitFor(`document.querySelector('.epilogue-layer')?.classList.contains('is-playing')`);
await wait(250);
await shot('390x844-video-controls');
report.video = await boxes(['.epilogue-controls button']);
await evalx(`document.querySelector('.epilogue-controls button').click()`);

await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }, { name:'display-mode', value:'standalone' }] });
await reload('reduced-standalone');
await evalx(`window.__morya.setUI({finalBlessing:true,finalFarewell:true})`);
await wait(100);
await shot('390x844-reduced-standalone-final');
report.reducedStandalone = await boxes(['.final-blessing p','.immersive']);

await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'no-preference' }, { name:'display-mode', value:'browser' }] });
await reload('fullscreen');
report.fullscreenSupported = await evalx(`document.fullscreenEnabled`);
if (report.fullscreenSupported) {
  const fullPoint = await evalx(`(() => { const r=document.querySelector('.immersive').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:fullPoint.x,y:fullPoint.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:fullPoint.x,y:fullPoint.y,button:'left',clickCount:1});
  await wait(200);
  report.fullscreenEntered = await evalx(`Boolean(document.fullscreenElement)`);
  if (report.fullscreenEntered) await evalx(`document.exitFullscreen()`);
}

await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(document,'fullscreenEnabled',{get:()=>false}); localStorage.removeItem('morya.immersiveHintDismissed.v1');` });
await reload('immersive-hint');
await evalx(`document.querySelector('.immersive')?.click()`);
await wait(120);
await shot('390x844-immersive-hint');
report.immersiveHint = await boxes(['.immersive-hint-title','.immersive-hint-step','.immersive-hint button']);

await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(navigator,'standalone',{get:()=>true});` });
await reload('navigator-standalone');
await evalx(`window.__morya.setUI({finalBlessing:true,finalFarewell:true})`);
await wait(100);
await shot('390x844-navigator-standalone-final');
report.navigatorStandalone = {
  immersiveHidden: await evalx(`!document.querySelector('.immersive')`),
  final: await boxes(['.final-blessing p']),
};

await writeFile('tmp/text-audit/special-results.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
