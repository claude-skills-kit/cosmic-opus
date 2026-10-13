// Web Audio helper shared by both pages: narration, one-shot effects, looping beds.
// One context, three buses (voice / fx / bed) so the narration can duck everything else.
// Files are fetched early; decoding waits for init(), which must run inside a user gesture.

const BUS_LVL = { voice: 1, fx: 0.9, bed: 0.75 };

export class AudioKit {
  constructor() { this.ctx = null; this.on = true; this.raw = new Map(); this.dec = new Map(); }
  get ready() { return !!this.ctx; }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? 1 : 0; this.out.connect(c.destination);
    this.bus = {};
    for (const k in BUS_LVL) { const g = c.createGain(); g.gain.value = BUS_LVL[k]; g.connect(this.out); this.bus[k] = g; }
    return c;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  prefetch(url) {
    // a failed fetch is forgotten, so the next call tries again instead of staying silent for good
    if (!this.raw.has(url)) this.raw.set(url, fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
      .then(ab => { if (!ab) this.raw.delete(url); return ab; }));
    return this.raw.get(url);
  }
  buffer(url) {
    if (!this.ctx) return Promise.resolve(null);
    if (!this.dec.has(url)) this.dec.set(url, this.prefetch(url).then(ab => ab ? new Promise(res => {
      // Safari only takes the callback form, and a decoded ArrayBuffer is detached, so pass a copy
      this.ctx.decodeAudioData(ab.slice(0), res, () => res(null));
    }) : null).then(buf => { if (!buf) this.dec.delete(url); return buf; }));
    return this.dec.get(url);
  }
  setEnabled(on) {
    this.on = on;
    if (this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
  }
  // Lower effects and beds while someone is talking.
  duck(on, depth = 0.4) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (const k of ['fx', 'bed']) {
      const p = this.bus[k].gain; p.cancelScheduledValues(t);
      p.setTargetAtTime(BUS_LVL[k] * (on ? depth : 1), t, on ? 0.12 : 0.7);
    }
  }
  // Returns a handle at once; the sound starts when its buffer is ready unless stop() came first.
  // h.started is the context time the clip's 0 s would have played at, so position = now - started.
  play(url, { bus = 'fx', gain = 1, offset = 0, fadeIn = 0.02, onend } = {}) {
    const h = { url, stopped: false, ended: false, src: null, started: 0, dur: 0 };
    h.stop = (fade = 0.15) => {
      if (h.stopped) return; h.stopped = true; if (!h.src) return;
      const t = this.ctx.currentTime, g = h.g.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
      try { h.src.stop(t + fade + 0.02); } catch (e) {}
    };
    if (!this.ctx) { h.stopped = true; return h; }
    this.buffer(url).then(buf => {
      if (!buf || h.stopped) return;
      const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.connect(g); g.connect(this.bus[bus]);
      const t = c.currentTime, off = Math.max(0, Math.min(offset, buf.duration - 0.05));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + fadeIn);
      src.start(t, off); Object.assign(h, { src, g, started: t - off, dur: buf.duration });
      src.onended = () => { h.ended = true; if (!h.stopped && onend) onend(h); };
    });
    return h;
  }
}

// A looping bed built from overlapping copies with equal-power crossfades, so the seam
// (and any MP3 encoder padding at the ends) never shows.
const XIN = new Float32Array(64).map((_, i) => Math.sin(i / 63 * Math.PI / 2));
const XOUT = XIN.slice().reverse();
export class Bed {
  constructor(kit, url, { gain = 1, xf = 1.6 } = {}) { Object.assign(this, { kit, url, gain, xf, on: false, g: null }); kit.prefetch(url); }
  start(fade = 2.5) {
    if (this.on || !this.kit.ctx) return; this.on = true;
    this.kit.buffer(this.url).then(buf => {
      if (!buf || !this.on) return; this.buf = buf;
      const c = this.kit.ctx, t = c.currentTime;
      this.g = c.createGain(); this.g.connect(this.kit.bus.bed);
      this.g.gain.setValueAtTime(0, t); this.g.gain.linearRampToValueAtTime(this.gain, t + fade);
      this.next = t + 0.05; this.tick();
    });
  }
  tick() {
    if (!this.on || !this.g) return;
    const c = this.kit.ctx, b = this.buf, xf = Math.min(this.xf, b.duration / 3);
    while (this.next < c.currentTime + 2) {
      const s = c.createBufferSource(), e = c.createGain(), t0 = this.next, t1 = t0 + b.duration;
      s.buffer = b; s.connect(e); e.connect(this.g);
      e.gain.setValueCurveAtTime(XIN, t0, xf); e.gain.setValueCurveAtTime(XOUT, t1 - xf, xf);
      s.start(t0); s.stop(t1 + 0.05); this.next = t1 - xf;
    }
    this.timer = setTimeout(() => this.tick(), 600);
  }
  stop(fade = 1.8) {
    if (!this.on) return; this.on = false; clearTimeout(this.timer);
    const g = this.g; this.g = null; if (!g) return;
    const t = this.kit.ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => g.disconnect(), (fade + 0.3) * 1000);
  }
}
