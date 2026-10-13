// Solar System Explorer — VR mode (WebXR, built for Meta Quest 2 and up).
// Overview: the whole system shrinks to a tabletop model in front of you (the rig is scaled 60×).
// Visit: fade-teleport to a body at life-like scale (1 unit = 1 m), with its narration and ambience.
// UI lives in tracking space under the rig: a waist-high dock that lazily follows your gaze and an info card.
import * as THREE from 'three';
import { xrSupported, startXR, fontsReady, Panel, wrap, roundRect, makePointers, aim, Pads, Fade, headLocal, FONT } from './vr-kit.js';
import { VO } from './solar-audio.js';

const TABLE = 60;                        // rig scale for the tabletop overview
const SPEED = { overview: 2, visit: 0.05 }; // days per second: orbits read in the model, bodies hold still to visit
const HOLD = 1.6;                        // seconds of quiet after each tour stop's narration
const INK = '#f1ebe0', INK2 = '#c5beb1', INK3 = '#8f897d', ACC = '#f4a95c', GLASS = 'rgba(12,14,20,0.86)';
const UP = new THREE.Vector3(0, 1, 0);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

export function initSolarVR({ scene, S, ORDER, audio, button, onEnter, onExit }) {
  const R = scene.renderer, rig = scene.rig, cam = scene.camera;
  let session = null, built = false, saved = null, placeIn = 0;
  let mode = 'overview', focus = null, prevP = new THREE.Vector3(), uiYaw = 0, uiFollow = false, uiPos = new THREE.Vector3();
  let fade, pointers, dock, card, labels = [], pads = new Pads(), hoverBtn = null, cardTimer = 0;
  const tour = { on: false, i: 0, t: 0, len: 0 };
  const steps = ['overview', ...ORDER];
  const items = () => scene.items;
  const itemOf = id => scene.items.find(i => i.b.id === id);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), hw = new THREE.Vector3();

  xrSupported().then(ok => { if (ok) button.hidden = false; });
  button.addEventListener('click', enter);

  async function enter() {
    if (session) return;
    audio.init();
    // an immersive session needs the click's user activation, so request it before awaiting anything slow
    const fonts = fontsReady();
    if (!fade) fade = new Fade(cam);
    fade.v = fade.to = 1; fade.update(0); // stay black until the model is placed
    saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), near: cam.near, speed: scene.speed, mode: scene.mode, focus: scene.focus };
    if (scene.mode !== 'map') scene.setMode('map');
    scene._tw = null; scene.controls.enabled = false;
    try { session = await startXR(R, { scale: 1.0, onEnd: leave }); }
    catch (e) { console.warn('XR', e); scene.controls.enabled = true; fade.v = fade.to = 0; fade.update(0); return; }
    cam.near = 0.05; cam.updateProjectionMatrix();
    await fonts; // labels and panels are drawn on canvases, so the Thai fonts must be in first
    if (!session) return; // the session already ended while the fonts were loading
    if (!built) build();
    dock.mesh.visible = card.mesh.visible = true;
    fade.v = fade.to = 1; // start black; the head pose only arrives with the first rendered XR frame
    placeIn = 3; mode = 'overview'; focus = null;
    onEnter && onEnter();
    scene.onXRFrame = dt => { try { frame(dt); } catch (e) { if (!frame.warned) { frame.warned = true; console.error('VR frame', e); } } };
  }

  function leave() {
    session = null; scene.onXRFrame = null; tourStop(); audio.stopVoice(); audio.focusBed(null);
    rig.position.set(0, 0, 0); rig.quaternion.identity(); rig.scale.setScalar(1);
    if (saved) { cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.near = saved.near; cam.updateProjectionMatrix(); scene.speed = saved.speed; }
    if (built) {
      labels.forEach(l => l.visible = false); dock.mesh.visible = card.mesh.visible = false;
      pointers.forEach(p => { p.dot.visible = false; p.hover = null; });
    }
    fade.v = fade.to = 0; fade.wait = null; fade.update(0);
    scene.focus = null; scene.controls.enabled = true; scene.resize();
    onExit && onExit(focus);
  }

  // ---------------- objects ----------------
  function build() {
    built = true;
    fade = fade || new Fade(cam);
    pointers = makePointers(R, rig, { onSelect });
    dock = new Panel(1.12, 0.3, 1100); rig.add(dock.mesh);
    card = new Panel(0.9, 0.56, 1100); rig.add(card.mesh);
    for (const it of items()) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.font = `500 64px ${FONT.thai}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 14; g.fillStyle = INK; g.fillText(it.b.th, 256, 66);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false }));
      sp.renderOrder = 25; sp.userData.it = it; sp.visible = false; scene.scene.add(sp); labels.push(sp);
    }
  }

  // ---------------- dock ----------------
  const BTN = [
    ['tour', 'ทัวร์นำชม'], ['overview', 'ภาพรวม'], ['sun'], ['mercury'], ['venus'], ['earth'], ['moon'],
    ['mars'], ['jupiter'], ['saturn'], ['uranus'], ['neptune'], ['sound', 'เสียง'], ['exit', 'ออกจาก VR']
  ];
  const COLS = 7;
  function btnRects(W, H) {
    const pad = 22, gap = 14, bw = (W - pad * 2 - gap * (COLS - 1)) / COLS, bh = (H - pad * 2 - gap) / 2;
    return BTN.map((b, i) => ({ key: b[0], label: b[1], x: pad + (i % COLS) * (bw + gap), y: pad + Math.floor(i / COLS) * (bh + gap), w: bw, h: bh }));
  }
  function drawDock() {
    dock.draw((g, W, H) => {
      g.fillStyle = GLASS; roundRect(g, 0, 0, W, H, 46); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 3; roundRect(g, 1.5, 1.5, W - 3, H - 3, 45); g.stroke();
      for (const r of btnRects(W, H)) {
        const b = S.byId(r.key), active = r.key === focus || (r.key === 'overview' && mode === 'overview' && !tour.on) || (r.key === 'tour' && tour.on) || (r.key === 'sound' && audio.on);
        const hot = hoverBtn === r.key;
        g.fillStyle = active ? 'rgba(244,169,92,.24)' : hot ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
        roundRect(g, r.x, r.y, r.w, r.h, 26); g.fill();
        if (active || hot) { g.strokeStyle = active ? ACC : 'rgba(255,255,255,.4)'; g.lineWidth = 3; roundRect(g, r.x, r.y, r.w, r.h, 26); g.stroke(); }
        const cx = r.x + r.w / 2;
        if (b) { // a little orb in the body's colour
          const gr = g.createRadialGradient(cx - 9, r.y + 46, 3, cx, r.y + 54, 24);
          gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, b.color); gr.addColorStop(1, 'rgba(0,0,0,.6)');
          g.fillStyle = gr; g.beginPath(); g.arc(cx, r.y + 54, b.id === 'sun' ? 26 : 20, 0, 7); g.fill();
        } else {
          g.fillStyle = active ? ACC : INK2; g.font = `500 40px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText({ tour: tour.on ? '■' : '▶', overview: '◎', sound: audio.on ? '♪' : '×', exit: '⏏' }[r.key], cx, r.y + 54);
        }
        g.fillStyle = active ? '#ffd7ad' : INK; g.font = `500 ${b ? 30 : 28}px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText(b ? b.th.replace(/^ดาว/, '') : r.label, cx, r.y + r.h - 22);
      }
    });
  }
  function dockHit(uv) {
    const [x, y] = dock.px(uv);
    return btnRects(dock.canvas.width, dock.canvas.height).find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }
  function pressDock(key) {
    audio.sfx('sol-select', 0.8);
    if (key === 'tour') return tour.on ? tourStop() : tourStart();
    if (key === 'overview') { tourStop(); return overview(true); }
    if (key === 'sound') { audio.setOn(!audio.on); return drawDock(); }
    if (key === 'exit') return session && session.end();
    tourStop(); visit(key, true);
  }

  // ---------------- info card ----------------
  function fmt(n, d = 0) { return n.toLocaleString('en-US', { maximumFractionDigits: d }); }
  function stats(b) {
    const day = h => Math.abs(h) >= 48 ? fmt(Math.abs(h) / 24, 1) + ' วัน' : fmt(Math.abs(h), 1) + ' ชม.';
    if (b.kind === 'star') return [['รัศมี', fmt(b.r_km) + ' กม.'], ['อุณหภูมิผิว', b.tempC.replace(/\s*\(.*\)/, '')]];
    if (b.kind === 'moon') return [['ห่างจากโลก', fmt(b.orbitKm) + ' กม.'], ['โคจรรอบโลก', fmt(b.orbitDays, 1) + ' วัน']];
    const y = S.periodYears(b.el.a[0]);
    return [['ห่างดวงอาทิตย์', fmt(b.el.a[0], 2) + ' AU'], ['หนึ่งวัน', day(b.rotHours)], ['หนึ่งปี', y < 1 ? fmt(y * 365.25, 0) + ' วัน' : fmt(y, 1) + ' ปี']];
  }
  function drawCard() {
    const b = focus && S.byId(focus), prog = audio.voiceProgress();
    card.draw((g, W, H) => {
      g.fillStyle = GLASS; roundRect(g, 0, 0, W, H, 40); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; roundRect(g, 1.5, 1.5, W - 3, H - 3, 39); g.stroke();
      const L = 56; let y = 84;
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      if (!b) {
        g.fillStyle = ACC; g.font = `500 30px ${FONT.mono}`; g.fillText('THE SOLAR SYSTEM · VR', L, y);
        g.fillStyle = INK; g.font = `500 84px ${FONT.thai}`; g.fillText('ระบบสุริยะ', L, y += 100);
        g.font = `400 36px ${FONT.sans}`; g.fillStyle = INK2;
        for (const line of ['ชี้ไปที่ดาว แล้วกดไกปืนเพื่อบินไปดูใกล้ ๆ', 'โยกคันโยกซ้าย / ขวา เพื่อไปดาวถัดไป', 'ปุ่ม A เริ่มหรือหยุดทัวร์ · ปุ่ม B กลับมาดูภาพรวม', 'ตำแหน่งดาวทุกดวงคำนวณจากวันที่จริง'])
          g.fillText(line, L, y += 62);
      } else {
        const idx = ORDER.indexOf(b.id);
        g.fillStyle = ACC; g.font = `500 34px ${FONT.sans}`;
        g.fillText(b.kind === 'star' ? 'ดาวฤกษ์ · ศูนย์กลางระบบ' : b.kind === 'moon' ? 'ดาวบริวารของโลก' : `ดาวเคราะห์ดวงที่ ${idx} จากดวงอาทิตย์`, L, y);
        g.fillStyle = INK; g.font = `500 92px ${FONT.thai}`; g.fillText(b.th, L, y += 108);
        const w = g.measureText(b.th).width; g.fillStyle = INK3; g.font = `400 34px ${FONT.mono}`; g.fillText(b.en.toUpperCase(), L + w + 28, y - 8);
        g.fillStyle = INK2; g.font = `400 40px ${FONT.sans}`;
        for (const line of wrap(g, b.tagline, W - L * 2).slice(0, 2)) g.fillText(line, L, y += 60);
        y += 44; const st = stats(b), cw = (W - L * 2) / st.length;
        st.forEach(([k, v], i) => { g.fillStyle = INK3; g.font = `400 32px ${FONT.sans}`; g.fillText(k, L + i * cw, y + 30);
          g.fillStyle = INK; g.font = `500 46px ${FONT.sans}`; g.fillText(v, L + i * cw, y + 88); });
      }
      if (prog >= 0) { // narration progress along the bottom edge
        g.fillStyle = 'rgba(255,255,255,.12)'; roundRect(g, L, H - 46, W - L * 2, 8, 4); g.fill();
        g.fillStyle = ACC; roundRect(g, L, H - 46, Math.max(8, (W - L * 2) * prog), 8, 4); g.fill();
      }
    });
  }

  // ---------------- placement ----------------
  // world yaw/position for the rig so the head (tracking pose h) sees world point E looking along fwd
  function placeRig(h, s, E, fwd) {
    const yawW = Math.atan2(-fwd.x, -fwd.z), ry = yawW - h.yaw;
    rig.scale.setScalar(s); rig.rotation.set(0, ry, 0);
    v1.copy(h.p).multiplyScalar(s).applyAxisAngle(UP, ry);
    rig.position.copy(E).sub(v1); rig.updateMatrixWorld(true);
  }
  function overview(narrate) {
    const go = () => {
      mode = 'overview'; focus = null; scene.focus = null; scene.speed = SPEED.overview;
      const h = headLocal(cam), f = new THREE.Vector3(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
      // put the Sun 2.3 m ahead and 0.45 m below the eyes, the whole system shrunk 60×
      const Q = h.p.clone().addScaledVector(f, 2.3); Q.y -= 0.45;
      rig.scale.setScalar(TABLE); rig.rotation.set(0, 0, 0); rig.position.copy(Q).multiplyScalar(-TABLE); rig.updateMatrixWorld(true);
      audio.focusBed(null); placeUI(true); drawDock(); drawCard();
      if (narrate) audio.narrate('overview'); else audio.stopVoice();
    };
    fade ? fade.through(go) : go();
  }
  function visit(id, narrate) {
    const it = itemOf(id); if (!it) return;
    audio.sfx('sol-whoosh', 0.9);
    fade.through(() => {
      mode = 'visit'; focus = id; scene.focus = id; scene.speed = SPEED.visit;
      const P = it.holder.position, b = it.b, dist = scene.radiusFor(b) * (b.id === 'saturn' ? 7 : b.kind === 'star' ? 4.2 : 5);
      let dir;
      if (P.lengthSq() > 1e-6) { dir = P.clone().multiplyScalar(-1).normalize().applyAxisAngle(UP, 1.05); dir.y = 0.26; dir.normalize(); }
      else dir = new THREE.Vector3(0.45, 0.3, 1).normalize();
      const E = P.clone().addScaledVector(dir, dist), fwd = P.clone().sub(E); fwd.y = 0; fwd.normalize();
      placeRig(headLocal(cam), 1, E, fwd); prevP.copy(P);
      audio.focusBed(id); placeUI(true); drawDock(); drawCard();
      if (narrate) audio.narrate(id); else audio.stopVoice();
    });
  }
  function placeUI(snap) {
    const h = headLocal(cam);
    if (snap) { uiYaw = h.yaw; uiPos.copy(h.p); }
  }
  function updateUI(dt) {
    const h = headLocal(cam), d = wrapA(h.yaw - uiYaw);
    if (Math.abs(d) > 0.8) uiFollow = true; else if (Math.abs(d) < 0.1) uiFollow = false;
    if (uiFollow) uiYaw += d * Math.min(1, dt * 2.5);
    uiPos.lerp(h.p, Math.min(1, dt * 2));
    const f = v1.set(-Math.sin(uiYaw), 0, -Math.cos(uiYaw)), r = v2.set(Math.cos(uiYaw), 0, -Math.sin(uiYaw));
    const eye = Math.max(0.9, uiPos.y);
    dock.mesh.position.copy(uiPos).addScaledVector(f, 0.62); dock.mesh.position.y = eye - 0.42;
    dock.mesh.rotation.set(-0.62, uiYaw, 0, 'YXZ');
    const side = mode === 'visit' ? 0.72 : 0.92;
    card.mesh.position.copy(uiPos).addScaledVector(f, 1.15).addScaledVector(r, side); card.mesh.position.y = eye + (mode === 'visit' ? 0.02 : 0.16);
    card.mesh.rotation.set(0, uiYaw + Math.atan2(-side, 1.15), 0, 'YXZ'); // face the head
  }

  // ---------------- tour ----------------
  function tourStart() { audio.sfx('sol-tour', 0.9); tour.on = true; tourGo(0); }
  function tourStop() { if (!tour.on) return; tour.on = false; drawDock(); }
  function tourGo(i) {
    if (i < 0) i = 0;
    if (i >= steps.length) { tourStop(); return overview(false); }
    tour.i = i; tour.t = 0; tour.len = (VO[steps[i]] || 10) + HOLD + 0.6; // + the teleport fade
    steps[i] === 'overview' ? overview(true) : visit(steps[i], true);
  }

  // ---------------- input ----------------
  function onSelect(p) {
    if (p.hover && p.hover.btn) return pressDock(p.hover.btn);
    if (p.hover && p.hover.it) { tourStop(); audio.sfx('sol-select', 0.6); visit(p.hover.it.b.id, true); }
  }
  function stepBody(d) {
    if (tour.on) return tourGo(tour.i + d);
    const i = ORDER.indexOf(focus), n = ORDER.length;
    visit(ORDER[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n], true);
  }
  function pickBody({ ray }) {
    let best = null, bestA = Infinity;
    for (const it of items()) {
      v1.subVectors(it.holder.position, ray.origin); const d = v1.length(); if (d < 1e-4) continue;
      const a = Math.acos(Math.min(1, v1.dot(ray.direction) / d));
      const tol = Math.max(Math.atan(scene.radiusFor(it.b) * 1.6 / d), 0.04);
      if (a < tol && a < bestA) { best = it; bestA = a; }
    }
    return best;
  }

  // ---------------- per frame ----------------
  function frame(dt) {
    if (placeIn > 0 && --placeIn === 0) overview(false);
    fade.update(dt);
    if (mode === 'visit' && focus) { // ride along with the body as it moves
      const P = itemOf(focus).holder.position; rig.position.add(v1.subVectors(P, prevP)); prevP.copy(P);
    }
    updateUI(dt);
    // labels: constant angular size, hidden for the body you are visiting
    cam.getWorldPosition(hw);
    for (const sp of labels) {
      const it = sp.userData.it, P = it.holder.position, d = hw.distanceTo(P);
      sp.visible = !(mode === 'visit' && it.b.id === focus) && !(mode === 'visit' && it.b.id === 'moon' && focus !== 'earth' && focus !== 'moon');
      const k = d * 0.05, ks = k / rig.scale.x; sp.scale.set(ks * 4, ks, 1); // sprite size is in view space (see solar-3d)
      sp.position.copy(P); sp.position.y += scene.radiusFor(it.b) * 1.5 + k * 0.6;
    }
    // pointers
    let newHover = null;
    for (const p of pointers) {
      if (!p.src) continue; const ray = aim(p);
      const hit = ray.intersectObject(dock.mesh, false)[0];
      p.hover = null; p.dot.visible = false;
      const s = rig.scale.x;
      if (hit) {
        const b = dockHit(hit.uv); p.hover = b ? { btn: b.key } : null; if (b) newHover = b.key;
        p.line.scale.z = hit.distance / s; p.dot.visible = true; p.dot.position.copy(rig.worldToLocal(v2.copy(hit.point)));
      } else {
        const it = pickBody(ray); p.hover = it ? { it } : null;
        p.line.scale.z = it ? Math.min(6, ray.ray.origin.distanceTo(it.holder.position) / s) : 3;
        if (it) { p.dot.visible = true; p.dot.position.copy(rig.worldToLocal(v2.copy(it.holder.position))); }
      }
      p.line.material.color.set(p.hover ? 0xffd2a0 : 0xffc084); p.line.material.opacity = p.hover ? 1 : 0.6;
    }
    if (newHover !== hoverBtn) { hoverBtn = newHover; drawDock(); }
    // buttons and sticks
    for (const e of pads.read(session)) {
      if (e.stick) stepBody(e.stick);
      else if (e.button === 4) tour.on ? tourStop() : tourStart();
      else if (e.button === 5) { tourStop(); overview(false); }
    }
    // tour clock: a fixed length per stop, so it still runs with the sound off
    if (tour.on && (tour.t += dt) >= tour.len) tourGo(tour.i + 1);
    if ((cardTimer += dt) > 0.25) { cardTimer = 0; if (audio.voiceProgress() >= 0 || card.lastProg >= 0) drawCard(); card.lastProg = audio.voiceProgress(); }
  }

  return { get active() { return !!session; } };
}
