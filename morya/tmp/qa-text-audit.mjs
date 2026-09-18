import { mkdir, writeFile } from 'node:fs/promises';

const port = 9333;
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
const page = pages.find((p) => p.type === 'page' && p.url.includes('127.0.0.1:5173'));
if (!page) throw new Error('Morya page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (!msg.id || !pending.has(msg.id)) return;
  const waiter = pending.get(msg.id);
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitReady = async () => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`Boolean(window.__morya?.ui.ready)`)) return;
    await wait(100);
  }
  throw new Error('Engine did not become ready');
};

await send('Page.enable');
await send('Runtime.enable');
await mkdir('tmp/text-audit', { recursive: true });

const viewports = [
  ['360x800', 360, 800, false],
  ['390x844-browser', 390, 844, false],
  ['390x844-standalone', 390, 844, true],
  ['393x852', 393, 852, false],
  ['430x932', 430, 932, false],
  ['768x1024', 768, 1024, false],
  ['1280x800', 1280, 800, false],
  ['1440x900', 1440, 900, false],
  ['1536x960', 1536, 960, false],
];

const states = {
  threshold: `null`,
  rekha: `e.beginRekha(); e.setUI({whisper:'Let your finger wander across the paper.'})`,
  rang: `e.beginRang(); e.setUI({whisper:'Now, bring Him to colour.'})`,
  shringar: `e.beginShringar(); e.setUI({whisper:'Look for where the light catches.'})`,
  stroke: `e.beginStroke(); e.strokeSceneReady=true; e.setUI({strokePrompt:true})`,
  annuality: `living(); e.setUI({finalLine:2})`,
  memoryGuide: `living(); e.setUI({memoryGuide:true})`,
  letterPrompt: `living(); e.setUI({letterAvailable:true,letterPrompt:true})`,
  letter: `living(); e.setUI({letterAvailable:true}); e.openLetter()`,
  offer: `living(); e.setUI({epilogueReady:true})`,
  final: `living(); e.setUI({finalBlessing:true,finalFarewell:true})`,
  replay: `living(); e.blessingShown=true; e.setUI({replay:true})`,
};

const prep = `(async()=>{
  const e=window.__morya;
  document.querySelector('.threshold')?.remove();
  const style=document.createElement('style');
  style.textContent='*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important}';
  document.head.append(style);
  const living=()=>{
    e.beginLiving();
    e.camTo='living'; e.camDur=0; e.camFrom=null;
    e.sketch.fill(); e.color.fill(); e.back.fill(); e.front.fill(); e.woman.fill();
    e.values.set('living',1); e.values.set('thread',1); e.values.set('threadInk',1);
  };
  STATE;
  await new Promise(r=>setTimeout(r,80));
})()`;

const inspect = `(() => {
  const selectors = ['.threshold-title','.threshold-line','.whisper','.stroke-prompt','.final-line','.final-memory','.letter-prompt','.memory-guide','.epilogue-offer','.final-blessing p','.replay','.letter-words span','.memory-back','.memory-year-label','.memory-count','.memory-next','.memory-swipe-hint','.immersive-hint-title','.immersive-hint-step','.epilogue-controls button'];
  return selectors.flatMap(selector => [...document.querySelectorAll(selector)].map((el) => {
    const r=el.getBoundingClientRect(), s=getComputedStyle(el);
    const visible=r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0.01;
    return {selector,text:el.textContent.trim(),visible,x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1),font:s.fontSize,line:s.lineHeight,color:s.color,opacity:s.opacity,z:s.zIndex,overflow:[s.overflow,s.overflowX,s.overflowY],transform:s.transform};
  }));
})()`;

const results = [];
for (const [label, width, height, standalone] of viewports) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800, screenWidth: width, screenHeight: height });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: standalone ? 'standalone' : 'browser' }] });
  for (const [state, code] of Object.entries(states)) {
    await send('Page.navigate', { url: `http://127.0.0.1:5173/?qa=${label}-${state}` });
    await waitReady();
    if (code !== 'null') await evaluate(prep.replace('STATE', code));
    await wait(80);
    const elements = await evaluate(inspect);
    const paperTop = await evaluate(`getComputedStyle(document.querySelector('.stage')).getPropertyValue('--paper-top').trim()`);
    const offenders = elements.filter((x) => x.visible && (x.x < -0.5 || x.y < -0.5 || x.right > width + 0.5 || x.bottom > height + 0.5));
    results.push({ label, width, height, standalone, state, paperTop, offenders, elements });
    if (['390x844-browser','390x844-standalone','1280x800'].includes(label)) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(`tmp/text-audit/${label}-${state}.png`, Buffer.from(shot.data, 'base64'));
    }
  }
}

await writeFile('tmp/text-audit/results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ checks: results.length, offenders: results.filter((r) => r.offenders.length).map((r) => ({ viewport:r.label,state:r.state,offenders:r.offenders })) }, null, 2));
ws.close();
