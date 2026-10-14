// WebXR helpers shared by both pages: session start, Thai canvas panels, controller rays, fades.
// Everything placed under the camera rig lives in tracking space, so it is measured in real
// metres whatever scale the rig has: panels and rays stay hand-sized while the world grows or shrinks.
import * as THREE from 'three';

export const xrSupported = () => navigator.xr && window.isSecureContext
  ? navigator.xr.isSessionSupported('immersive-vr').catch(() => false) : Promise.resolve(false);
// Android Chrome also reports immersive-vr support (Cardboard-style), but a phone held in the hand
// can't use this UI, so the button shows only on headset browsers (Quest Browser carries
// "OculusBrowser" and a "Quest N" token) and desktops. ?vr=1 forces it for testing.
export const vrOffered = () => {
  const ua = navigator.userAgent, force = /[?&]vr=1\b/.test(location.search);
  const headset = /OculusBrowser|Quest|Pico|Wolvic|\bVR\b/i.test(ua), phone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return xrSupported().then(ok => ok && (force || headset || !phone));
};

export async function startXR(renderer, { scale = 1, onEnd } = {}) {
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(scale); // only takes effect before the session starts
  await renderer.xr.setSession(session);
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
  session.addEventListener('end', () => onEnd && onEnd());
  return session;
}

export const FONT = { thai: '"Noto Serif Thai", serif', sans: '"IBM Plex Sans Thai", system-ui, sans-serif', mono: '"IBM Plex Mono", monospace' };
export const fontsReady = () => Promise.all([
  '500 64px "Noto Serif Thai"', '400 40px "IBM Plex Sans Thai"', '500 40px "IBM Plex Sans Thai"', '400 30px "IBM Plex Mono"'
].map(f => document.fonts ? document.fonts.load(f).catch(() => {}) : null));

// Thai has no spaces between words, so wrap on dictionary word breaks.
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
export function wrap(g, text, maxW) {
  const parts = SEG ? [...SEG.segment(text)].map(s => s.segment) : text.split(/(\s+)/);
  const lines = []; let cur = '';
  for (const p of parts) {
    if (cur && g.measureText(cur + p).width > maxW) { lines.push(cur.trim()); cur = p.trimStart(); }
    else cur += p;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// A flat canvas panel, w×h metres. Drawn on demand; always on top of the scene.
export class Panel {
  constructor(w, h, ppm = 1000) {
    const c = this.canvas = document.createElement('canvas');
    c.width = Math.round(w * ppm); c.height = Math.round(h * ppm);
    this.g = c.getContext('2d'); this.w = w; this.h = h;
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.renderOrder = 30; this.mesh.userData.panel = this;
  }
  draw(fn) { const { g, canvas: c } = this; g.clearRect(0, 0, c.width, c.height); fn(g, c.width, c.height); this.tex.needsUpdate = true; }
  px(uv) { return [uv.x * this.canvas.width, (1 - uv.y) * this.canvas.height]; }
}

// Two controller rays (hand tracking pinches arrive as the same select events).
export function makePointers(renderer, rig, { onSelect } = {}) {
  const list = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0xffc084, transparent: true, opacity: 0.75, depthTest: false }));
    line.renderOrder = 40; line.scale.z = 4; line.visible = false; c.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    dot.renderOrder = 41; dot.visible = false; rig.add(dot);
    const p = { c, line, dot, ray: new THREE.Raycaster(), src: null, hover: null };
    c.addEventListener('connected', e => { p.src = e.data; line.visible = e.data.targetRayMode === 'tracked-pointer'; });
    c.addEventListener('disconnected', () => { p.src = null; line.visible = false; dot.visible = false; });
    c.addEventListener('selectstart', () => onSelect && onSelect(p));
    rig.add(c); list.push(p);
  }
  return list;
}
// Refresh each pointer's world-space ray from its controller pose.
export function aim(p) {
  p.c.updateMatrixWorld(true);
  p.ray.ray.origin.setFromMatrixPosition(p.c.matrixWorld);
  p.ray.ray.direction.set(0, 0, -1).transformDirection(p.c.matrixWorld);
  return p.ray;
}

// Gamepad buttons with edge detection (xr-standard mapping: 0 trigger, 1 grip, 3 stick, 4 A/X, 5 B/Y).
// The stick reports one event per push: {stick: ±1} left/right, {stickY: ±1} up (-1) / down (+1).
export class Pads {
  constructor() { this.prev = {}; this.stickLatch = {}; this.yLatch = {}; }
  read(session) {
    const ev = []; if (!session) return ev;
    for (const s of session.inputSources) {
      const gp = s.gamepad, h = s.handedness; if (!gp || !h || h === 'none') continue;
      const was = this.prev[h] || []; const now = gp.buttons.map(b => b.pressed); this.prev[h] = now;
      now.forEach((d, i) => { if (d && !was[i]) ev.push({ hand: h, button: i }); });
      const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0;
      const dir = x > 0.7 ? 1 : x < -0.7 ? -1 : 0;
      if (dir && this.stickLatch[h] !== dir) ev.push({ hand: h, stick: dir });
      this.stickLatch[h] = Math.abs(x) < 0.3 ? 0 : (dir || this.stickLatch[h]);
      const y = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0, dy = y > 0.7 ? 1 : y < -0.7 ? -1 : 0;
      if (dy && !dir && this.yLatch[h] !== dy) ev.push({ hand: h, stickY: dy });
      this.yLatch[h] = Math.abs(y) < 0.3 ? 0 : (dy || this.yLatch[h]);
    }
    return ev;
  }
}

// Fade to black around the head, for comfortable teleports.
export class Fade {
  constructor(camera) {
    this.m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    this.m.renderOrder = 999; this.m.visible = false; this.m.frustumCulled = false; camera.add(this.m);
    this.v = 0; this.to = 0; this.rate = 4; this.wait = null;
  }
  to1(rate, fn) { this.to = 1; this.rate = rate; this.wait = fn; }
  to0(rate) { this.to = 0; this.rate = rate; }
  // fade out, run fn while black, fade back in
  through(fn, out = 0.22, back = 0.4) { this.to1(1 / out, () => { fn(); this.to0(1 / back); }); }
  update(dt) {
    const d = this.to - this.v; this.v += Math.sign(d) * Math.min(Math.abs(d), dt * this.rate);
    this.m.material.opacity = this.v; this.m.visible = this.v > 0.002;
    if (this.v >= 1 && this.wait) { const f = this.wait; this.wait = null; f(); }
  }
}

// Head pose in tracking space: position and yaw (radians) of the camera inside the rig.
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
export function headLocal(camera) {
  _e.setFromQuaternion(camera.quaternion);
  return { p: camera.position.clone(), yaw: _e.y };
}
