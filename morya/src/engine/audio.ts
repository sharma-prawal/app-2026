// Every sound but one is synthesised; nothing is autoplayed.
// The AudioContext is created inside the first touch (the diya), as Safari requires.
// The one recording, a short sung invocation to Ganpati (see docs/ASSET_LICENSES.md), is played once through
// the same context, so it follows mute and never needs its own playback permission.

const MUTE_KEY = 'morya.muted';

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brush: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private ambience: AudioNode[] = [];
  private ambienceGain: GainNode | null = null;
  private invocationData: Promise<ArrayBuffer | null> | null = null;
  private invocationBuffer: Promise<AudioBuffer | null> | null = null;
  private invocation: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called synchronously inside a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
      // tiny synthetic room
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.8);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.35;
      this.reverb.connect(this.wet).connect(this.master);
      this.noise = this.noiseBuffer(3);
      // silent buffer primes iOS output
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      b.connect(ctx.destination);
      b.start(0);
      if (ctx.state !== 'running') void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return !!this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.08);
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  private noiseBuffer(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // slightly brown, softer than white noise
      last = (last + 0.08 * (Math.random() * 2 - 1)) / 1.08;
      d[i] = last * 3.2 + (Math.random() * 2 - 1) * 0.15;
    }
    return buf;
  }

  private out(gain: number, reverb = 0.6) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master!);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverb!);
    }
    return g;
  }

  /** A small temple bell: inharmonic partials with long, uneven decay. */
  bell(opts: { pitch?: number; gain?: number; decay?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const f0 = opts.pitch ?? 523;
    const now = ctx.currentTime + 0.01;
    const bus = this.out(opts.gain ?? 0.16, 0.9);
    const partials: [number, number, number][] = [
      [0.5, 0.35, 1.6], [1, 1, 1], [2.01, 0.55, 0.62], [2.76, 0.42, 0.45], [5.4, 0.2, 0.22], [8.93, 0.08, 0.12],
    ];
    const decay = opts.decay ?? 4.5;
    for (const [ratio, amp, dk] of partials) {
      for (const detune of [0, 1.6]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f0 * ratio + detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(amp * (detune ? 0.5 : 1) * 0.3, now + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decay * dk);
        o.connect(g).connect(bus);
        o.start(now);
        o.stop(now + decay * dk + 0.05);
      }
    }
  }

  /** Match strike and the soft breath of a wick catching. */
  ignite() {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const now = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(600, now + 0.5);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    src.connect(bp).connect(g).connect(this.out(1, 0.25));
    src.start(now, Math.random() * 2, 0.8);
  }

  /** Very quiet room tone with a distant drone, faded in slowly. */
  startAmbience() {
    const ctx = this.ctx;
    if (!ctx || this.ambienceGain) return;
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + 8);
    bus.connect(this.master!);
    this.ambienceGain = bus;

    const room = ctx.createBufferSource();
    room.buffer = this.noise;
    room.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const rg = ctx.createGain();
    rg.gain.value = 0.02;
    room.connect(lp).connect(rg).connect(bus);
    room.start();

    const drone: AudioNode[] = [];
    for (const [f, a] of [[130.81, 0.012], [196.0, 0.008], [261.63, 0.004]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = ctx.createGain();
      lg.gain.value = a * 0.5;
      const g = ctx.createGain();
      g.gain.value = a;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(bus);
      o.start();
      lfo.start();
      drone.push(o, lfo);
    }
    this.ambience = [room, ...drone];
  }

  stopAmbience(fade = 1.2) {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain) return;
    const g = this.ambienceGain;
    const nodes = this.ambience;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    const stopAt = ctx.currentTime + fade + 0.2;
    for (const n of nodes) (n as OscillatorNode).stop?.(stopAt);
    this.ambienceGain = null;
    this.ambience = [];
  }

  /** Continuous brush-on-paper texture; intensity follows finger speed. */
  brushLevel(level: number, wet: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    if (!this.brush) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.out(1, 0.15));
      src.start();
      this.brush = { src, filter, gain };
    }
    const t = ctx.currentTime;
    this.brush.filter.frequency.setTargetAtTime(wet ? 700 : 3200, t, 0.1);
    this.brush.gain.gain.setTargetAtTime(Math.min(1, level) * (wet ? 0.1 : 0.05), t, 0.06);
  }

  stopBrush() {
    if (!this.brush || !this.ctx) return;
    const { src, gain } = this.brush;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    src.stop(this.ctx.currentTime + 0.4);
    this.brush = null;
  }

  /** A breath of air for opening/closing a memory. */
  hush(open: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const now = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(open ? 300 : 900, now);
    lp.frequency.exponentialRampToValueAtTime(open ? 1100 : 250, now + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.4);
    g.gain.linearRampToValueAtTime(0, now + 1.3);
    src.connect(lp).connect(g).connect(this.out(1, 0.5));
    src.start(now, Math.random() * 1.5, 1.4);
  }

  /** Tiny metallic glint for a discovered ornament. */
  chime(step = 0) {
    const scale = [659.3, 783.99, 880, 1046.5, 1174.7, 1318.5];
    this.bell({ pitch: scale[step % scale.length], gain: 0.05, decay: 2.2 });
  }

  /** Fetches the invocation early; bytes only, so it needs no AudioContext yet. */
  prefetchInvocation(url: string) {
    this.invocationData ??= fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }

  /** Decodes once the context exists (after the diya), well before it is needed. */
  prepareInvocation() {
    const ctx = this.ctx;
    if (!ctx || !this.invocationData || this.invocationBuffer) return;
    this.invocationBuffer = this.invocationData.then((data) => {
      if (!data) return null;
      // Safari's older callback form is also the most reliable one
      return new Promise<AudioBuffer | null>((resolve) => {
        try {
          const p = ctx.decodeAudioData(data.slice(0), (b) => resolve(b), () => resolve(null));
          p?.catch?.(() => resolve(null));
        } catch {
          resolve(null);
        }
      });
    });
  }

  /**
   * The room becomes devotional: the invocation rises out of silence, very low.
   * Only if the context is actually running, so it can never start late and out of place.
   */
  async playInvocation(level = 0.22) {
    const ctx = this.ctx;
    if (!ctx || this.invocation || !this.invocationBuffer) return;
    const buffer = await this.invocationBuffer;
    if (!buffer || ctx.state !== 'running' || this.invocation) return;
    const now = ctx.currentTime + 0.05;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 2.5);
    gain.connect(this.master!);
    // a breath of the same small room the bells live in
    const send = ctx.createGain();
    send.gain.value = 0.18;
    gain.connect(send).connect(this.reverb!);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    src.onended = () => {
      if (this.invocation?.src === src) this.invocation = null;
    };
    src.start(now);
    this.invocation = { src, gain };
  }

  /** Lets the invocation go: it is never resumed once it has been set down. */
  releaseInvocation(seconds = 4) {
    const ctx = this.ctx;
    const inv = this.invocation;
    if (!ctx || !inv) return;
    this.invocation = null;
    const now = ctx.currentTime;
    inv.gain.gain.cancelScheduledValues(now);
    inv.gain.gain.setValueAtTime(inv.gain.gain.value, now);
    inv.gain.gain.linearRampToValueAtTime(0, now + seconds);
    try {
      inv.src.stop(now + seconds + 0.1);
    } catch {
      /* already stopped */
    }
  }

  reset() {
    this.stopBrush();
    this.stopAmbience(0.6);
    this.releaseInvocation(0.6);
  }
}
