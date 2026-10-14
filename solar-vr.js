// Solar System Explorer — VR mode (WebXR, built for Meta Quest 2 and up).
// Overview: the whole system shrinks to a tabletop model in front of you (the rig is scaled 60×).
// Visit: fade-teleport to a body at life-like scale (1 unit = 1 m). The card reads its lesson tab by tab and holds its quiz.
// Size line-up: every body at true relative size in a row (Earth 50 cm across), the Sun behind; the stick walks the row.
// Moon board: phases, eclipses and seasons on a big board, drawn by moon-lesson.js exactly as on the page.
// UI lives in tracking space under the rig: a waist-high dock that lazily follows your gaze, the card and the board.
import * as THREE from 'three';
import { vrOffered, startXR, fontsReady, Panel, wrap, roundRect, makePointers, aim, Pads, Fade, headLocal, FONT } from './vr-kit.js';
import { VO_TEXT } from './solar-audio.js';
import { LESSON_TEXT, TOUR_EN } from './solar-lessons.js';
import { drawPhases, drawEclipse, drawSeasons, moonAge, phaseInfo, dayOfYear, doyLabel, moonImage } from './moon-lesson.js';

const TABLE = 60;                        // rig scale for the tabletop overview
const SPEED = { overview: 2, visit: 0.05 }; // days per second: orbits read in the model, bodies hold still to visit
const HOLD = 1.6;                        // seconds of quiet after each tour stop's narration
const INK = '#f1ebe0', INK2 = '#c5beb1', INK3 = '#8f897d', ACC = '#f4a95c', OK = '#9ad3a4', BAD = '#f39b88', GLASS = 'rgba(12,14,20,0.86)';
const UP = new THREE.Vector3(0, 1, 0);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const TABS = [['ov', 'ภาพรวม'], ['in', 'โครงสร้าง'], ['at', 'บรรยากาศ'], ['mo', 'บริวาร'], ['mi', 'ภารกิจ'], ['fa', 'เกร็ด']];
// size line-up, smallest to largest at true relative size (Earth 50 cm across); the Sun stands behind the middle of the row
const LINE = ['moon', 'mercury', 'mars', 'venus', 'earth', 'neptune', 'uranus', 'saturn', 'jupiter', 'sun'];
const EARTH_D = 0.5;
const ML_TABS = [['phases', 'ข้างขึ้นข้างแรม'], ['eclipse', 'อุปราคา'], ['seasons', 'ฤดูกาล']];
const ML_MODES = [['solar', 'สุริยุปราคา'], ['lunar', 'จันทรุปราคา'], ['tilt', 'ทำไมไม่เกิดทุกเดือน']];
const TOOLS = [['tour', 'ทัวร์นำชม'], ['overview', 'ภาพรวม'], ['lineup', 'เทียบขนาด'], ['moonlesson', 'ดวงจันทร์'], ['quiz', 'แบบทดสอบ'], ['lang', 'เสียงบรรยาย'], ['sound', 'เสียง'], ['exit', 'ออกจาก VR']];
const DOCK_BODIES = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

export function initSolarVR({ scene, S, ORDER, audio, button, onEnter, onExit }) {
  const R = scene.renderer, rig = scene.rig, cam = scene.camera;
  let session = null, built = false, saved = null, placeIn = 0;
  let mode = 'overview', focus = null, prevP = new THREE.Vector3(), uiYaw = 0, uiFollow = false, uiPos = new THREE.Vector3();
  let fade, pointers, dock, card, board, bar, labels = [], pads = new Pads(), hover = null, boardTimer = 0;
  const tour = { on: false, i: 0, t: 0, len: 0 };
  const steps = ['overview', ...ORDER];
  const lesson = { on: false, tab: 'ov' };          // the card's lesson tab, and whether it reads on to the next by itself
  let quiz = null;                                   // {pool, i, right, picked, title, id} while the card shows a quiz
  const line = { i: LINE.indexOf('earth'), map: null };
  const ml = { tab: 'phases', age: 0, today: 0, doy: 1, mode: 'solar', play: false };
  const items = () => scene.items;
  const itemOf = id => scene.items.find(i => i.b.id === id);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), hw = new THREE.Vector3();

  vrOffered().then(ok => { if (ok) button.hidden = false; });
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
    dock.mesh.visible = card.mesh.visible = true; board.mesh.visible = false;
    fade.v = fade.to = 1; // start black; the head pose only arrives with the first rendered XR frame
    placeIn = 3; mode = 'overview'; focus = null; quiz = null; lesson.on = false;
    onEnter && onEnter();
    scene.onXRFrame = dt => { try { frame(dt); } catch (e) { if (!frame.warned) { frame.warned = true; console.error('VR frame', e); } } };
  }

  function leave() {
    session = null; scene.onXRFrame = null; tourStop(); lesson.on = false; quiz = null; ml.play = false;
    audio.stopVoice(); audio.focusBed(null); scene.setLineup(null);
    rig.position.set(0, 0, 0); rig.quaternion.identity(); rig.scale.setScalar(1);
    if (saved) { cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.near = saved.near; cam.updateProjectionMatrix(); scene.speed = saved.speed; }
    if (built) {
      labels.forEach(l => l.visible = false); dock.mesh.visible = card.mesh.visible = board.mesh.visible = false;
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
    dock = new Panel(1.3, 0.32, 1000); dock.name = 'dock'; rig.add(dock.mesh);
    card = new Panel(1.0, 0.7, 1100); card.name = 'card'; rig.add(card.mesh);
    board = new Panel(1.6, 1.0, 900); board.name = 'board'; rig.add(board.mesh);
    for (const p of [dock, card, board]) p.rects = [];
    // narration progress along the card's bottom edge: two thin quads, so the card never redraws to show it
    const track = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: false, depthWrite: false }));
    bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf4a95c, transparent: true, depthTest: false, depthWrite: false }));
    for (const m of [track, bar]) { m.renderOrder = 31; m.scale.set(0.88, 0.006, 1); m.position.set(0, -0.7 / 2 + 0.03, 0.001); card.mesh.add(m); }
    bar.userData.track = track;
    for (const it of items()) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.font = `500 64px ${FONT.thai}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 14; g.fillStyle = INK; g.fillText(it.b.th, 256, 66);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false }));
      sp.renderOrder = 25; sp.userData.it = it; sp.visible = false; scene.scene.add(sp); labels.push(sp);
    }
    const img = moonImage(); if (img && !img.complete) img.addEventListener('load', () => { if (mode === 'moon') drawBoard(); }, { once: true });
  }

  // ---------------- small drawing kit for the panels ----------------
  function btn(pn, g, key, r, label, { on = false, off = false, primary = false, size = 30, color } = {}) {
    const hot = hover === pn.name + ':' + key && !off;
    g.fillStyle = primary ? (hot ? '#ffc084' : ACC) : on ? 'rgba(244,169,92,.24)' : hot ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)';
    roundRect(g, r.x, r.y, r.w, r.h, Math.min(26, r.h / 2)); g.fill();
    if ((on || hot) && !primary) { g.strokeStyle = on ? ACC : 'rgba(255,255,255,.45)'; g.lineWidth = 3; roundRect(g, r.x, r.y, r.w, r.h, Math.min(26, r.h / 2)); g.stroke(); }
    g.fillStyle = color || (primary ? '#1c1206' : off ? 'rgba(241,235,224,.3)' : on ? '#ffd7ad' : INK); g.font = `500 ${size}px ${FONT.sans}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 2);
    pn.rects.push({ key, ...r, off });
  }
  function panelBg(g, W, H, rad = 40) {
    g.fillStyle = GLASS; roundRect(g, 0, 0, W, H, rad); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; roundRect(g, 1.5, 1.5, W - 3, H - 3, rad - 1); g.stroke();
  }
  function hitRect(pn, uv) { const [x, y] = pn.px(uv); return pn.rects.find(r => !r.off && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); }

  // ---------------- dock ----------------
  function dockRects(W, H) {
    const pad = 20, gap = 12, bh = (H - pad * 2 - gap) / 2, out = [];
    const row = (keys, y) => { const n = keys.length, bw = (W - pad * 2 - gap * (n - 1)) / n; keys.forEach((k, i) => out.push({ key: k, x: pad + i * (bw + gap), y, w: bw, h: bh })); };
    row(TOOLS.map(t => t[0]), pad); row(DOCK_BODIES, pad + bh + gap);
    return out;
  }
  function toolIcon(g, key, cx, cy, col) {
    g.strokeStyle = g.fillStyle = col; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    if (key === 'tour') { if (tour.on) g.rect(cx - 13, cy - 13, 26, 26); else { g.moveTo(cx - 11, cy - 16); g.lineTo(cx + 17, cy); g.lineTo(cx - 11, cy + 16); g.closePath(); } g.fill(); }
    else if (key === 'overview') { g.arc(cx, cy, 6, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx, cy, 24, 10, 0, 0, 7); g.stroke(); }
    else if (key === 'lineup') { for (const [x, r] of [[-20, 5], [-7, 8], [13, 13]]) { g.beginPath(); g.arc(cx + x, cy + 13 - r, r, 0, 7); g.fill(); } }
    else if (key === 'moonlesson') { g.arc(cx, cy, 17, 0, 7); g.fill(); g.fillStyle = 'rgba(12,14,20,1)'; g.beginPath(); g.arc(cx + 9, cy - 5, 15, 0, 7); g.fill(); }
    else if (key === 'quiz') { g.font = `600 40px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy + 2); }
    else if (key === 'lang') { g.font = `600 30px ${FONT.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(audio.lang === 'en' ? 'EN' : 'ไทย', cx, cy + 2); }
    else if (key === 'sound') { g.moveTo(cx - 18, cy - 7); g.lineTo(cx - 8, cy - 7); g.lineTo(cx + 3, cy - 16); g.lineTo(cx + 3, cy + 16); g.lineTo(cx - 8, cy + 7); g.lineTo(cx - 18, cy + 7); g.closePath(); g.fill();
      g.beginPath(); if (audio.on) { g.arc(cx + 6, cy, 12, -0.8, 0.8); } else { g.moveTo(cx + 9, cy - 8); g.lineTo(cx + 22, cy + 8); g.moveTo(cx + 22, cy - 8); g.lineTo(cx + 9, cy + 8); } g.stroke(); }
    else if (key === 'exit') { g.rect(cx - 18, cy - 14, 22, 28); g.stroke(); g.beginPath(); g.moveTo(cx - 2, cy); g.lineTo(cx + 22, cy); g.moveTo(cx + 13, cy - 9); g.lineTo(cx + 22, cy); g.lineTo(cx + 13, cy + 9); g.stroke(); }
  }
  function drawDock() {
    dock.rects = [];
    dock.draw((g, W, H) => {
      panelBg(g, W, H, 44);
      for (const r of dockRects(W, H)) {
        const b = S.byId(r.key);
        const active = b ? r.key === focus && mode === 'visit' : (r.key === 'tour' && tour.on) || (r.key === 'overview' && mode === 'overview' && !tour.on && !quiz)
          || (r.key === 'lineup' && mode === 'lineup') || (r.key === 'moonlesson' && mode === 'moon') || (r.key === 'quiz' && !!quiz) || (r.key === 'sound' && audio.on) || (r.key === 'lang' && audio.lang === 'en');
        const hot = hover === 'dock:' + r.key;
        g.fillStyle = active ? 'rgba(244,169,92,.24)' : hot ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
        roundRect(g, r.x, r.y, r.w, r.h, 24); g.fill();
        if (active || hot) { g.strokeStyle = active ? ACC : 'rgba(255,255,255,.4)'; g.lineWidth = 3; roundRect(g, r.x, r.y, r.w, r.h, 24); g.stroke(); }
        const cx = r.x + r.w / 2, cy = r.y + 50;
        if (b) { // a little orb in the body's colour
          const gr = g.createRadialGradient(cx - 8, cy - 8, 3, cx, cy, 22);
          gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, b.color); gr.addColorStop(1, 'rgba(0,0,0,.6)');
          g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, b.id === 'sun' ? 24 : 18, 0, 7); g.fill();
        } else toolIcon(g, r.key, cx, cy, active ? ACC : INK2);
        g.fillStyle = active ? '#ffd7ad' : INK; g.font = `500 ${b ? 26 : 25}px ${FONT.sans}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText(b ? b.th.replace(/^ดาว/, '') : TOOLS.find(t => t[0] === r.key)[1], cx, r.y + r.h - 18);
        dock.rects.push(r);
      }
    });
  }
  function pressDock(key) {
    audio.sfx('sol-select', 0.8);
    if (key === 'tour') return tour.on ? (tourStop(), drawDock()) : tourStart();
    if (key === 'overview') { tourStop(); return overview(true); }
    if (key === 'lineup') return mode === 'lineup' ? overview(false) : lineupStart();
    if (key === 'moonlesson') return mode === 'moon' ? overview(false) : moonStart();
    if (key === 'quiz') return quiz ? quizEnd() : quizStart(mode === 'visit' ? focus : null);
    if (key === 'lang') { audio.setLang(audio.lang === 'en' ? 'th' : 'en'); if (mode === 'visit' && lesson.tab === 'ov' && !tour.on) playTab('ov', false); if (tour.on) tourGo(tour.i); drawDock(); return drawCard(); }
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
  const kicker = b => b.kind === 'star' ? 'ดาวฤกษ์ · ศูนย์กลางระบบ' : b.kind === 'moon' ? 'ดาวบริวารของโลก' : `ดาวเคราะห์ดวงที่ ${ORDER.indexOf(b.id)} จากดวงอาทิตย์`;
  const hasTab = (id, t) => t === 'ov' ? !!VO_TEXT[id] : !!(LESSON_TEXT[id] && LESSON_TEXT[id][t]);
  const tabText = (id, t) => t === 'ov' ? (audio.lang === 'en' ? TOUR_EN[id] : VO_TEXT[id]) : LESSON_TEXT[id][t];
  function lines(g, text, x, y, maxW, lh, max) { const ls = wrap(g, text, maxW); ls.slice(0, max).forEach((l, i) => g.fillText(i === max - 1 && ls.length > max ? l + '…' : l, x, y + i * lh)); return Math.min(ls.length, max); }
  function drawCard() {
    card.rects = [];
    card.draw((g, W, H) => {
      panelBg(g, W, H, 40);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      if (quiz) return quizCard(g, W, H);
      if (mode === 'lineup') return lineupCard(g, W, H);
      const b = focus && S.byId(focus), L = 56; let y = 82;
      if (!b) {
        g.fillStyle = ACC; g.font = `500 30px ${FONT.mono}`; g.fillText('THE SOLAR SYSTEM · VR', L, y);
        g.fillStyle = INK; g.font = `500 84px ${FONT.thai}`; g.fillText('ระบบสุริยะ', L, y += 100);
        g.font = `400 34px ${FONT.sans}`; g.fillStyle = INK2;
        for (const s of ['ชี้ไปที่ดาว แล้วกดไกปืนเพื่อบินไปดูใกล้ ๆ', 'โยกคันโยกซ้าย / ขวา เพื่อไปดาวถัดไป', 'ปุ่ม A เริ่มหรือหยุดทัวร์ · ปุ่ม B กลับมาดูภาพรวม',
          'เมนูด้านล่าง: เทียบขนาด · ดวงจันทร์ · แบบทดสอบ', 'ตำแหน่งดาวทุกดวงคำนวณจากวันที่จริง'])
          g.fillText(s, L, y += 62);
        return;
      }
      g.fillStyle = ACC; g.font = `500 32px ${FONT.sans}`; g.fillText(kicker(b), L, y);
      g.fillStyle = INK; g.font = `500 84px ${FONT.thai}`; g.fillText(b.th, L, y += 96);
      const w = g.measureText(b.th).width; g.fillStyle = INK3; g.font = `400 32px ${FONT.mono}`; g.fillText(b.en.toUpperCase(), L + w + 26, y - 8);
      // lesson tabs: only the ones the narrator covers can be picked
      const cw = (W - L * 2 - 5 * 10) / 6;
      TABS.forEach(([k, l], i) => btn(card, g, 'tab:' + k, { x: L + i * (cw + 10), y: y + 30, w: cw, h: 58 }, l, { on: lesson.tab === k, off: !hasTab(b.id, k), size: 27 }));
      y += 150; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      if (lesson.tab === 'ov' && !tour.on) { // the overview tab keeps the key numbers under the tour line
        g.fillStyle = INK2; g.font = `400 36px ${FONT.sans}`; const n = lines(g, tabText(b.id, 'ov'), L, y, W - L * 2, 52, 4);
        const st = stats(b), cw2 = (W - L * 2) / st.length, sy = y + n * 52 + 22;
        st.forEach(([k, v], i) => { g.fillStyle = INK3; g.font = `400 28px ${FONT.sans}`; g.fillText(k, L + i * cw2, sy); g.fillStyle = INK; g.font = `500 40px ${FONT.sans}`; g.fillText(v, L + i * cw2, sy + 48); });
      } else { g.fillStyle = INK2; g.font = `400 36px ${FONT.sans}`; lines(g, tabText(b.id, lesson.tab), L, y, W - L * 2, 52, 6); }
      const by = H - 112, nq = (S.QUIZ[b.id] || []).length;
      btn(card, g, 'play', { x: L, y: by, w: 270, h: 62 }, lesson.on ? '■  หยุดบรรยาย' : '▶  ฟังทั้งบท', { primary: !lesson.on, on: lesson.on, size: 29 });
      if (nq) btn(card, g, 'quiz', { x: L + 290, y: by, w: 290, h: 62 }, `แบบทดสอบ · ${nq} ข้อ`, { size: 29 });
      g.fillStyle = INK3; g.font = `400 24px ${FONT.sans}`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText('คันโยก ขึ้น / ลง = เปลี่ยนแท็บ', W - L, by + 18); g.fillText('ซ้าย / ขวา = ดาวถัดไป', W - L, by + 48);
    });
  }
  function pressCard(key) {
    audio.sfx('sol-select', 0.6);
    if (key.startsWith('tab:')) { tourStop(); return playTab(key.slice(4), lesson.on); }
    if (key === 'play') { tourStop(); if (lesson.on) { lesson.on = false; audio.stopVoice(); return drawCard(); } return playTab(lesson.tab, true); }
    if (key === 'quiz') return quizStart(focus);
    if (key.startsWith('opt:')) return quizPick(+key.slice(4));
    if (key === 'next') return quizNext();
    if (key === 'retry') return quizStart(quiz && quiz.id);
    if (key === 'close') return quizEnd();
  }

  // ---------------- lesson tabs on the card ----------------
  function playTab(t, chain) {
    if (!focus || !hasTab(focus, t)) return;
    const id = focus; lesson.tab = t; lesson.on = !!chain;
    // lessons are Thai; the overview tab is the tour clip, in the tour language
    audio.narrate(t === 'ov' ? id : `${id}-${t}`, () => {
      if (!lesson.on || focus !== id || lesson.tab !== t) return;
      const order = TABS.map(x => x[0]), nx = order.slice(order.indexOf(t) + 1).find(k => hasTab(id, k));
      if (nx) playTab(nx, true); else { lesson.on = false; drawCard(); }
    }, 0, t === 'ov' ? audio.lang : 'th');
    drawCard();
  }
  function stepTab(d) {
    if (!focus) return; const order = TABS.map(x => x[0]).filter(k => hasTab(focus, k));
    const i = order.indexOf(lesson.tab) + d; if (i >= 0 && i < order.length) { tourStop(); playTab(order[i], lesson.on); }
  }

  // ---------------- quiz on the card ----------------
  function quizStart(id) {
    const pool = id ? (S.QUIZ[id] || []).map(q => ({ ...q, body: id }))
      : Object.entries(S.QUIZ).flatMap(([k, v]) => v.map(q => ({ ...q, body: k }))).sort(() => Math.random() - 0.5).slice(0, 5);
    if (!pool.length) return;
    tourStop(); lesson.on = false; audio.stopVoice();
    if (mode === 'moon') { mode = 'overview'; ml.play = false; board.mesh.visible = false; card.mesh.visible = true; } // the card holds the quiz
    quiz = { pool, i: 0, right: 0, picked: -1, id, title: id ? S.byId(id).th : 'รวมทุกดาว' };
    drawCard(); drawDock();
  }
  function quizPick(j) {
    if (!quiz || quiz.picked >= 0 || quiz.i >= quiz.pool.length) return;
    const q = quiz.pool[quiz.i]; quiz.picked = j; if (j === q.c) quiz.right++;
    audio.sfx(j === q.c ? 'sol-right' : 'sol-wrong', 0.8); drawCard();
  }
  function quizNext() { if (!quiz || quiz.picked < 0) return; quiz.i++; quiz.picked = -1; drawCard(); }
  function quizEnd() { quiz = null; drawCard(); drawDock(); }
  function quizCard(g, W, H) {
    const L = 56, n = quiz.pool.length;
    g.fillStyle = ACC; g.font = `500 32px ${FONT.sans}`; g.fillText('แบบทดสอบ · ' + quiz.title, L, 74);
    btn(card, g, 'close', { x: W - L - 64, y: 34, w: 64, h: 56 }, '✕', { size: 30 });
    if (quiz.i >= n) { // result
      const pct = quiz.right / n;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = INK; g.font = `500 120px ${FONT.thai}`; g.fillText(`${quiz.right}/${n}`, L, 250);
      g.font = `500 46px ${FONT.sans}`; g.fillText(pct === 1 ? 'เยี่ยมมาก ตอบถูกทุกข้อ' : pct >= 0.7 ? 'เก่งมาก เข้าใจเนื้อหาส่วนใหญ่แล้ว' : pct >= 0.4 ? 'ใกล้แล้ว ลองฟังบทเรียนอีกนิด' : 'ลองกลับไปฟังบทเรียนแล้วทำใหม่', L, 340);
      btn(card, g, 'retry', { x: L, y: H - 140, w: 260, h: 66 }, 'ทำใหม่', { primary: true, size: 32 });
      btn(card, g, 'close', { x: L + 280, y: H - 140, w: 260, h: 66 }, 'ปิด', { size: 32 });
      return;
    }
    const q = quiz.pool[quiz.i], b = S.byId(q.body);
    g.textAlign = 'right'; g.fillStyle = INK3; g.font = `400 28px ${FONT.mono}`; g.fillText(`ข้อ ${quiz.i + 1}/${n} · ถูก ${quiz.right}`, W - L - 84, 74);
    g.textAlign = 'left'; g.fillStyle = INK; g.font = `500 42px ${FONT.sans}`;
    const nl = lines(g, (quiz.id ? '' : b.th + ': ') + q.q, L, 140, W - L * 2, 56, 3);
    let y = 140 + (nl - 1) * 56 + 34;
    q.a.forEach((a, j) => {
      const r = { x: L, y, w: W - L * 2, h: 66 }, done = quiz.picked >= 0, right = j === q.c, mine = j === quiz.picked;
      const col = done && right ? OK : done && mine ? BAD : null;
      btn(card, g, 'opt:' + j, r, '', { off: done });
      if (col) { g.strokeStyle = col; g.lineWidth = 4; roundRect(g, r.x, r.y, r.w, r.h, 26); g.stroke(); g.fillStyle = col === OK ? 'rgba(154,211,164,.16)' : 'rgba(243,155,136,.16)'; roundRect(g, r.x, r.y, r.w, r.h, 26); g.fill(); }
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = col || (done ? 'rgba(241,235,224,.45)' : INK); g.font = `500 30px ${FONT.mono}`; g.fillText(String(j + 1), r.x + 26, r.y + r.h / 2 + 2);
      g.font = `400 32px ${FONT.sans}`; g.fillText(wrap(g, a, r.w - 100)[0], r.x + 72, r.y + r.h / 2 + 2);
      y += 76;
    });
    if (quiz.picked >= 0) {
      const ok = quiz.picked === q.c; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillStyle = ok ? OK : BAD; g.font = `500 30px ${FONT.sans}`; g.fillText(ok ? 'ถูกต้อง' : 'ยังไม่ถูก', L, y + 30);
      g.fillStyle = INK2; g.font = `400 28px ${FONT.sans}`; lines(g, q.e, L + 140, y + 30, W - L * 2 - 140 - 250, 38, 3);
      btn(card, g, 'next', { x: W - L - 230, y: y + 2, w: 230, h: 62 }, quiz.i + 1 < n ? 'ข้อถัดไป' : 'ดูผล', { primary: true, size: 30 });
    }
  }

  // ---------------- size line-up ----------------
  function lineupMap() {
    const k = EARTH_D / 2 / 6371, map = {}; let x = 0, prev = 0;
    for (const id of LINE) {
      if (id === 'sun') continue;
      const b = S.byId(id), r = b.r_km * k, reach = id === 'saturn' ? r * 2.33 : r;
      if (prev) x += prev + reach + (reach > 0.5 ? 1.4 : 0.7);
      map[id] = { p: new THREE.Vector3(x, 0, 0), r, reach }; prev = reach;
    }
    const rs = S.byId('sun').r_km * k, mid = (map.moon.p.x + map.jupiter.p.x) / 2;
    map.sun = { p: new THREE.Vector3(mid, 0, -(rs + 14)), r: rs, reach: rs };
    return map;
  }
  function lineupStart() {
    tourStop(); quiz = null; lesson.on = false;
    fade.through(() => {
      board.mesh.visible = false; card.mesh.visible = true;
      line.map = line.map || lineupMap(); scene.setLineup(line.map, new THREE.Vector3(line.map.sun.p.x - 260, 190, 330));
      mode = 'lineup'; focus = null; scene.focus = null; scene.speed = SPEED.visit; audio.focusBed(null);
      line.i = LINE.indexOf('earth'); station(line.i);
      audio.narrate('x-size', null, 0, 'th');
    });
    drawDock();
  }
  function station(i) {
    line.i = Math.max(0, Math.min(LINE.length - 1, i));
    const L = line.map[LINE[line.i]], d = LINE[line.i] === 'sun' ? L.r * 2.3 : Math.max(0.85, L.reach * 2.4 + 0.3);
    placeRig(headLocal(cam), 1, v1.set(L.p.x, L.p.y, L.p.z + d).clone(), new THREE.Vector3(0, 0, -1));
    placeUI(true); drawCard(); drawDock();
  }
  function lineupStep(d) { const i = Math.max(0, Math.min(LINE.length - 1, line.i + d)); if (i === line.i) return; audio.sfx('sol-whoosh', 0.6); fade.through(() => station(i)); }
  function lineupExit() { if (mode !== 'lineup') return; scene.setLineup(null); }
  function lineupCard(g, W, H) {
    const id = LINE[line.i], b = S.byId(id), L = 56, d = b.r_km * 2, ratio = b.r_km / 6371;
    g.fillStyle = ACC; g.font = `500 30px ${FONT.sans}`; g.fillText(`เทียบขนาดตามจริง · ${line.i + 1} / ${LINE.length} · โลกกว้าง 50 ซม.`, L, 78);
    g.fillStyle = INK; g.font = `500 84px ${FONT.thai}`; g.fillText(b.th, L, 178);
    const here = d * EARTH_D / 12742, hereTxt = here >= 1 ? fmt(here, 1) + ' เมตร' : fmt(here * 100, 0) + ' ซม.';
    const st = [['เส้นผ่านศูนย์กลาง', fmt(d) + ' กม.'], ['เทียบกับโลก', id === 'earth' ? 'ขนาดอ้างอิง' : ratio >= 1 ? `กว้าง ${fmt(ratio, ratio < 10 ? 1 : 0)} เท่า` : `${fmt(ratio * 100, 0)}% ของโลก`], ['ในแถวนี้กว้าง', hereTxt]];
    const cw = (W - L * 2) / 3;
    st.forEach(([k, v], i) => { g.fillStyle = INK3; g.font = `400 28px ${FONT.sans}`; g.fillText(k, L + i * cw, 270); g.fillStyle = INK; g.font = `500 42px ${FONT.sans}`; g.fillText(v, L + i * cw, 322); });
    g.fillStyle = INK2; g.font = `400 34px ${FONT.sans}`; lines(g, b.tagline, L, 410, W - L * 2, 50, 2);
    g.fillStyle = INK3; g.font = `400 28px ${FONT.sans}`;
    ['โยกคันโยก ซ้าย / ขวา เพื่อเดินไปตามแถว', 'ชี้ดาวแล้วกดไกปืนเพื่อไปยืนหน้าดาวดวงนั้น · ปุ่ม B กลับภาพรวม'].forEach((s, i) => g.fillText(s, L, H - 130 + i * 44));
  }

  // ---------------- moon / eclipse / seasons board ----------------
  function moonStart() {
    tourStop(); quiz = null; lesson.on = false;
    ml.today = moonAge(); ml.age = ml.today; ml.doy = dayOfYear(new Date()); ml.play = false;
    fade.through(() => { // the tabletop stays behind the board
      tableTop(); mode = 'moon'; board.mesh.visible = true; card.mesh.visible = false; placeUI(true);
      mlTab(ml.tab); drawDock();
    });
  }
  function mlTab(t) { ml.tab = t; ml.play = false; audio.narrate('x-' + t, () => drawBoard(), 0, 'th'); drawBoard(); }
  function mlStep(d) {
    if (ml.tab === 'phases') ml.age = ((ml.age + d) % 29.5 + 29.5) % 29.5;
    else if (ml.tab === 'seasons') ml.doy = ((Math.round(ml.doy) - 1 + d * 15) % 365 + 365) % 365 + 1;
    else { const i = ML_MODES.findIndex(m => m[0] === ml.mode); ml.mode = ML_MODES[(i + d + 3) % 3][0]; }
    drawBoard();
  }
  function drawBoard() {
    board.rects = [];
    board.draw((g, W, H) => {
      panelBg(g, W, H, 44);
      ML_TABS.forEach(([k, l], i) => btn(board, g, 'ml:' + k, { x: 40 + i * 270, y: 26, w: 256, h: 60 }, l, { on: ml.tab === k, size: 30 }));
      btn(board, g, 'ml-close', { x: W - 104, y: 26, w: 64, h: 60 }, '✕', { size: 30 });
      const say = audio.voiceId === 'x-' + ml.tab;
      btn(board, g, 'ml-say', { x: W - 400, y: 26, w: 280, h: 60 }, say ? '■  หยุดบรรยาย' : '▶  ฟังบรรยาย', { on: say, size: 28 });
      g.save(); g.translate(40, 104); g.beginPath(); g.rect(0, 0, W - 80, H - 262); g.clip();
      const dw = W - 80, dh = H - 262;
      if (ml.tab === 'phases') drawPhases(g, dw, dh, { age: ml.age, today: ml.today });
      else if (ml.tab === 'eclipse') drawEclipse(g, dw, dh, { mode: ml.mode });
      else drawSeasons(g, dw, dh, { doy: Math.round(ml.doy) });
      g.restore();
      const y = H - 148;
      if (ml.tab === 'eclipse') ML_MODES.forEach(([k, l], i) => btn(board, g, 'ml-mode:' + k, { x: 40 + i * 330, y, w: 316, h: 64 }, l, { on: ml.mode === k, size: 30 }));
      else {
        const step = ml.tab === 'phases' ? '1 วัน' : '15 วัน';
        btn(board, g, 'ml-prev', { x: 40, y, w: 180, h: 64 }, '◀  ' + step, { size: 28 });
        btn(board, g, 'ml-play', { x: 236, y, w: 180, h: 64 }, ml.play ? '■  หยุด' : '▶  เล่น', { primary: !ml.play, on: ml.play, size: 28 });
        btn(board, g, 'ml-next', { x: 432, y, w: 180, h: 64 }, step + '  ▶', { size: 28 });
        btn(board, g, 'ml-now', { x: 628, y, w: 180, h: 64 }, ml.tab === 'phases' ? 'คืนนี้' : 'วันนี้', { size: 28 });
        g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = INK2; g.font = `400 28px ${FONT.sans}`;
        g.fillText(ml.tab === 'phases' ? `${phaseInfo(ml.age).name} · ${phaseInfo(ml.age).day}` : doyLabel(Math.round(ml.doy)), 836, y + 33);
      }
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = INK3; g.font = `400 24px ${FONT.sans}`;
      g.fillText('คันโยก ซ้าย / ขวา = เลื่อน · ขึ้น / ลง = เปลี่ยนหัวข้อ · ปุ่ม B ปิด', 44, H - 40);
    });
  }
  function pressBoard(key) {
    audio.sfx('sol-select', 0.6);
    if (key.startsWith('ml:')) return mlTab(key.slice(3));
    if (key.startsWith('ml-mode:')) { ml.mode = key.slice(8); return drawBoard(); }
    if (key === 'ml-close') return overview(false);
    if (key === 'ml-say') { audio.voiceId === 'x-' + ml.tab ? audio.stopVoice() : audio.narrate('x-' + ml.tab, () => drawBoard(), 0, 'th'); return drawBoard(); }
    if (key === 'ml-prev') { ml.play = false; return mlStep(-1); }
    if (key === 'ml-next') { ml.play = false; return mlStep(1); }
    if (key === 'ml-play') { ml.play = !ml.play; boardTimer = 0; return drawBoard(); }
    if (key === 'ml-now') { ml.play = false; if (ml.tab === 'phases') ml.age = ml.today; else ml.doy = dayOfYear(new Date()); return drawBoard(); }
  }

  // ---------------- placement ----------------
  // world yaw/position for the rig so the head (tracking pose h) sees world point E looking along fwd
  function placeRig(h, s, E, fwd) {
    const yawW = Math.atan2(-fwd.x, -fwd.z), ry = yawW - h.yaw;
    rig.scale.setScalar(s); rig.rotation.set(0, ry, 0);
    v1.copy(h.p).multiplyScalar(s).applyAxisAngle(UP, ry);
    rig.position.copy(E).sub(v1); rig.updateMatrixWorld(true);
  }
  // the whole system shrunk 60× onto a table: the Sun 2.3 m ahead and 0.45 m below the eyes
  function tableTop() {
    lineupExit(); board.mesh.visible = false; card.mesh.visible = true; ml.play = false;
    mode = 'overview'; focus = null; scene.focus = null; scene.speed = SPEED.overview; lesson.on = false;
    const h = headLocal(cam), f = new THREE.Vector3(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
    const Q = h.p.clone().addScaledVector(f, 2.3); Q.y -= 0.45;
    rig.scale.setScalar(TABLE); rig.rotation.set(0, 0, 0); rig.position.copy(Q).multiplyScalar(-TABLE); rig.updateMatrixWorld(true);
    audio.focusBed(null); placeUI(true);
  }
  function overview(narrate) {
    const go = () => { tableTop(); drawDock(); drawCard(); if (narrate) audio.narrate('overview'); else audio.stopVoice(); };
    fade ? fade.through(go) : go();
  }
  function visit(id, narrate) {
    const it = itemOf(id); if (!it) return;
    audio.sfx('sol-whoosh', 0.9); quiz = null;
    fade.through(() => {
      lineupExit(); board.mesh.visible = false; card.mesh.visible = true; ml.play = false;
      mode = 'visit'; focus = id; scene.focus = id; scene.speed = SPEED.visit; lesson.tab = 'ov'; lesson.on = false;
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
    const side = mode === 'visit' || mode === 'lineup' ? 0.74 : 0.94;
    card.mesh.position.copy(uiPos).addScaledVector(f, 1.18).addScaledVector(r, side); card.mesh.position.y = eye + (mode === 'overview' ? 0.18 : 0.1);
    card.mesh.rotation.set(0, uiYaw + Math.atan2(-side, 1.18), 0, 'YXZ'); // face the head
    board.mesh.position.copy(uiPos).addScaledVector(f, 1.6); board.mesh.position.y = eye + 0.24;
    board.mesh.rotation.set(0, uiYaw, 0, 'YXZ');
  }

  // ---------------- tour ----------------
  function tourStart() { audio.sfx('sol-tour', 0.9); quiz = null; lesson.on = false; tour.on = true; tourGo(0); }
  function tourStop() { if (!tour.on) return; tour.on = false; drawDock(); }
  function tourGo(i) {
    if (i < 0) i = 0;
    if (i >= steps.length) { tourStop(); return overview(false); }
    tour.i = i; tour.t = 0; tour.len = (audio.clipDur(steps[i]) || 10) + HOLD + 0.6; // + the teleport fade
    steps[i] === 'overview' ? overview(true) : visit(steps[i], true);
  }

  // ---------------- input ----------------
  function onSelect(p) {
    if (!p.hover) return;
    if (p.hover.pn) return p.hover.pn === dock ? pressDock(p.hover.key) : p.hover.pn === card ? pressCard(p.hover.key) : pressBoard(p.hover.key);
    if (p.hover.it) {
      const id = p.hover.it.b.id; audio.sfx('sol-select', 0.6);
      if (mode === 'lineup') { const i = LINE.indexOf(id); if (i >= 0 && i !== line.i) { audio.sfx('sol-whoosh', 0.6); fade.through(() => station(i)); } return; }
      tourStop(); visit(id, true);
    }
  }
  function stepBody(d) {
    if (tour.on) return tourGo(tour.i + d);
    const i = ORDER.indexOf(focus), n = ORDER.length;
    visit(ORDER[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n], true);
  }
  function back() { // B button: one step out
    if (quiz) return quizEnd();
    tourStop(); overview(false);
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
    // labels: constant angular size, hidden for the body you are visiting and on the moon board
    cam.getWorldPosition(hw);
    for (const sp of labels) {
      const it = sp.userData.it, P = it.holder.position, d = hw.distanceTo(P);
      sp.visible = mode !== 'moon' && !(mode === 'visit' && it.b.id === focus) && !(mode === 'visit' && it.b.id === 'moon' && focus !== 'earth' && focus !== 'moon');
      const k = d * 0.05, ks = k / rig.scale.x; sp.scale.set(ks * 4, ks, 1); // sprite size is in view space (see solar-3d)
      sp.position.copy(P); sp.position.y += scene.radiusFor(it.b) * 1.5 + k * 0.6;
    }
    // pointers: the nearest panel under the ray wins, otherwise a body
    let newHover = null;
    const uis = [dock, card, board].filter(p => p.mesh.visible);
    for (const p of pointers) {
      if (!p.src) continue; const ray = aim(p);
      let best = null;
      for (const pn of uis) { const hit = ray.intersectObject(pn.mesh, false)[0]; if (hit && (!best || hit.distance < best.hit.distance)) best = { pn, hit }; }
      p.hover = null; p.dot.visible = false;
      const s = rig.scale.x;
      if (best) {
        const r = hitRect(best.pn, best.hit.uv); if (r) { p.hover = { pn: best.pn, key: r.key }; newHover = best.pn.name + ':' + r.key; }
        p.line.scale.z = best.hit.distance / s; p.dot.visible = true; p.dot.position.copy(rig.worldToLocal(v2.copy(best.hit.point)));
      } else if (mode !== 'moon') {
        const it = pickBody(ray); p.hover = it ? { it } : null;
        p.line.scale.z = it ? Math.min(6, ray.ray.origin.distanceTo(it.holder.position) / s) : 3;
        if (it) { p.dot.visible = true; p.dot.position.copy(rig.worldToLocal(v2.copy(it.holder.position))); }
      } else p.line.scale.z = 3;
      p.line.material.color.set(p.hover ? 0xffd2a0 : 0xffc084); p.line.material.opacity = p.hover ? 1 : 0.6;
    }
    if (newHover !== hover) {
      const was = hover; hover = newHover; const touched = n => (was && was.startsWith(n + ':')) || (hover && hover.startsWith(n + ':'));
      if (touched('dock')) drawDock(); if (touched('card')) drawCard(); if (touched('board')) drawBoard();
    }
    // buttons and sticks
    for (const e of pads.read(session)) {
      if (e.stick) mode === 'lineup' ? lineupStep(e.stick) : mode === 'moon' ? (ml.play = false, mlStep(e.stick)) : stepBody(e.stick);
      else if (e.stickY) { if (mode === 'moon') { const i = ML_TABS.findIndex(t => t[0] === ml.tab); mlTab(ML_TABS[(i + e.stickY + 3) % 3][0]); } else if (mode === 'visit' && !quiz) stepTab(e.stickY); }
      else if (e.button === 4) tour.on ? tourStop() : tourStart();
      else if (e.button === 5) back();
    }
    // tour clock: a fixed length per stop, so it still runs with the sound off
    if (tour.on && (tour.t += dt) >= tour.len) tourGo(tour.i + 1);
    // the board animates in steps a few times a second, so its big texture isn't re-sent every frame
    if (mode === 'moon' && ml.play && (boardTimer += dt) > 0.25) { boardTimer = 0; mlStep(ml.tab === 'phases' ? 0.6 : 0.4); }
    const pr = audio.voiceProgress(), show = pr >= 0 && card.mesh.visible;
    bar.visible = bar.userData.track.visible = show;
    if (show) { const w = 0.88 * Math.max(0.002, pr); bar.scale.x = w; bar.position.x = -0.44 + w / 2; }
  }

  // test handle: panels and state, read-only for automated checks
  const test = { line, ml, lesson, tourState: tour, get dock() { return dock; }, get card() { return card; }, get board() { return board; },
    get mode() { return mode; }, get focus() { return focus; }, get quiz() { return quiz; }, get hover() { return hover; } };
  return { get active() { return !!session; }, test };
}
