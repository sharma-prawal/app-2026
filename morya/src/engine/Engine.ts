// The living painting: one canvas, one clock, one continuous sequence of movements.
import { formMap } from '../art/forms';
import { EYES, FLAMES, FRAMES, FRONT_BOX, GANESH_BOX, ART, INCENSE, MEMORIES, PAPER_TOP, SEAT_BASE, STROKE_ZONE, THALI, THREAD_BOUNDS, TRUNK, WOMAN_BOX, type FrameName, type MemoryDef } from '../art/layout';
import { P } from '../art/palette';
import type { Box } from '../art/render';
import { buildScene, liftBells, settleBells, type BellSprite, type Layer, type OrnamentLayer, type Scene } from '../art/scene';
import { Sound } from './audio';
import { drawFlame, drawGlint, drawMotes, drawSmoke, makeMotes, stepMotes, type Mote } from './effects';
import { clamp, easeInOut, easeOut, lerp, noise2, rng, sample, smooth } from './geom';
import { RevealMask } from './reveal';
import { anchorStroke, drawRibbon, loadStroke, saveStroke, smoothStroke, strokeLength, type StrokePoint } from './stroke';
import { bloomStamps, bristleStamps, ctx2d, grainTile, makeCanvas, paperTile, rimStamps, type Canvas } from './textures';

export type Phase = 'threshold' | 'rekha' | 'rang' | 'shringar' | 'stroke' | 'reveal' | 'living';

export interface MemoryButton {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
}

export interface LetterButton {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UIState {
  phase: Phase;
  ready: boolean;
  whisper: string | null;
  strokePrompt: boolean;
  finalLine: 0 | 1 | 2;
  replay: boolean;
  memory: string | null;
  memoryRect: { x: number; y: number; w: number; h: number } | null;
  seenMemories: string[];
  memoryGuide: boolean;
  audio: boolean;
  muted: boolean;
  veiled: boolean;
  memoryButtons: MemoryButton[];
  letterAvailable: boolean;
  letterPrompt: boolean;
  letterOpen: boolean;
  epilogueReady: boolean;
  finalBlessing: boolean;
  finalFarewell: boolean;
  letterButton: LetterButton | null;
}

type Cam = { cx: number; cy: number; s: number; sx: number; sy: number };
type Tween = { from: number; to: number; t0: number; dur: number; ease: (t: number) => number };
type Insets = { top: number; right: number; bottom: number; left: number };

interface OrnamentState {
  t0: number;
  x: number;
  y: number;
  mask?: RevealMask;
  bells?: BellSprite[];
}

interface OpenMemory {
  def: MemoryDef;
  t0: number;
  closing: number | null;
  nextId?: string | null;
  rect: { x: number; y: number; w: number; h: number };
  /** where the object sits on screen, for the first wet bloom */
  origin: { x: number; y: number };
  photo: Canvas;
  mask: RevealMask;
  edge: Canvas;
}

const WHISPER = {
  rekha: 'Let your finger wander across the paper.',
  rang: 'Now, bring Him to colour.',
  shringar: 'Look for where the light catches.',
};

const ORNAMENT_ORDER = ['tilak', 'bell', 'crown', 'seat', 'jewels', 'halo'];

// Painting should be completed by exploring the figure, rather than by distance
// travelled. Both masks report unique artwork-bearing grid coverage.
const REKHA_ASSIST_COVERAGE = 0.85;
const RANG_ASSIST_COVERAGE = 0.85;
const REKHA_PROGRESS_RADIUS_PX = 17;
const RANG_PROGRESS_RADIUS_PX = 22;
const STROKE_PROMPT_SETTLE_MS = 500;

/** Gives a canvas's pixels back immediately; Safari otherwise counts them until collection. */
function release(...canvases: Canvas[]) {
  for (const c of canvases) {
    c.width = 0;
    c.height = 0;
  }
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private work: Canvas;
  private wg: CanvasRenderingContext2D;
  private onUI: (ui: UIState) => void;
  ui: UIState;
  readonly sound = new Sound();

  private dpr = 1;
  private vw = 1;
  private vh = 1;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private reduced = false;

  private scene: Scene | null = null;
  private rs = 1;
  private sketch!: RevealMask;
  private color!: RevealMask;
  private back!: RevealMask;
  private front!: RevealMask;
  private woman!: RevealMask;
  private forms!: Canvas;
  private bristles: Canvas[] = bristleStamps();
  private blooms: Canvas[] = bloomStamps();
  private rims: Canvas[] = rimStamps(this.blooms);
  private paperPattern: CanvasPattern | null = null;

  private raf = 0;
  private lastTs = 0;
  private now = 0;
  private lastDraw = 0;
  private running = false;
  private tweens = new Map<string, Tween>();
  private values = new Map<string, number>();
  private timers: { at: number; fn: () => void }[] = [];

  private phase: Phase = 'threshold';
  private camFrom: Cam | null = null;
  private camTo: FrameName = 'ganesh';
  private camT0 = 0;
  private camDur = 0;

  // pointer
  private pointerId: number | null = null;
  private activePointers = new Set<number>();
  private last: { x: number; y: number; t: number; ax: number; ay: number } | null = null;
  private downAt: { x: number; y: number; t: number } | null = null;
  private moved = 0;
  private strokeCarry = 0;
  private painted = 0;
  private lastCoverage = 0;
  private interactedAt = 0;
  /** The movement a touch began in. A touch only ever acts in the movement it began in. */
  private downPhase: Phase | null = null;
  /** A handoff waiting for her finger to lift, then for a moment of stillness. */
  private pendingLift: { ms: number; fn: () => void; since: number | null } | null = null;
  private strokeSceneReady = false;
  private strokeInputArmed = false;
  private strokePromptAt = -1;

  // movements
  private eyesDone = false;
  private completing = false;
  private ornaments = new Map<string, OrnamentState>();
  private lastDiscovery = 0;
  /** When he is fully adorned, all his gold catches the light once, together. */
  private shineAt = -1e9;
  private orientationAsked = false;
  private capture: StrokePoint[] = [];
  private captured = false;
  private placed: StrokePoint[] | null = null;
  private saved: StrokePoint[] | null = loadStroke();
  private motes: Mote[] = makeMotes(6);
  private dust: { x: number; y: number; vx: number; vy: number; t0: number }[] = [];
  private holdCandidate = false;
  private holding = false;
  private hold = 0;
  private livingSince = 0;
  private finalDone = false;
  private annualityComplete = false;
  private memoriesSeen = new Set<string>();
  private letterReadyAt = 0;
  private blessingShown = false;
  private epiloguePending = false;
  /** The note has been placed: from here the only way to begin again is after the final blessing. */
  private endingStarted = false;
  /** The quiet "paint it again" offered while she lingers in the painting, before the ending. */
  private idleReplay: { at: number; fn: () => void } | null = null;
  /** "Every year, you bring him home." has been said. */
  private annualitySaid = false;
  private memory: OpenMemory | null = null;
  private images = new Map<string, Promise<HTMLImageElement | null>>();
  private tilt = { x: 0, y: 0 };
  private tiltTarget = { x: 0, y: 0 };
  private tiltBase: { b: number; g: number } | null = null;
  private hasSensor = false;

  constructor(canvas: HTMLCanvasElement, onUI: (ui: UIState) => void) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.work = makeCanvas(1, 1);
    this.wg = ctx2d(this.work);
    this.onUI = onUI;
    this.ui = {
      phase: 'threshold', ready: false, whisper: null, strokePrompt: false, finalLine: 0, replay: false,
      memory: null, memoryRect: null, seenMemories: [], memoryGuide: false,
      audio: false, muted: this.sound.muted, veiled: false, memoryButtons: [],
      letterAvailable: false, letterPrompt: false, letterOpen: false, epilogueReady: false,
      finalBlessing: false, finalFarewell: false, letterButton: null,
    };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = mq.matches;
    mq.addEventListener?.('change', this.onReducedMotion);
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  async start() {
    this.resize();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.attachInput();
    const scene = await buildScene(this.rs);
    if (!this.running) return;
    this.scene = scene;
    this.sketch = new RevealMask(GANESH_BOX, 0.55);
    this.color = new RevealMask(GANESH_BOX, 0.45, true);
    this.back = new RevealMask(ART, 0.22);
    this.front = new RevealMask(FRONT_BOX, 0.35);
    this.woman = new RevealMask(WOMAN_BOX, 0.4);
    // Rekha is judged by the forms that make him recognisable, not by every ornament
    this.forms = formMap(GANESH_BOX, 0.55);
    this.sketch.setKeys(this.forms);
    this.color.setKeys(scene.ganeshColor.canvas);
    // the invocation is only fetched once the painting itself has arrived
    this.sound.prefetchInvocation(`${import.meta.env.BASE_URL}audio/invocation.m4a`);
    this.sound.prepareInvocation();
    this.setUI({ ready: true });
    this.invalidate();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener?.('change', this.onReducedMotion);
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.detachInput();
    this.sound.reset();
    void this.sound.ctx?.close();
  }

  private onReducedMotion = (e: MediaQueryListEvent) => {
    this.reduced = e.matches;
    this.invalidate();
  };

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.sound.suspend();
      this.releasePointer();
      this.activePointers.clear();
    } else if (this.running) {
      this.sound.resume();
      this.lastTs = performance.now();
      if (!this.raf) this.raf = requestAnimationFrame(this.frame);
      this.invalidate();
    }
  };

  setInsets(i: Insets) {
    this.insets = i;
    this.resize();
  }

  /**
   * The ending copy is set on the bare paper beneath the living painting, wherever this screen puts it:
   * the stage carries that line (CSS px from its top) as `--paper-top` for the stylesheet.
   */
  private publishPaperTop() {
    const y = this.toScreen(0, PAPER_TOP, this.frame_('living')).y;
    this.canvas.parentElement?.style.setProperty('--paper-top', `${Math.round(y)}px`);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.vw = Math.max(1, rect.width);
    this.vh = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(this.vw * this.dpr), H = Math.round(this.vh * this.dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    if (this.work.width !== W || this.work.height !== H) {
      this.work.width = W;
      this.work.height = H;
    }
    if (!this.scene) {
      // resolution for the layers: enough for the closest framing in either orientation
      const a = this.frame_('ganesh', this.vw, this.vh).s;
      const b = this.frame_('ganesh', this.vh, this.vw).s;
      this.rs = clamp(Math.max(a, b) * this.dpr, 0.7, 1.6);
    }
    this.emitButtons();
    this.publishPaperTop();
    // a memory is laid out for the screen it opened on; let it sink back if the screen changes
    if (this.memory && this.memory.closing === null && Math.abs(this.memory.rect.x * 2 + this.memory.rect.w - this.vw) > 2) this.closeMemory();
    this.invalidate();
  }

  private invalidate() {
    this.lastDraw = -1;
  }

  // ───────────────────────────── UI bridge ─────────────────────────────

  private setUI(p: Partial<UIState>) {
    let changed = false;
    for (const k of Object.keys(p) as (keyof UIState)[]) {
      if (this.ui[k] !== p[k]) changed = true;
    }
    if (!changed) return;
    this.ui = { ...this.ui, ...p };
    this.onUI(this.ui);
  }

  setMuted(m: boolean) {
    this.sound.setMuted(m);
    this.setUI({ muted: m });
  }

  // ───────────────────────────── clock ─────────────────────────────

  private after(ms: number, fn: () => void) {
    const timer = { at: this.now + ms, fn };
    this.timers.push(timer);
    return timer;
  }

  /**
   * A handoff between movements: nothing happens while her finger is still on the glass;
   * once it lifts, the painting is left alone for `ms`, and a fresh touch during that pause starts the wait again.
   */
  private afterLift(ms: number, fn: () => void) {
    this.pendingLift = { ms, fn, since: null };
  }

  private stepLift() {
    const w = this.pendingLift;
    if (!w) return;
    if (this.pointerId !== null) {
      w.since = null;
      return;
    }
    w.since ??= this.now;
    if (this.now - w.since >= w.ms) {
      this.pendingLift = null;
      w.fn();
    }
  }

  private tween(name: string, to: number, dur: number, ease = easeInOut) {
    const from = this.val(name);
    if (dur <= 0) {
      this.tweens.delete(name);
      this.values.set(name, to);
      return;
    }
    this.tweens.set(name, { from, to, t0: this.now, dur, ease });
  }

  private val(name: string, fallback = 0) {
    return this.values.get(name) ?? fallback;
  }

  private frame = (ts: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = clamp(ts - this.lastTs, 0, 50);
    this.lastTs = ts;
    this.now += dt;

    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.now);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.now);
        for (const t of due) t.fn();
      }
    }
    let animating = false;
    for (const [name, tw] of this.tweens) {
      const p = clamp((this.now - tw.t0) / tw.dur);
      this.values.set(name, lerp(tw.from, tw.to, tw.ease(p)));
      if (p >= 1) this.tweens.delete(name);
      else animating = true;
    }
    if (!this.scene) {
      if (this.lastDraw < 0) this.drawPaperOnly();
      return;
    }
    this.stepLift();
    animating = this.update(dt) || animating;

    // Painting interactions redraw at full rate; the settled painting breathes at ~30fps.
    const continuous = this.phase === 'shringar' || this.phase === 'reveal' || this.phase === 'living' || this.phase === 'stroke';
    const interval = this.phase === 'living' && !animating && this.pointerId === null && !this.memory ? 33 : 0;
    if (this.lastDraw < 0 || animating || this.pointerId !== null || (continuous && this.now - this.lastDraw >= interval)) {
      this.draw();
      this.lastDraw = this.now;
    }
  };

  // ───────────────────────────── camera ─────────────────────────────

  private frame_(name: FrameName, vw = this.vw, vh = this.vh): Cam {
    const f = FRAMES[name];
    const i = this.insets;
    // on short (landscape) screens the words need less room than the painting does
    const k = clamp((vh - 360) / 400, 0.35, 1);
    const top = f.top * k, bottom = f.bottom * k, pad = f.pad * k;
    const availW = Math.max(40, vw - i.left - i.right - pad * 2);
    const availH = Math.max(40, vh - i.top - i.bottom - top - bottom - pad * 2);
    const s = Math.min(availW / f.box.w, availH / f.box.h);
    return {
      cx: f.box.x + f.box.w / 2,
      cy: f.box.y + f.box.h / 2,
      s,
      sx: i.left + pad + availW / 2,
      sy: i.top + top + pad + availH / 2,
    };
  }

  private moveCamera(to: FrameName, dur: number) {
    if (this.reduced) {
      // a soft dissolve instead of a zoom
      dur = 0;
      this.values.set('dissolve', 1);
      this.tween('dissolve', 0, 900);
    }
    this.camFrom = dur > 0 ? this.cam() : null;
    this.camTo = to;
    this.camT0 = this.now;
    this.camDur = dur;
  }

  private cam(): Cam {
    const cam = this.travel();
    // holding the finished painting, the view leans in as the colour drains toward the drawing
    const lean = this.phase === 'living' && !this.reduced ? easeInOut((this.hold - 0.35) / 0.6) : 0;
    return lean > 0 ? Engine.blend(cam, this.frame_('hold'), lean) : cam;
  }

  private travel(): Cam {
    const to = this.frame_(this.camTo);
    if (this.camDur <= 0) return to;
    const p = clamp((this.now - this.camT0) / this.camDur);
    if (p >= 1) return to;
    return Engine.blend(this.camFrom ?? to, to, easeInOut(p));
  }

  private static blend(from: Cam, to: Cam, e: number): Cam {
    return {
      cx: lerp(from.cx, to.cx, e),
      cy: lerp(from.cy, to.cy, e),
      s: Math.exp(lerp(Math.log(from.s), Math.log(to.s), e)),
      sx: lerp(from.sx, to.sx, e),
      sy: lerp(from.sy, to.sy, e),
    };
  }

  private camMoving() {
    return this.camDur > 0 && this.now - this.camT0 < this.camDur;
  }

  private toArt(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const c = this.cam();
    return { x: (clientX - r.left - c.sx) / c.s + c.cx, y: (clientY - r.top - c.sy) / c.s + c.cy };
  }

  private toScreen(x: number, y: number, c = this.cam()) {
    return { x: (x - c.cx) * c.s + c.sx, y: (y - c.cy) * c.s + c.sy };
  }

  private setCam(g: CanvasRenderingContext2D, c: Cam, ox = 0, oy = 0) {
    const d = this.dpr;
    g.setTransform(d * c.s, 0, 0, d * c.s, d * (c.sx - c.cx * c.s + ox), d * (c.sy - c.cy * c.s + oy));
  }

  // ───────────────────────────── input ─────────────────────────────

  private attachInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('lostpointercapture', this.onLostPointerCapture);
    c.addEventListener('contextmenu', this.prevent);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    this.observer = new ResizeObserver(this.onResize);
    this.observer.observe(c);
  }
  private observer: ResizeObserver | null = null;

  private detachInput() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    c.removeEventListener('contextmenu', this.prevent);
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
  }

  private prevent = (e: Event) => e.preventDefault();
  private onResize = () => this.resize();

  private onDown = (e: PointerEvent) => {
    if (!this.scene || this.ui.veiled) return;
    if (e.button > 0) return;
    this.activePointers.add(e.pointerId);
    if (this.pointerId !== null || this.activePointers.size > 1) return;
    const a = this.toArt(e.clientX, e.clientY);
    if (this.phase === 'stroke' && (!this.strokeSceneReady || !this.strokeInputArmed || !this.inStrokeArea(a.x, a.y))) return;
    this.pointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.last = { x: e.clientX, y: e.clientY, t: e.timeStamp, ax: a.x, ay: a.y };
    this.downAt = { x: e.clientX, y: e.clientY, t: this.now };
    this.moved = 0;
    this.interactedAt = this.now;
    this.downPhase = this.phase;
    this.sound.resume();

    switch (this.phase) {
      case 'rekha':
      case 'rang':
        // once a movement is complete the brush rests until the next one has begun
        if (this.completing) break;
        if (this.ui.whisper) this.setUI({ whisper: null });
        this.paintAt(a.x, a.y, 0, 0, true);
        break;
      case 'shringar':
        this.discoverAt(a.x, a.y);
        break;
      case 'stroke':
        if (!this.captured) {
          this.capture = [{ x: a.x, y: a.y, w: this.widthFrom(0, e.pressure) }];
        }
        break;
      case 'living':
        if (!this.memory) {
          this.holdCandidate = true;
        }
        break;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.last) return;
    const events = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e];
    for (const ev of events) this.moveTo(ev);
  };

  private moveTo(e: PointerEvent) {
    const last = this.last!;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const dtm = Math.max(1, e.timeStamp - last.t);
    const speed = dist / dtm; // CSS px per ms
    this.moved += dist;
    const a = this.toArt(e.clientX, e.clientY);
    this.interactedAt = this.now;
    this.last = { x: e.clientX, y: e.clientY, t: e.timeStamp, ax: a.x, ay: a.y };
    // a finger that carries on from the previous movement does nothing in the new one
    if (this.downPhase !== this.phase) return;

    switch (this.phase) {
      case 'rekha':
      case 'rang':
        if (this.completing) {
          this.sound.brushLevel(0, this.phase === 'rang');
          break;
        }
        this.strokeSegment(last.ax, last.ay, a.x, a.y, speed);
        this.sound.brushLevel(clamp(speed * 1.2), this.phase === 'rang');
        break;
      case 'shringar':
        this.discoverAt(a.x, a.y);
        break;
      case 'stroke':
        if (!this.captured && this.capture.length) {
          this.capture.push({ x: a.x, y: a.y, w: this.widthFrom(speed, e.pressure) });
          this.sound.brushLevel(clamp(speed), false);
        }
        break;
      case 'living':
        if (this.holdCandidate && !this.holding && this.moved > 14) this.holdCandidate = false;
        break;
    }
  }

  private onUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (e.pointerId !== this.pointerId) {
      this.tryArmStroke();
      return;
    }
    const tap = this.moved < 14 && this.downAt !== null && this.now - this.downAt.t < 420 && this.downPhase === this.phase;
    const a = this.toArt(e.clientX, e.clientY);
    this.finishPointer();

    if (this.phase === 'shringar') this.askOrientation();
    if (this.phase === 'living') {
      if (this.holding) {
        this.holding = false;
      } else if (tap && this.holdCandidate && !this.memory) {
        const hit = this.memoryAt(a.x, a.y);
        if (hit) this.openMemory(hit, e.clientX, e.clientY);
      }
      this.holdCandidate = false;
    }
    if (this.phase === 'shringar' && tap && !this.completing && !this.discoverAt(a.x, a.y)) this.sprinkle(a.x, a.y);
    this.tryArmStroke();
  };

  private onCancel = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (e.pointerId !== this.pointerId) {
      this.tryArmStroke();
      return;
    }
    if (this.phase === 'stroke' && !this.captured) {
      this.capture = [];
      this.sound.brushLevel(0, false);
      this.releasePointer();
    } else this.finishPointer();
    this.holding = false;
    this.holdCandidate = false;
    this.tryArmStroke();
  };

  private onLostPointerCapture = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (e.pointerId === this.pointerId) {
      if (this.phase === 'stroke' && !this.captured) this.capture = [];
      this.sound.brushLevel(0, this.phase === 'rang');
      this.pointerId = null;
      this.last = null;
      this.downAt = null;
      this.downPhase = null;
    }
    this.tryArmStroke();
  };

  private finishPointer() {
    this.sound.brushLevel(0, this.phase === 'rang');
    if (this.phase === 'stroke' && !this.captured && this.capture.length) this.endStroke();
    this.releasePointer();
  }

  private releasePointer() {
    if (this.pointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.pointerId);
      } catch {
        /* ignore */
      }
    }
    this.pointerId = null;
    this.last = null;
    this.downAt = null;
    this.downPhase = null;
    if (this.phase === 'rekha' || this.phase === 'rang') this.checkProgress();
  }

  private widthFrom(speed: number, pressure: number) {
    const fromSpeed = clamp(1 - speed / 2.4);
    const p = pressure > 0 && pressure !== 0.5 ? pressure : 0.5;
    return clamp(fromSpeed * 0.7 + p * 0.6, 0.15, 1);
  }

  private inStrokeArea(x: number, y: number) {
    const z = FRAMES.stroke.box;
    return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }

  private tryArmStroke() {
    if (
      this.phase === 'stroke'
      && this.strokeSceneReady
      && !this.strokeInputArmed
      && !this.captured
      && this.strokePromptAt >= 0
      && this.now - this.strokePromptAt >= (this.reduced ? 120 : STROKE_PROMPT_SETTLE_MS)
      && this.pointerId === null
      && this.activePointers.size === 0
    ) this.strokeInputArmed = true;
  }

  /** Keyboard equivalent of the gesture each movement asks for. */
  key(e: KeyboardEvent) {
    if (!this.scene) return false;
    if (e.key === 'Escape' && this.ui.letterOpen) {
      this.closeLetter();
      return true;
    }
    if (e.key === 'Escape' && this.memory) {
      this.closeMemory();
      return true;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return false;
    this.interactedAt = this.now;
    switch (this.phase) {
      case 'rekha':
      case 'rang':
        if (!this.completing) this.complete();
        return true;
      case 'shringar': {
        const next = ORNAMENT_ORDER.find((id) => !this.ornaments.has(id));
        const layer = this.scene.ornaments.find((o) => o.def.id === next);
        if (layer) this.discover(layer, layer.def.anchor.x, layer.def.anchor.y);
        return true;
      }
      case 'stroke':
        if (!this.captured) {
          const z = STROKE_ZONE;
          this.capture = sample(`M ${z.x} ${z.y + z.h * 0.7} C ${z.x + z.w * 0.3} ${z.y - 20} ${z.x + z.w * 0.6} ${z.y + z.h + 20} ${z.x + z.w} ${z.y + z.h * 0.2}`, 6)[0].pts.map((p, i, arr) => ({
            x: p.x, y: p.y, w: 0.5 + 0.4 * Math.sin((i / arr.length) * Math.PI),
          }));
          this.endStroke();
        }
        return true;
      case 'living':
        if (this.ui.letterOpen) this.closeLetter();
        else if (this.memory) this.closeMemory();
        return true;
    }
    return false;
  }

  // ───────────────────────────── movements ─────────────────────────────

  private setPhase(p: Phase) {
    this.phase = p;
    this.setUI({ phase: p });
    this.invalidate();
  }

  /** Threshold: the diya is touched. Called inside the gesture handler. */
  private lighting = false;

  lightDiya() {
    if (this.phase !== 'threshold' || this.lighting || this.ui.veiled) return;
    this.lighting = true;
    this.sound.unlock();
    this.setUI({ audio: this.sound.ready });
    this.sound.ignite();
    this.sound.prepareInvocation();
    this.after(420, () => this.sound.bell({ pitch: 494, gain: 0.12, decay: 5 }));
    this.after(1400, () => this.sound.startAmbience());
    this.after(1900, () => this.beginRekha());
  }

  private beginRekha() {
    if (!this.scene) {
      // artwork still preparing on a slow device: wait quietly on the paper
      this.after(250, () => this.beginRekha());
      return;
    }
    this.lighting = false;
    this.setPhase('rekha');
    this.camTo = 'ganesh';
    this.camDur = 0;
    this.values.set('ink', 0);
    this.tween('ink', 1, 1600);
    // the first faint pencil mark: the curl of the trunk
    const trunk = sample(TRUNK, 6)[0].pts;
    const r = rng(4);
    trunk.slice(-Math.floor(trunk.length * 0.45)).forEach((p, i, arr) => {
      const t = i / arr.length;
      this.sketch.stamp(this.bristles[i % this.bristles.length], p.x + (r() - 0.5) * 6, p.y + (r() - 0.5) * 6, 16 + 10 * Math.sin(t * Math.PI), r() * 6.28, 0.35);
    });
    this.after(3800, () => {
      if (this.phase === 'rekha' && this.painted === 0) this.setUI({ whisper: WHISPER.rekha });
    });
  }

  private beginRang() {
    this.setPhase('rang');
    this.completing = false;
    this.painted = 0;
    this.strokeCarry = 0;
    this.lastCoverage = 0;
    // one low bell marks the change; the words follow it
    this.sound.bell({ pitch: 330, gain: 0.06, decay: 6 });
    this.after(900, () => {
      if (this.phase === 'rang' && this.painted === 0) this.setUI({ whisper: WHISPER.rang });
    });
    this.after(9000, () => {
      if (this.phase === 'rang' && this.painted === 0) this.setUI({ whisper: WHISPER.rang });
    });
  }

  private beginShringar() {
    this.setPhase('shringar');
    this.sound.stopBrush();
    // if the lamp was lit before the invocation had arrived, decode it now, long before the reveal
    this.sound.prepareInvocation();
    this.completing = false;
    this.lastDiscovery = this.now;
    this.tween('cues', 1, 2400);
    this.after(2600, () => {
      if (this.phase === 'shringar' && this.ornaments.size === 0) this.setUI({ whisper: WHISPER.shringar });
    });
    this.scheduleShringarNudge();
  }

  private scheduleShringarNudge() {
    this.after(3000, () => {
      if (this.phase !== 'shringar') return;
      const idle = this.now - Math.max(this.lastDiscovery, this.interactedAt);
      if (this.ornaments.size >= 3 && idle > 9000) this.revealRemaining();
      else if (this.ornaments.size === 0 && idle > 16000) {
        this.setUI({ whisper: WHISPER.shringar });
        this.tween('cues', 1.8, 1500);
      } else if (idle > 30000) this.revealRemaining();
      if (this.phase === 'shringar') this.scheduleShringarNudge();
    });
  }

  private revealRemaining() {
    if (!this.scene || this.completing) return;
    this.completing = true;
    const rest = ORNAMENT_ORDER.map((id) => this.scene!.ornaments.find((o) => o.def.id === id)!).filter((o) => !this.ornaments.has(o.def.id));
    rest.forEach((o, i) => this.after(i * 900, () => this.discover(o, o.def.anchor.x, o.def.anchor.y)));
  }

  private beginStroke() {
    // A gesture from the previous movement can never become the personal stroke.
    if (this.pointerId !== null) {
      this.sound.brushLevel(0, false);
      this.releasePointer();
    }
    this.setPhase('stroke');
    this.setUI({ whisper: null });
    this.captured = false;
    this.capture = [];
    this.strokeSceneReady = false;
    this.strokeInputArmed = false;
    this.strokePromptAt = -1;
    this.moveCamera('stroke', 700);
    this.tween('veil', 0.92, 2000);
    this.tween('cues', 0, 1200);
  }

  private endStroke() {
    const c = this.cam();
    const pts = this.capture;
    if (strokeLength(pts) * c.s < 14) {
      // a tap is not a stroke; wait for a real one
      this.capture = [];
      return;
    }
    this.captured = true;
    const smoothed = smoothStroke(pts);
    this.capture = smoothed;
    this.saved = smoothed;
    saveStroke(smoothed);
    this.sound.stopBrush();
    this.values.set('strokeInk', 1);
    this.after(900, () => this.setUI({ strokePrompt: false }));
    this.after(2600, () => this.tween('strokeInk', 0, 1600));
    this.after(3400, () => this.beginReveal());
  }

  private beginReveal() {
    this.setPhase('reveal');
    // her line, only scaled and moved: it begins at her thali and reaches toward his seat
    this.placed = this.saved ? anchorStroke(this.saved, THALI, SEAT_BASE, STROKE_ZONE, THREAD_BOUNDS) : null;
    this.tween('veil', 0, 1800);
    this.moveCamera('ganesh', 2800);
    const r = rng(21);

    // He is here: as her offering returns him to view, the room becomes devotional.
    // A short sung invocation rises out of silence, very low, and the light around him warms a little.
    this.after(600, () => void this.sound.playInvocation());
    this.tween('presence', 1, 3200);
    this.after(9000, () => this.tween('presence', 0, 7000));

    // 0–4.8 s: he is simply there, and seems complete.
    // Then the niche and its architecture emerge outward from him, before the view moves at all.
    this.after(4800, () => {
      this.sound.bell({ pitch: 440, gain: 0.07, decay: 6 });
      for (let gy = 0; gy < 13; gy++) {
        for (let gx = 0; gx < 8; gx++) {
          const x = (gx + 0.5) * 125 + (r() - 0.5) * 60, y = (gy + 0.5) * 131 + (r() - 0.5) * 60;
          if (y > 1180) continue;
          const d = Math.hypot(x - 507, y - 640);
          this.back.addDrop({ x, y, r0: 40, r1: 118 + r() * 40, t0: this.now + 200 + d * 3.4, dur: 1900, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 1 });
        }
      }
    });
    // the view begins to open, slowly
    this.after(6400, () => this.moveCamera('full', this.reduced ? 0 : 9400));
    this.after(9000, () => this.tween('living', 1, 5000));
    // floor and offerings, from the lamp outward
    this.after(9400, () => {
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 8; gx++) {
          const x = (gx + 0.5) * 125 + (r() - 0.5) * 60, y = 1180 + (gy + 0.5) * 104 + (r() - 0.5) * 40;
          const d = Math.hypot(x - 880, y - 1400);
          this.back.addDrop({ x, y, r0: 36, r1: 110 + r() * 40, t0: this.now + d * 3.2, dur: 1900, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 1 });
        }
      }
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 9; gx++) {
          const x = FRONT_BOX.x + (gx + 0.5) * (FRONT_BOX.w / 9) + (r() - 0.5) * 40;
          const y = FRONT_BOX.y + (gy + 0.5) * (FRONT_BOX.h / 5) + (r() - 0.5) * 40;
          const d = Math.hypot(x - 760, y - 1520);
          this.front.addDrop({ x, y, r0: 30, r1: 84 + r() * 30, t0: this.now + 700 + d * 3.4, dur: 1900, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 1 });
        }
      }
    });
    // last of all, her: from the offering in her hands
    this.after(12800, () => {
      for (let gy = 0; gy < 6; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          const x = WOMAN_BOX.x + (gx + 0.5) * (WOMAN_BOX.w / 5) + (r() - 0.5) * 30;
          const y = WOMAN_BOX.y + (gy + 0.5) * (WOMAN_BOX.h / 6) + (r() - 0.5) * 30;
          const d = Math.hypot(x - THALI.x, y - THALI.y);
          this.woman.addDrop({ x, y, r0: 26, r1: 78 + r() * 24, t0: this.now + d * 4.6, dur: 2200, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 1 });
        }
      }
    });
    // a breath, then her own line appears where she offers, and turns to gold toward him
    this.after(17600, () => {
      this.back.fill();
      this.front.fill();
      this.woman.fill();
      this.values.set('threadInk', 0);
      this.tween('threadInk', 1, this.reduced ? 300 : 1200);
    });
    this.after(18800, () => {
      this.values.set('thread', 0);
      this.tween('thread', 1, this.reduced ? 800 : 3800, easeInOut);
      this.sound.chime(3);
    });
    this.after(24000, () => this.beginLiving());
  }

  private beginLiving() {
    this.setPhase('living');
    this.moveCamera('living', this.reduced ? 0 : 2800);
    this.livingSince = this.now;
    this.interactedAt = this.now;
    this.finalDone = false;
    this.annualityComplete = false;
    this.letterReadyAt = this.now + 90000;
    this.values.set('memCues', 0);
    this.emitButtons();
    this.images.clear();
    // warm the decoded memories quietly in the background
    for (const m of MEMORIES) void this.loadMemory(m.id);
  }

  // ───────────────────────────── painting ─────────────────────────────

  private brushRadius(speed: number) {
    // CSS px, turned into artboard units by the current zoom
    const px = this.phase === 'rekha'
      ? lerp(30, 18, clamp(speed / 2.2))
      : lerp(40, 26, clamp(speed / 2.2));
    return px / this.cam().s;
  }

  private strokeSegment(x0: number, y0: number, x1: number, y1: number, speed: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    this.painted += d;
    // Fixed CSS-pixel path sampling makes the same gesture independent of raw/coalesced event density.
    const spacing = (this.phase === 'rekha' ? 8 : 14) / this.cam().s;
    let travelled = spacing - this.strokeCarry;
    while (travelled <= d) {
      const t = travelled / (d || 1);
      this.paintAt(lerp(x0, x1, t), lerp(y0, y1, t), speed, Math.atan2(y1 - y0, x1 - x0), false);
      travelled += spacing;
    }
    this.strokeCarry = (this.strokeCarry + d) % spacing;
    if (this.now - this.lastCoverage > 320) this.checkProgress();
  }

  private paintAt(x: number, y: number, speed: number, angle: number, first: boolean) {
    const R = this.brushRadius(speed);
    const r = Math.random;
    if (this.phase === 'rekha') {
      this.sketch.markCoverage(x, y, REKHA_PROGRESS_RADIUS_PX / this.cam().s);
      // dry brush: faster strokes are thinner and more broken
      const dryness = clamp(speed / 2.5);
      const alpha = lerp(0.24, 0.1, dryness) * (first ? 1.3 : 1);
      this.sketch.stamp(this.bristles[Math.floor(r() * this.bristles.length)], x + (r() - 0.5) * R * 0.2, y + (r() - 0.5) * R * 0.2, R * (0.85 + r() * 0.3), angle + (r() - 0.5) * 0.3, alpha);
      // near a defining form (trunk, eyes, ears, crown, hands, seat) the form itself comes forward, whole and firm
      this.sketch.stampClipped(this.blooms[Math.floor(r() * this.blooms.length)], x, y, R * lerp(1.35, 1.15, dryness), r() * 6.28, lerp(0.3, 0.18, dryness), this.forms);
    } else if (this.phase === 'rang') {
      this.color.markCoverage(x, y, RANG_PROGRESS_RADIUS_PX / this.cam().s);
      const lingering = 1 - clamp(speed / 2);
      const r1 = R * (0.95 + r() * 0.22 + lingering * 0.18);
      this.color.addDrop({ x: x + (r() - 0.5) * R * 0.3, y: y + (r() - 0.5) * R * 0.3, r0: r1 * 0.45, r1, t0: this.now, dur: 800 + r() * 500, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 0.8 });
      if (r() < 0.28) {
        // pigment feathering beyond the brush
        const a = r() * Math.PI * 2;
        this.color.addDrop({ x: x + Math.cos(a) * R * 0.9, y: y + Math.sin(a) * R * 0.9, r0: R * 0.15, r1: R * (0.4 + r() * 0.25), t0: this.now + 150 + r() * 350, dur: 900 + r() * 500, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 0.75 });
      }
      if (this.color.drops.length > 160) this.color.drops[0].t0 = -1e9;
    }
    this.invalidate();
  }

  private checkProgress() {
    if (this.completing || !this.scene) return;
    this.lastCoverage = this.now;
    if (this.phase === 'rekha') {
      if (!this.eyesDone && EYES.every((e) => this.sketch.coverageAt(e.x, e.y, e.r) > 0.42)) this.eyesMoment();
      const cov = this.sketch.progress();
      if (cov >= REKHA_ASSIST_COVERAGE) this.complete();
    } else if (this.phase === 'rang') {
      const cov = this.color.progress();
      if (cov >= RANG_ASSIST_COVERAGE) this.complete();
    }
  }

  private eyesMoment() {
    this.eyesDone = true;
    this.tween('lift', 1, 3200, easeOut);
    this.sound.bell({ pitch: 392, gain: 0.05, decay: 4 });
  }

  /** Quietly finishes what her touch has almost completed. */
  private complete() {
    if (this.completing) return;
    this.completing = true;
    this.sound.brushLevel(0, this.phase === 'rang');
    this.setUI({ whisper: null });
    if (this.phase === 'rekha') {
      if (!this.eyesDone) this.after(1200, () => this.eyesMoment());
      // what remains (jewellery, textile, garland) settles in by itself; the brush no longer answers
      this.values.set('inkFill', 0);
      this.tween('inkFill', 1, 800, easeInOut);
      this.after(850, () => {
        this.sketch.fill();
        this.values.set('inkFill', 0);
        // the drawing is left to exist by itself, and colour waits for a new touch
        this.afterLift(1000, () => this.beginRang());
      });
    } else if (this.phase === 'rang') {
      const { missing } = this.color.coverage();
      const r = rng(9);
      const last = this.last ?? { ax: 500, ay: 700 };
      missing.sort((a, b) => Math.hypot(a.x - last.ax, a.y - last.ay) - Math.hypot(b.x - last.ax, b.y - last.ay));
      const cell = GANESH_BOX.w / this.color.gw;
      missing.forEach((m, i) => {
        this.color.addDrop({ x: m.x + (r() - 0.5) * cell, y: m.y + (r() - 0.5) * cell, r0: cell * 0.55, r1: cell * (1.25 + r() * 0.4), t0: this.now + (i / Math.max(1, missing.length)) * 360, dur: 460, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 0.9 });
      });
      this.after(850, () => {
        this.color.fill();
        this.afterLift(900, () => this.beginShringar());
      });
    }
  }

  // ───────────────────────────── shringar ─────────────────────────────

  private ornamentAt(x: number, y: number): OrnamentLayer | null {
    if (!this.scene) return null;
    const minR = 26 / this.cam().s;
    for (const id of ORNAMENT_ORDER) {
      const o = this.scene.ornaments.find((l) => l.def.id === id)!;
      for (const h of o.def.hits) {
        const d = Math.hypot(x - h.x, y - h.y);
        if (d <= Math.max(h.r, minR) && (!h.inner || d >= h.inner)) return o;
      }
    }
    return null;
  }

  private discoverAt(x: number, y: number) {
    const o = this.ornamentAt(x, y);
    if (!o || this.ornaments.has(o.def.id)) return !!o;
    this.discover(o, x, y);
    return true;
  }

  private discover(o: OrnamentLayer, x: number, y: number) {
    if (this.ornaments.has(o.def.id) || this.phase !== 'shringar' || !this.scene) return;
    const st: OrnamentState = { t0: this.now, x, y };
    if (o.def.mode === 'leaf' || o.def.mode === 'bloom') {
      // gold leaf laid from the touch outward, a little at a time
      const box = o.def.box;
      const m = new RevealMask(box, 0.5);
      const r = rng(o.def.id.length * 7);
      const size = Math.max(box.w, box.h);
      const n = o.def.mode === 'bloom' ? 10 : 26;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const dist = (i / n) * size * (o.def.mode === 'bloom' ? 0.5 : 0.75);
        const px = clamp(x + Math.cos(a) * dist, box.x, box.x + box.w);
        const py = clamp(y + Math.sin(a) * dist, box.y, box.y + box.h);
        const rad = o.def.mode === 'bloom' ? 34 + r() * 14 : size * (0.2 + r() * 0.1);
        m.addDrop({ x: px, y: py, r0: rad * 0.25, r1: rad, t0: this.now + dist * (o.def.mode === 'bloom' ? 6 : 3), dur: o.def.mode === 'bloom' ? 1300 : 1000, k: Math.floor(r() * 6), rot: r() * 6.28, alpha: 1 });
      }
      st.mask = m;
      this.after(o.def.mode === 'bloom' ? 2600 : 3800, () => m.fill());
    }
    if (o.def.mode === 'swing') {
      st.bells = liftBells(this.scene, x < 507 ? 'left' : 'right');
      this.settled = null;
      this.after(7000, () => this.settleSwing(st));
    }
    this.ornaments.set(o.def.id, st);
    this.lastDiscovery = this.now;
    if (this.ui.whisper) this.setUI({ whisper: null });
    if (o.def.mode === 'swing') this.sound.bell({ pitch: 587, gain: 0.1, decay: 4 });
    else this.sound.chime(this.ornaments.size);
    if (this.ornaments.size === ORNAMENT_ORDER.length) {
      // He is fully adorned. Nothing more is asked for a moment: the cues and words leave,
      // and all of his gold catches the light once, together.
      this.completing = true;
      this.tween('cues', 0, 900);
      this.setUI({ whisper: null });
      this.after(250, () => {
        if (this.phase !== 'shringar') return;
        this.shineAt = this.now;
        this.sound.bell({ pitch: 294, gain: 0.07, decay: 8 });
        this.afterLift(450, () => {
          if (this.phase === 'shringar') this.beginStroke();
        });
      });
    }
  }

  private settleSwing(st: OrnamentState) {
    if (!st.bells || !this.scene) return;
    settleBells(this.scene, st.bells);
    st.bells = undefined;
    this.settled = null;
    this.invalidate();
  }

  private sprinkle(x: number, y: number) {
    if (this.reduced) return;
    const r = Math.random;
    for (let i = 0; i < 6; i++) {
      this.dust.push({ x, y, vx: (r() - 0.5) * 0.05, vy: -0.02 - r() * 0.04, t0: this.now });
    }
  }

  private askOrientation() {
    if (this.orientationAsked) return;
    this.orientationAsked = true;
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!DOE) return;
    const listen = () => window.addEventListener('deviceorientation', this.onOrientation);
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((s) => {
          if (s === 'granted') listen();
        })
        .catch(() => {
          /* declined: the painting keeps its own slow light */
        });
    } else listen();
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    if (!this.tiltBase) this.tiltBase = { b: e.beta, g: e.gamma };
    this.hasSensor = true;
    // slowly re-centre so a change of posture never leaves the light stuck
    this.tiltBase.b += (e.beta - this.tiltBase.b) * 0.002;
    this.tiltBase.g += (e.gamma - this.tiltBase.g) * 0.002;
    this.tiltTarget = { x: clamp((e.gamma - this.tiltBase.g) / 25, -1, 1), y: clamp((e.beta - this.tiltBase.b) / 25, -1, 1) };
  };

  // ───────────────────────────── memories ─────────────────────────────

  private memoryAt(x: number, y: number): MemoryDef | null {
    const minR = 30 / this.cam().s;
    let best: MemoryDef | null = null;
    let bestD = Infinity;
    for (const m of MEMORIES) {
      const d = Math.hypot(x - m.hit.x, y - m.hit.y);
      if (d <= Math.max(m.hit.r, minR) && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  private loadMemory(id: string): Promise<HTMLImageElement | null> {
    let p = this.images.get(id);
    if (!p) {
      const w = this.vw * this.dpr > 760 ? 1200 : 720;
      p = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = `${import.meta.env.BASE_URL}memories/${id}-${w}.webp`;
        // Safari can reject decode() for an image that has in fact loaded; trust the load itself
        const loaded = () => (img.complete && img.naturalWidth > 0 ? img : null);
        img.decode().then(
          () => resolve(img),
          () => {
            if (img.complete) return resolve(loaded());
            img.onload = () => resolve(loaded());
            img.onerror = () => resolve(null);
          },
        );
        // never let a stalled request hold the memories closed
        window.setTimeout(() => resolve(loaded()), 12000);
      }).then((img) => {
        // a photograph that could not be read now may be readable on the next touch
        if (!img) this.images.delete(id);
        return img;
      });
      this.images.set(id, p);
    }
    return p;
  }

  openMemoryById(id: string) {
    const def = MEMORIES.find((m) => m.id === id);
    if (!def || this.phase !== 'living') return;
    if (this.memory) {
      this.closeMemory();
      return;
    }
    const s = this.toScreen(def.hit.x, def.hit.y);
    const r = this.canvas.getBoundingClientRect();
    this.openMemory(def, s.x + r.left, s.y + r.top);
  }

  private opening = false;

  private async openMemory(def: MemoryDef, clientX: number, clientY: number) {
    if (this.opening || this.memory) return;
    this.opening = true;
    this.interactedAt = this.now;
    const token = this.resetToken;
    const img = await this.loadMemory(def.id);
    this.opening = false;
    if (token !== this.resetToken || this.phase !== 'living' || this.memory) return;
    if (!img) {
      // the photograph is not available on this device: a glint, and the painting stays.
      // It still counts as visited, so a missing file can never keep the note from her.
      this.sprinkle(def.hit.x, def.hit.y);
      this.memoriesSeen.add(def.id);
      this.setUI({ seenMemories: [...this.memoriesSeen] });
      return;
    }

    const i = this.insets;
    const availH = this.vh - i.top - i.bottom;
    // a large focal region: the photograph is what matters for these moments
    // on short, wide screens the year above and "Next memory" below must still fit
    const w = Math.round(Math.min(this.vw * 0.98, 620, availH * 0.78, Math.max(160, (availH - 230) / 1.25)));
    const h = Math.round(w * 1.25);
    const rect = { x: Math.round((this.vw - w) / 2), y: Math.round(i.top + (availH - h) / 2), w, h };
    const d = this.dpr;

    // Shape of the opening: a soft rounded field whose perimeter alone breaks into paper and fibre.
    const gw = 96, gh = Math.round((gw * h) / w);
    const seed = def.id.length * 7.3;
    const field = (fn: (r: number) => number, rgb: [number, number, number]) => {
      const c = makeCanvas(gw, gh);
      const cg = ctx2d(c);
      const img = cg.createImageData(gw, gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const u = ((x + 0.5) / gw) * 2 - 1, v = ((y + 0.5) / gh) * 2 - 1;
        const r0 = Math.pow(Math.pow(Math.abs(u), 4.5) + Math.pow(Math.abs(v), 4.5), 1 / 4.5);
        const n = noise2(u * 3.1 + seed, v * 3.1, 5) * 0.65 + noise2(u * 11, v * 11 + seed, 9) * 0.35;
        const k = (y * gw + x) * 4;
        img.data[k] = rgb[0];
        img.data[k + 1] = rgb[1];
        img.data[k + 2] = rgb[2];
        img.data[k + 3] = 255 * clamp(fn(r0 + (n - 0.5) * 0.16));
      }
      cg.putImageData(img, 0, 0);
      const hi = makeCanvas(w * d, h * d);
      const hg = ctx2d(hi);
      hg.imageSmoothingQuality = 'high';
      hg.drawImage(c, 0, 0, hi.width, hi.height);
      return hi;
    };
    const shape = field((r) => 1 - smooth((r - 0.78) / 0.22), [0, 0, 0]);
    // fibres and tooth break up only the perimeter band
    const fibres = field((r) => smooth((r - 0.7) / 0.24), [0, 0, 0]);
    const fg = ctx2d(fibres);
    fg.globalCompositeOperation = 'source-in';
    fg.fillStyle = fg.createPattern(grainTile(), 'repeat')!;
    fg.fillRect(0, 0, fibres.width, fibres.height);
    fg.fillRect(0, 0, fibres.width, fibres.height);
    fg.globalCompositeOperation = 'source-over';
    const sg = ctx2d(shape);
    sg.globalCompositeOperation = 'destination-out';
    sg.drawImage(fibres, 0, 0);

    // The photograph itself: untouched in the centre; only its outermost band warms and quiets toward the paper.
    const photo = makeCanvas(w * d, h * d);
    const pg = ctx2d(photo);
    pg.drawImage(img, 0, 0, photo.width, photo.height);
    const band = field((r) => smooth((r - 0.66) / 0.3), [220, 202, 176]);
    pg.globalCompositeOperation = 'saturation';
    pg.globalAlpha = 0.85;
    pg.drawImage(band, 0, 0);
    pg.globalCompositeOperation = 'multiply';
    pg.globalAlpha = 0.5;
    pg.drawImage(band, 0, 0);
    pg.globalCompositeOperation = 'source-over';
    pg.globalAlpha = 1;
    const edge = shape;
    // Safari holds canvas memory until collection; give the scratch sheets back now
    release(fibres, band);

    const mask = new RevealMask({ x: 0, y: 0, w, h }, 0.35);
    const r = this.canvas.getBoundingClientRect();
    const origin = { x: clientX - r.left, y: clientY - r.top };
    const ox = clamp(origin.x - rect.x, w * 0.2, w * 0.8);
    const oy = clamp(origin.y - rect.y, h * 0.2, h * 0.8);
    const rnd = rng(def.id.length * 13);
    const n = 40;
    const delay = this.reduced ? 0 : 600;
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const dist = Math.sqrt(k / n) * Math.hypot(w, h) * 0.6;
      const x = clamp(ox + Math.cos(a) * dist, w * 0.12, w * 0.88);
      const y = clamp(oy + Math.sin(a) * dist, h * 0.12, h * 0.88);
      mask.addDrop({ x, y, r0: w * 0.08, r1: w * (0.3 + rnd() * 0.06), t0: this.now + delay + (this.reduced ? 0 : dist * 3.2), dur: this.reduced ? 200 : 1600, k: Math.floor(rnd() * 6), rot: rnd() * 6.28, alpha: 1 });
    }
    // once the pigment has parted, the photograph stands whole
    this.after(this.reduced ? 400 : 4200, () => {
      if (this.memory?.mask === mask && this.memory.closing === null) mask.fill();
    });
    this.memory = { def, t0: this.now, closing: null, rect, origin, photo, mask, edge };
    this.memoriesSeen.add(def.id);
    this.tween('memCues', 0, 1200);
    this.tween('memVeil', 1, 1800);
    // a photograph is met in quiet: the invocation, if it is still sounding, is set down
    this.sound.releaseInvocation(1.6);
    this.sound.hush(true);
    this.setUI({ memory: def.id, memoryRect: rect, seenMemories: [...this.memoriesSeen], memoryGuide: false });
  }

  closeMemory(nextId: string | null = null) {
    const m = this.memory;
    if (!m) return;
    if (m.closing !== null) {
      if (!nextId && m.nextId) {
        m.nextId = null;
        this.setUI({ memoryRect: null });
      }
      return;
    }
    m.closing = this.now;
    m.nextId = nextId;
    const dur = this.reduced ? 200 : 1300;
    this.tween('memVeil', 0, dur);
    this.sound.hush(false);
    this.interactedAt = this.now;
    // leaving memories altogether: the words and buttons go at once, the photograph sinks back
    if (!nextId) this.setUI({ memoryRect: null });
    const done = () => {
      if (this.memory !== m) return;
      this.memory = null;
      release(m.photo, m.edge);
      this.setUI({ memory: null, memoryRect: null });
      if (m.nextId) this.openMemoryById(m.nextId);
    };
    this.after(dur, done);
    // the painting's clock pauses with the screen; the way back must not
    window.setTimeout(done, dur + 900);
  }

  /**
   * Forward always goes to a memory she has not yet seen, so five forward steps are five memories.
   * Back returns through the ones she has seen, in the order she saw them.
   */
  navigateMemory(step: number): boolean {
    if (!this.memory || this.memory.closing !== null) return false;
    const minSettle = this.reduced ? 150 : 600;
    if (this.now - this.memory.t0 < minSettle) return false;
    const id = this.memory.def.id;
    let next: string | undefined;
    if (step > 0) {
      const i = MEMORIES.findIndex((m) => m.id === id);
      for (let k = 1; k <= MEMORIES.length && !next; k++) {
        const c = MEMORIES[(i + k) % MEMORIES.length].id;
        if (!this.memoriesSeen.has(c)) next = c;
      }
      if (!next) {
        if (this.memoriesSeen.size === MEMORIES.length) return this.finishMemories();
        next = MEMORIES[(i + 1) % MEMORIES.length].id;
      }
    } else {
      const order = [...this.memoriesSeen];
      if (order.length < 2) return false;
      const j = order.indexOf(id);
      next = order[(j - 1 + order.length) % order.length];
    }
    this.closeMemory(next);
    return true;
  }

  /** "And one more thing.": back to the painting, where the note is already waiting. */
  finishMemories(): boolean {
    if (this.memoriesSeen.size < MEMORIES.length) return false;
    if (!this.memory || this.memory.closing !== null) return false;
    const minSettle = this.reduced ? 150 : 600;
    if (this.now - this.memory.t0 < minSettle) return false;
    this.closeMemory();
    this.offerLetter();
    return true;
  }

  /** The note is placed by the offerings now, not after another pause. */
  private offerLetter() {
    if (this.ui.letterAvailable || this.blessingShown) return;
    this.enterEnding();
    this.finalDone = true;
    this.annualityComplete = true;
    this.tween('memCues', 0, 1200);
    const unsaid = !this.annualitySaid;
    this.annualitySaid = true;
    this.setUI({ letterAvailable: true, letterPrompt: false, memoryGuide: false, finalLine: unsaid ? 1 : 0 });
    // if she found the memories before the words came, the one line that matters is said now, once
    if (unsaid) this.after(5200, () => this.setUI({ finalLine: 0 }));
    this.after(1400, () => this.sound.bell({ pitch: 587, gain: 0.04, decay: 3 }));
    // only if the note goes unnoticed does anything point to it
    this.after(unsaid ? 9000 : 7000, () => {
      if (this.ui.letterAvailable && !this.ui.letterOpen && !this.memory) {
        this.setUI({ letterPrompt: true });
        this.after(6500, () => this.setUI({ letterPrompt: false }));
      }
    });
  }

  private enterEnding() {
    this.endingStarted = true;
    if (this.idleReplay) {
      const timer = this.idleReplay;
      this.timers = this.timers.filter((t) => t !== timer);
      this.idleReplay = null;
    }
    if (this.ui.replay) this.setUI({ replay: false });
  }

  private emitButtons() {
    if (this.phase !== 'living') {
      if (this.ui.memoryButtons.length || this.ui.letterButton) this.setUI({ memoryButtons: [], letterButton: null });
      return;
    }
    const c = this.frame_('living');
    const note = this.toScreen(744, 1448, c);
    this.setUI({
      memoryButtons: MEMORIES.map((m) => {
        const p = this.toScreen(m.hit.x, m.hit.y, c);
        return { id: m.id, label: m.label, x: p.x, y: p.y, r: Math.max(22, m.hit.r * c.s) };
      }),
      letterButton: { x: note.x, y: note.y, w: 58, h: 44 },
    });
  }

  openLetter() {
    if (this.phase !== 'living' || !this.ui.letterAvailable || this.memory || this.ui.letterOpen) return;
    this.interactedAt = this.now;
    this.enterEnding();
    this.sound.releaseInvocation(1.2);
    this.sound.hush(true);
    this.setUI({ letterOpen: true, letterPrompt: false, finalLine: 0, finalBlessing: false, veiled: true });
  }

  closeLetter() {
    if (!this.ui.letterOpen) return;
    this.interactedAt = this.now;
    this.enterEnding();
    this.sound.hush(false);
    this.setUI({ letterOpen: false, letterAvailable: false, veiled: false });
    if (!this.blessingShown) {
      this.epiloguePending = true;
      // The painting is allowed to breathe before the optional film is offered.
      this.after(1900, () => {
        if (!this.blessingShown) this.setUI({ epilogueReady: true });
      });
    }
  }

  /** Called synchronously from the explicit epilogue gesture. */
  beginEpilogue() {
    if (!this.ui.epilogueReady || this.blessingShown) return;
    this.setUI({ epilogueReady: false });
    // The film carries its own quiet room; do not layer the painted ambience over it.
    this.sound.stopAmbience(0.45);
  }

  /** The same ending follows a completed, skipped, or unavailable film. */
  completeEpilogue() {
    if (this.blessingShown) return;
    this.blessingShown = true;
    this.epiloguePending = false;
    this.setUI({ epilogueReady: false });
    this.sound.startAmbience();
    this.after(1700, () => this.setUI({ finalBlessing: true }));
    this.after(4400, () => this.setUI({ finalFarewell: true }));
    // only after both blessings have rested does the quiet way to begin again appear
    this.after(9400, () => this.setUI({ finalBlessing: false, finalFarewell: false, replay: true }));
  }

  // ───────────────────────────── replay ─────────────────────────────

  private resetToken = 0;

  replay() {
    if (this.ui.veiled) return;
    this.setUI({ veiled: true, replay: false });
    this.tween('fade', 1, 900);
    this.sound.stopAmbience(1);
    this.after(1000, () => {
      this.resetAll();
      this.tween('fade', 0, 1100);
      this.after(1100, () => this.setUI({ veiled: false }));
    });
  }

  private resetAll() {
    this.resetToken++;
    this.timers = [];
    const fade = this.val('fade');
    this.tweens.clear();
    this.values.clear();
    this.values.set('fade', fade);
    this.sound.reset();
    this.sketch.clear();
    this.color.clear();
    this.settled = null;
    this.back.clear();
    this.front.clear();
    this.woman.clear();
    for (const st of this.ornaments.values()) this.settleSwing(st);
    this.ornaments.clear();
    this.eyesDone = false;
    this.completing = false;
    this.painted = 0;
    this.strokeCarry = 0;
    this.capture = [];
    this.captured = false;
    this.placed = null;
    this.saved = loadStroke();
    this.dust = [];
    this.motes = makeMotes(6);
    this.holdCandidate = false;
    this.holding = false;
    this.hold = 0;
    this.memory = null;
    this.opening = false;
    this.lighting = false;
    this.finalDone = false;
    this.annualityComplete = false;
    this.memoriesSeen.clear();
    this.letterReadyAt = 0;
    this.blessingShown = false;
    this.epiloguePending = false;
    this.endingStarted = false;
    this.idleReplay = null;
    this.annualitySaid = false;
    this.pendingLift = null;
    this.activePointers.clear();
    this.strokeSceneReady = false;
    this.strokeInputArmed = false;
    this.strokePromptAt = -1;
    this.shineAt = -1e9;
    this.releasePointer();
    this.camFrom = null;
    this.camTo = 'ganesh';
    this.camDur = 0;
    this.setPhase('threshold');
    this.setUI({
      whisper: null, strokePrompt: false, finalLine: 0, replay: false, memory: null, memoryRect: null,
      seenMemories: [], memoryGuide: false, memoryButtons: [],
      letterAvailable: false, letterPrompt: false, letterOpen: false, epilogueReady: false,
      finalBlessing: false, finalFarewell: false, letterButton: null,
    });
  }

  // ───────────────────────────── update ─────────────────────────────

  private update(dt: number): boolean {
    let animating = this.camMoving();
    const t = this.now;

    if (this.sketch.update(t, this.bristles, null)) animating = true;
    if (this.color.update(t, this.blooms, this.rims)) animating = true;
    if (this.back.update(t, this.blooms, null)) animating = true;
    if (this.front.update(t, this.blooms, null)) animating = true;
    if (this.woman.update(t, this.blooms, null)) animating = true;
    for (const st of this.ornaments.values()) if (st.mask?.update(t, this.blooms, null)) animating = true;
    if (this.memory?.mask.update(t, this.blooms, null)) animating = true;

    if (this.phase === 'stroke' && !this.strokeSceneReady && !this.camMoving()) {
      this.strokeSceneReady = true;
      this.strokePromptAt = t;
      if (!this.captured) this.setUI({ strokePrompt: true });
    }
    this.tryArmStroke();

    // drops keep spreading after the finger lifts; look again once they settle
    if ((this.phase === 'rekha' || this.phase === 'rang') && !this.completing && this.painted > 0 && this.pointerId === null && t - this.lastCoverage > 700 && t - this.interactedAt < 4000) {
      this.checkProgress();
    }

    // tilt: sensor when granted, otherwise a very slow drift of light
    if (!this.hasSensor) {
      this.tiltTarget = this.reduced ? { x: 0, y: 0 } : { x: Math.sin(t * 0.00021) * 0.6, y: Math.cos(t * 0.00017) * 0.4 };
    }
    const k = 1 - Math.exp(-dt / 220);
    this.tilt.x += (this.tiltTarget.x - this.tilt.x) * k;
    this.tilt.y += (this.tiltTarget.y - this.tilt.y) * k;

    if (this.phase === 'living') {
      if (this.holdCandidate && !this.holding && this.pointerId !== null && this.downAt && t - this.downAt.t > 420) {
        this.holding = true;
        this.interactedAt = t;
      }
      const target = this.holding ? 1 : 0;
      if (this.hold !== target) {
        // slow to recede, gentle to return
        this.hold = this.holding ? Math.min(1, this.hold + dt / 4200) : Math.max(0, this.hold - dt / 1700);
        animating = true;
      }
      if (this.holding) this.interactedAt = t;
      this.updateFinal();
      if (!this.reduced) stepMotes(this.motes, dt, t);
    }
    if (this.dust.length) {
      this.dust = this.dust.filter((d) => t - d.t0 < 1400);
      for (const d of this.dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      animating = true;
    }
    return animating;
  }

  private updateFinal() {
    const t = this.now;
    // all five seen, by any route (the last one, "Back", a missing photograph): the note is offered at once
    if (!this.blessingShown && !this.epiloguePending && !this.ui.letterAvailable && !this.memory && this.memoriesSeen.size === MEMORIES.length) {
      this.offerLetter();
      return;
    }
    // she has not gone looking: after a long stillness, the note comes anyway
    if (this.annualityComplete && !this.blessingShown && !this.epiloguePending && !this.ui.letterAvailable && !this.memory && !this.holding && t >= this.letterReadyAt) {
      this.enterEnding();
      this.setUI({ letterAvailable: true, letterPrompt: true });
      this.after(6500, () => this.setUI({ letterPrompt: false }));
    }
    if (this.finalDone || this.memory || this.holding || this.ui.finalLine || this.ui.letterOpen) return;
    if (t - this.interactedAt > 15000 && t - this.livingSince > 18000) {
      this.finalDone = true;
      this.annualitySaid = true;
      this.setUI({ finalLine: 1 });
      this.after(3400, () => {
        this.setUI({ finalLine: 2 });
      });
      this.after(12000, () => {
        this.annualityComplete = true;
        this.setUI({ finalLine: 0 });
        if (this.memoriesSeen.size < MEMORIES.length) this.tween('memCues', 1, 2400);
        // the guide waits for the annuality words to finish fading from the same line
        this.after(3000, () => {
          if (!this.memory && this.memoriesSeen.size === 0) this.setUI({ memoryGuide: true });
        });
        // Each object gets one quiet chance to identify itself; the painting does not keep prompting forever.
        this.after(30000, () => {
          this.tween('memCues', 0, 3000);
          this.setUI({ memoryGuide: false });
        });
      });
      this.idleReplay = this.after(14000, () => {
        this.idleReplay = null;
        // once the ending has begun, replay returns only after the final blessing
        if (!this.endingStarted) this.setUI({ replay: true });
      });
    }
  }

  // ───────────────────────────── drawing ─────────────────────────────

  private drawPaperOnly() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.paper(g);
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.lastDraw = this.now;
  }

  private paper(g: CanvasRenderingContext2D) {
    if (!this.paperPattern) {
      this.paperPattern = g.createPattern(paperTile(), 'repeat');
    }
    return this.paperPattern ?? P.paper;
  }

  private draw() {
    const g = this.g;
    const scene = this.scene!;
    const c = this.cam();
    const t = this.now;
    const h = this.hold;
    const unit = 1 / c.s; // artboard units per CSS px

    // depth only when the phone itself moves, and only a pixel or so; never a looping drift
    const living = this.val('living');
    const depth = this.reduced || !this.hasSensor ? 0 : living;
    const px = this.tilt.x * 1.2 * depth;
    const py = this.tilt.y * 0.8 * depth;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // paper, fixed to the artboard so it zooms with the painting
    this.setCam(g, c);
    const pat = this.paper(g);
    if (typeof pat !== 'string') pat.setTransform(new DOMMatrix().scale(1 / Math.max(0.5, c.s * this.dpr * 0.9)));
    g.fillStyle = pat;
    const x0 = c.cx - c.sx / c.s - 20, y0 = c.cy - c.sy / c.s - 20;
    g.fillRect(x0, y0, this.vw / c.s + 40, this.vh / c.s + 40);

    // press and hold: gold rests, then the world softens away, then the watercolour drains
    const recedeGold = 1 - smooth(h / 0.3);
    const recedeWorld = 1 - smooth((h - 0.15) / 0.4);
    const recedeColor = 1 - smooth((h - 0.42) / 0.45);
    const world = this.phase === 'reveal' || this.phase === 'living';

    if (world) this.drawMasked(scene.back, this.back, recedeWorld * 0.97, c, -px * 0.25, -py * 0.25);

    // Ganesh ji: pigment, pooled rims, resting gold, then line
    if (this.phase !== 'threshold' && this.phase !== 'rekha') {
      if (this.color.full && !this.color.drops.length) {
        this.drawLayer(this.settledColor(scene.ganeshColor), c, 0.96 * recedeColor);
      } else {
        this.drawMasked(scene.ganeshColor, this.color, 0.96 * recedeColor, c);
        if (recedeColor > 0) this.drawRims(scene.ganeshColor, c, 0.5 * recedeColor, 0, 0);
      }
      this.drawResting(c, recedeGold, recedeColor);
    }
    if (this.phase !== 'threshold') {
      const ink = this.val('ink', 1);
      this.drawMasked(scene.ganeshInk, this.sketch, ink, c);
      const fill = this.val('inkFill');
      if (fill > 0) this.drawLayer(scene.ganeshInk, c, fill);
    }
    this.drawBells(c);

    // offerings, then her
    if (world) {
      this.drawMasked(scene.front, this.front, recedeWorld, c, px * 0.6, py * 0.6);
      this.drawMasked(scene.woman, this.woman, recedeWorld, c, px * 0.6, py * 0.6);
    }

    // her stroke, becoming a golden thread
    this.setCam(g, c, px * 0.6, py * 0.6);
    const threadInk = this.val('threadInk', this.phase === 'living' ? 1 : 0);
    const thread = this.val('thread', this.phase === 'living' ? 1 : 0);
    if (this.placed && threadInk > 0 && world) this.drawThread(g, this.placed, threadInk, thread, h);

    // living details: only what a painting could plausibly do
    const life = living * recedeWorld;
    if (life > 0) {
      this.setCam(g, c, px * 0.6, py * 0.6);
      if (!this.reduced) {
        const breath = 0.5 + 0.5 * Math.sin(t * 0.0006) * Math.sin(t * 0.00019 + 1.3);
        g.globalCompositeOperation = 'soft-light';
        const warm = g.createRadialGradient(878, 1270, 10, 878, 1270, 320);
        warm.addColorStop(0, `rgba(255, 206, 130, ${life * (0.14 + 0.05 * breath)})`);
        warm.addColorStop(1, 'rgba(255, 206, 130, 0)');
        g.fillStyle = warm;
        g.fillRect(878 - 320, 1270 - 320, 640, 640);
        g.globalCompositeOperation = 'source-over';
      }
      FLAMES.forEach((f, i) => drawFlame(g, f.x, f.y, t, life, i, this.reduced));
      if (!this.reduced) drawSmoke(g, INCENSE.x, INCENSE.y, t, life);
      if (!this.reduced && this.phase === 'living') drawMotes(g, this.motes, t, life);
    }
    this.drawGoldLight(c, recedeGold * recedeColor);
    if (world) this.paperEdges(c, living);
    this.setCam(g, c);

    // cues
    const cues = this.val('cues') * (this.phase === 'shringar' ? 1 : 0);
    if (cues > 0) {
      for (const o of scene.ornaments) {
        if (this.ornaments.has(o.def.id)) continue;
        o.def.glints.forEach((p, i) => drawGlint(g, p.x, p.y, t, i * 2.1 + o.def.id.length, Math.min(1, cues) * 0.8, unit));
      }
    }
    const memCues = this.val('memCues') * recedeWorld * (this.memory ? 0 : 1);
    if (memCues > 0 && this.phase === 'living') {
      // one object at a time, now and then, catches the light
      const slot = 5200;
      const k = Math.floor(t / slot);
      const m = MEMORIES[k % MEMORIES.length];
      const env = Math.sin(((t % slot) / slot) * Math.PI);
      m.glint.forEach((p) => drawGlint(g, p.x, p.y, t * 0.6, k * 1.7, memCues * env * 0.7, unit));
    }
    for (const d of this.dust) {
      const a = 1 - (t - d.t0) / 1400;
      drawGlint(g, d.x, d.y, t, d.t0, a * 0.8, unit * 0.5);
    }

    // the eyes: a very slight warming of the whole paper
    const lift = this.val('lift') * (1 - h * 0.6);
    if (lift > 0) {
      g.globalCompositeOperation = 'soft-light';
      const light = g.createRadialGradient(507, 500, 40, 507, 620, 820);
      light.addColorStop(0, `rgba(255, 236, 200, ${0.45 * lift})`);
      light.addColorStop(1, 'rgba(255, 236, 200, 0)');
      g.fillStyle = light;
      g.fillRect(x0, y0, this.vw / c.s + 40, this.vh / c.s + 40);
      g.globalCompositeOperation = 'source-over';
    }

    // his presence, at the start of the reveal: warm light gathers around him, then recedes into the shrine
    const presence = this.val('presence');
    if (presence > 0.003) {
      g.globalCompositeOperation = 'soft-light';
      const glow = g.createRadialGradient(507, 640, 60, 507, 700, 720);
      glow.addColorStop(0, `rgba(255, 210, 140, ${0.3 * presence})`);
      glow.addColorStop(1, 'rgba(255, 210, 140, 0)');
      g.fillStyle = glow;
      g.fillRect(x0, y0, this.vw / c.s + 40, this.vh / c.s + 40);
      g.globalCompositeOperation = 'source-over';
    }

    // quieting veil for her stroke
    const veil = Math.max(this.val('veil'), this.val('dissolve'));
    if (veil > 0) this.paperVeil(c, veil);

    // her stroke while being made, and just after
    if (this.phase === 'stroke' || (this.phase === 'reveal' && this.val('strokeInk') > 0)) {
      const a = this.captured ? this.val('strokeInk') : 1;
      if (this.capture.length && a > 0) {
        this.setCam(g, c);
        g.globalAlpha = a * 0.16;
        drawRibbon(g, this.capture, 15 / c.s, P.inkSoft);
        g.globalAlpha = a * 0.9;
        drawRibbon(g, this.capture, 9 / c.s, P.ink);
        g.globalAlpha = 1;
      }
    }

    if (this.memory) this.drawMemory(this.memory, c);

    // replay dissolve
    const fade = this.val('fade');
    if (fade > 0) this.paperVeil(c, fade);
  }

  /** The finished shrine is framed just inside its painted border; its edges settle softly into the paper. */
  private paperEdges(c: Cam, strength: number) {
    if (strength <= 0.003) return;
    const g = this.g;
    const box = FRAMES.full.box;
    const feather = 16 / c.s;
    const X0 = c.cx - c.sx / c.s - 20, Y0 = c.cy - c.sy / c.s - 20;
    const X1 = X0 + this.vw / c.s + 40, Y1 = Y0 + this.vh / c.s + 40;
    this.setCam(g, c);
    g.fillStyle = this.paper(g);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      // each strip a little further in, a little fainter
      const d = (feather * i) / steps;
      g.globalAlpha = strength * (i === 0 ? 1 : 1 - (i - 0.5) / steps);
      const x0 = box.x + d, y0 = box.y + d, x1 = box.x + box.w - d, y1 = box.y + box.h - d;
      if (i === 0) {
        g.fillRect(X0, Y0, X1 - X0, y0 - Y0);
        g.fillRect(X0, y1, X1 - X0, Y1 - y1);
        g.fillRect(X0, y0, x0 - X0, y1 - y0);
        g.fillRect(x1, y0, X1 - x1, y1 - y0);
      } else {
        const w = feather / steps;
        g.fillRect(x0 - w, y0 - w, x1 - x0 + 2 * w, w);
        g.fillRect(x0 - w, y1, x1 - x0 + 2 * w, w);
        g.fillRect(x0 - w, y0, w, y1 - y0);
        g.fillRect(x1, y0, w, y1 - y0);
      }
    }
    g.globalAlpha = 1;
  }

  /** Lays the same sheet of paper back over the painting. */
  private paperVeil(c: Cam, alpha: number) {
    const g = this.g;
    this.setCam(g, c);
    g.globalAlpha = alpha;
    g.fillStyle = this.paper(g);
    g.fillRect(c.cx - c.sx / c.s - 20, c.cy - c.sy / c.s - 20, this.vw / c.s + 40, this.vh / c.s + 40);
    g.globalAlpha = 1;
  }

  /** Screen-space device rect covered by an artboard box, clipped to the canvas. */
  private screenRect(box: Box, c: Cam, ox: number, oy: number) {
    const d = this.dpr;
    const x = Math.floor(((box.x - c.cx) * c.s + c.sx + ox) * d) - 2;
    const y = Math.floor(((box.y - c.cy) * c.s + c.sy + oy) * d) - 2;
    const w = Math.ceil(box.w * c.s * d) + 4;
    const h = Math.ceil(box.h * c.s * d) + 4;
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(this.canvas.width, x + w), y1 = Math.min(this.canvas.height, y + h);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  private drawLayer(layer: Layer, c: Cam, alpha: number, ox = 0, oy = 0) {
    if (alpha <= 0.003) return;
    const g = this.g;
    this.setCam(g, c, ox, oy);
    g.globalAlpha = alpha;
    g.drawImage(layer.canvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h);
    g.globalAlpha = 1;
  }

  private drawMasked(layer: Layer, mask: RevealMask, alpha: number, c: Cam, ox = 0, oy = 0, invert = false) {
    if (alpha <= 0.003) return;
    if (mask.full) return invert ? undefined : this.drawLayer(layer, c, alpha, ox, oy);
    const rect = this.screenRect(layer.box, c, ox, oy);
    if (!rect) return;
    const wg = this.wg;
    wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    wg.clearRect(rect.x, rect.y, rect.w, rect.h);
    this.setCam(wg, c, ox, oy);
    wg.drawImage(layer.canvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h);
    wg.globalCompositeOperation = invert ? 'destination-out' : 'destination-in';
    wg.drawImage(mask.live, mask.box.x, mask.box.y, mask.box.w, mask.box.h);
    wg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha;
    g.drawImage(this.work, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    g.globalAlpha = 1;
  }

  private settled: Layer | null = null;

  /** The colour layer with its dried rims baked in, so the finished painting costs one draw. */
  private settledColor(layer: Layer): Layer {
    if (this.settled) return this.settled;
    const rim = this.color.rimDry!;
    const c = makeCanvas(layer.canvas.width, layer.canvas.height);
    const g = ctx2d(c);
    g.drawImage(layer.canvas, 0, 0);
    const t = makeCanvas(c.width, c.height);
    const tg = ctx2d(t);
    tg.drawImage(layer.canvas, 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    tg.drawImage(rim, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.55;
    g.drawImage(t, 0, 0);
    this.settled = { canvas: c, box: layer.box };
    return this.settled;
  }

  /** Pigment pooled at the edges of each wash, where drops met and dried. */
  private drawRims(layer: Layer, c: Cam, alpha: number, ox: number, oy: number) {
    const mask = this.color;
    const rect = this.screenRect(layer.box, c, ox, oy);
    if (!rect || !mask.rimLive) return;
    const wg = this.wg;
    wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.clearRect(rect.x, rect.y, rect.w, rect.h);
    this.setCam(wg, c, ox, oy);
    wg.drawImage(layer.canvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h);
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(mask.rimLive, mask.box.x, mask.box.y, mask.box.w, mask.box.h);
    wg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = alpha;
    g.drawImage(this.work, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** Gold not yet found rests matte; each discovery lifts that rest away in its own manner. */
  private drawResting(c: Cam, recedeGold: number, recedeColor: number) {
    const scene = this.scene!;
    const g = this.g;
    const quick = this.reduced;
    for (const o of scene.ornaments) {
      if (!o.def.key || recedeColor <= 0.003) continue;
      const st = this.ornaments.get(o.def.id);
      const returning = 1 - recedeGold;
      if (!st) {
        this.drawLayer(o, c, recedeColor);
        continue;
      }
      const el = this.now - st.t0;
      const { box, mode, anchor } = o.def;
      if (mode === 'leaf' || mode === 'bloom') {
        if (st.mask && !st.mask.full) this.drawMasked(o, st.mask, recedeColor, c, 0, 0, true);
      } else if (mode === 'sweep' || mode === 'wipe') {
        const p = quick ? 1 : easeInOut(el / (mode === 'sweep' ? 2800 : 2200));
        if (p < 1) {
          this.setCam(g, c);
          g.save();
          g.beginPath();
          if (mode === 'sweep') {
            const start = Math.atan2(st.y - anchor.y, st.x - anchor.x);
            // the rest that remains: everything outside the growing arc
            g.moveTo(anchor.x, anchor.y);
            g.arc(anchor.x, anchor.y, box.w, start + p * Math.PI, start - p * Math.PI + Math.PI * 2);
            g.closePath();
          } else {
            const half = p * box.w;
            g.rect(box.x, box.y, st.x - half - box.x, box.h);
            g.rect(st.x + half, box.y, box.x + box.w - st.x - half, box.h);
          }
          g.clip();
          g.globalAlpha = recedeColor;
          g.drawImage(o.canvas, box.x, box.y, box.w, box.h);
          g.restore();
          g.globalAlpha = 1;
        }
      }
      if (returning > 0.003) this.drawLayer(o, c, returning * recedeColor);
    }
  }

  private drawBells(c: Cam) {
    const g = this.g;
    for (const st of this.ornaments.values()) {
      if (!st.bells) continue;
      const el = this.now - st.t0;
      st.bells.forEach((b, i) => {
        const angle = this.reduced ? 0 : 0.22 * Math.exp(-el / 1900) * Math.sin((el / 1000) * Math.PI * 2 * (0.95 - i * 0.12) + i * 0.7);
        this.setCam(g, c);
        g.translate(b.piece.pivot.x, b.piece.pivot.y);
        g.rotate(angle);
        g.translate(-b.piece.pivot.x, -b.piece.pivot.y);
        g.globalAlpha = 0.96;
        g.drawImage(b.colour, b.box.x, b.box.y, b.box.w, b.box.h);
        g.globalAlpha = 1;
        g.drawImage(b.ink, b.box.x, b.box.y, b.box.w, b.box.h);
      });
    }
  }

  /**
   * Light catching gold that has been found: once as it wakes, and in the living painting only
   * now and then, one ornament at a time. With a motion sensor the band follows the phone.
   */
  private drawGoldLight(c: Cam, alpha: number) {
    if (alpha <= 0.05 || this.reduced || !this.scene) return;
    const t = this.now;
    for (const [idx, o] of this.scene.ornaments.entries()) {
      if (o.def.key !== 'gold') continue;
      const st = this.ornaments.get(o.def.id);
      if (!st) continue;
      const el = t - st.t0;
      let env = 0, pos = 0;
      if (el < 3600) {
        const p = clamp((el - 500) / 3000);
        env = Math.sin(p * Math.PI);
        pos = lerp(-0.2, 1.2, p);
      }
      // fully adorned: one slower pass over all of his gold at once
      const se = t - this.shineAt;
      if (se >= 0 && se < 4200) {
        const p = clamp(se / 4200);
        const pass = Math.sin(p * Math.PI);
        if (pass > env) {
          env = pass;
          pos = lerp(-0.25, 1.25, p);
        }
      }
      if (this.phase === 'living') {
        const period = 14000, offset = idx * 2900;
        const p = clamp(((t + offset) % period) / 4200);
        const pass = Math.sin(p * Math.PI) * (p < 1 ? 1 : 0);
        if (pass > env) {
          env = pass * 0.8;
          pos = lerp(-0.2, 1.2, p);
        }
      }
      if (this.hasSensor) pos = 0.5 + this.tilt.x * 0.45 + this.tilt.y * 0.25;
      if (env <= 0.02) continue;
      const rect = this.screenRect(o.box, c, 0, 0);
      if (!rect) continue;
      const wg = this.wg;
      wg.setTransform(1, 0, 0, 1, 0, 0);
      wg.globalCompositeOperation = 'source-over';
      wg.clearRect(rect.x, rect.y, rect.w, rect.h);
      this.setCam(wg, c);
      wg.drawImage(o.canvas, o.box.x, o.box.y, o.box.w, o.box.h);
      wg.globalCompositeOperation = 'source-in';
      const { x, y, w, h } = o.box;
      const grad = wg.createLinearGradient(x, y, x + w, y + h);
      const band = 0.12;
      grad.addColorStop(clamp(pos - band), 'rgba(255, 240, 200, 0)');
      grad.addColorStop(clamp(pos), 'rgba(255, 244, 214, 1)');
      grad.addColorStop(clamp(pos + band), 'rgba(255, 240, 200, 0)');
      wg.fillStyle = grad;
      wg.fillRect(x, y, w, h);
      wg.globalCompositeOperation = 'source-over';
      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = alpha * env * 0.7;
      g.drawImage(this.work, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }

  /** Her line as she drew it, in ink; then antique gold travels along it from her offering toward him. */
  private drawThread(g: CanvasRenderingContext2D, pts: StrokePoint[], ink: number, p: number, hold: number) {
    const inkness = smooth((hold - 0.25) / 0.5);
    const base = 7.5;
    const ends = 0.14;
    // the ink stays beneath as the gold's fine sepia edge
    g.globalAlpha = ink * lerp(0.8 - 0.55 * p, 0.85, inkness);
    drawRibbon(g, pts, base * 1.2, P.ink, 1, ends);
    const gold = (1 - inkness) * ink;
    if (gold > 0 && p > 0) {
      g.globalAlpha = gold * 0.92;
      const a = pts[0], z = pts[pts.length - 1];
      const grad = g.createLinearGradient(a.x, a.y, z.x, z.y);
      grad.addColorStop(0, '#8f6a33');
      grad.addColorStop(0.5, '#ae8646');
      grad.addColorStop(1, '#94703a');
      drawRibbon(g, pts, base, grad, p, ends);
      // One readable recognition beat while her exact line first turns to gold; it does not remain bright.
      if (p < 1 && !this.reduced) {
        g.globalAlpha = gold * Math.sin(p * Math.PI) * 0.58;
        drawRibbon(g, pts, base * 0.42, P.goldLight, p, ends);
      }
      // a metallic catch of light, only now and then (or as the phone tilts), travelling along the thread
      const t = this.now;
      const cycle = 13000;
      const q = ((t % cycle) / 2600);
      let env = q < 1 ? Math.sin(q * Math.PI) : 0;
      let at = q;
      if (this.hasSensor) {
        env = Math.max(env, clamp(Math.abs(this.tilt.x) * 1.4));
        at = 0.5 + this.tilt.x * 0.5;
      }
      env *= p >= 1 ? 1 : 0;
      if (env > 0.02 && !this.reduced) {
        const n = pts.length;
        const i0 = Math.max(0, Math.floor((at - 0.18) * n)), i1 = Math.min(n, Math.ceil((at + 0.18) * n));
        if (i1 - i0 > 2) {
          g.globalAlpha = gold * env * 0.55;
          drawRibbon(g, pts.slice(i0, i1), base * 0.4, P.goldLight, 1, 0.45);
        }
      }
    }
    g.globalAlpha = 1;
  }

  /** The painted world gives way: it quiets and warms, and a real memory surfaces beneath it. */
  private drawMemory(m: OpenMemory, c: Cam) {
    const g = this.g;
    const t = this.now;
    const d = this.dpr;
    const el = t - m.t0;
    const closing = m.closing !== null ? clamp((t - m.closing) / 1200) : 0;
    const a = 1 - easeInOut(closing);
    const mv = this.val('memVeil');

    // the painting recedes to about a third of its presence: colour quieted, warmed, laid under paper
    if (mv > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = `rgba(226, 212, 190, ${0.7 * mv})`;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgba(250, 232, 204, ${0.3 * mv})`;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      g.globalCompositeOperation = 'source-over';
      this.paperVeil(c, 0.64 * mv);
    }

    // a little wet pigment where the object was touched, as the paint begins to part
    if (!this.reduced && m.closing === null && el < 2400) {
      const p = clamp(el / 1300);
      const fadeOut = 1 - smooth((el - 700) / 1500);
      const rr = (16 + 54 * easeOut(p)) * d;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.16 * fadeOut;
      g.drawImage(this.wetStamp(), m.origin.x * d - rr, m.origin.y * d - rr, rr * 2, rr * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (a <= 0) return;

    const { rect, mask, photo, edge } = m;
    const wg = this.wg;
    const x = rect.x * d, y = rect.y * d, w = rect.w * d, h = rect.h * d;
    const grow = 1 + closing * 0.03;
    wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    wg.clearRect(x - 4, y - 4, w + 8, h + 8);
    wg.drawImage(photo, x, y, w, h);
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(mask.live, x + (w - w * grow) / 2, y + (h - h * grow) / 2, w * grow, h * grow);
    wg.drawImage(edge, x, y, w, h);
    wg.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = a;
    // source rectangles stay inside the canvas (Safari drops out-of-bounds draws)
    const sx = Math.max(0, x), sy = Math.max(0, y);
    const sw = Math.min(this.work.width, x + w) - sx, sh = Math.min(this.work.height, y + h) - sy;
    if (sw > 0 && sh > 0) g.drawImage(this.work, sx, sy, sw, sh, sx, sy, sw, sh);
    g.globalAlpha = 1;
  }

  private wet: Canvas | null = null;
  private wetStamp() {
    if (!this.wet) {
      const b = this.blooms[2];
      this.wet = makeCanvas(b.width, b.height);
      const wg = ctx2d(this.wet);
      wg.drawImage(b, 0, 0);
      wg.globalCompositeOperation = 'source-in';
      wg.fillStyle = 'rgb(168, 112, 70)';
      wg.fillRect(0, 0, b.width, b.height);
    }
    return this.wet;
  }
}
