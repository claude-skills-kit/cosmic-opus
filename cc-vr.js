// Cosmic Calendar — VR mode: the film plays on a big curved screen in a starfield (a "VR cinema").
// The story camera swings, shakes and dissolves; carried around a headset that makes people sick,
// so it stays on the screen. Each frame the film renders through its full post chain (bloom, grade,
// dissolves) mono at 1280×720 into an offscreen buffer, then the cinema is drawn in stereo around you.
import * as THREE from 'three';
import { xrSupported, startXR, fontsReady, Panel, wrap, roundRect, Pads, headLocal, FONT } from './vr-kit.js';

const FILM_W = 1280, FILM_H = 720;
const RADIUS = 5, ARC = 1.05, SCREEN_H = RADIUS * ARC * 9 / 16, SCREEN_Y = 1.6;   // ≈ 60° wide, 2.95 m tall
const INK = '#f5efe4', INK2 = '#c9c1b3', GOLD = '#e9c27a';

export function initCosmicVR({ stage, buttons, getCap, onEnter, onExit, onPlay, onChapter, onVO }) {
  const R = stage.renderer, composer = stage.composer;
  let session = null, built = false, cinema, rig, cam, screen, sub, pads = new Pads(), lastKey = '', placeIn = 0;
  const api = { active: false, filmH: FILM_H, present };

  xrSupported().then(ok => { if (ok) buttons.forEach(b => b.hidden = false); });
  buttons.forEach(b => b.addEventListener('click', enter));

  function build() {
    built = true;
    cinema = new THREE.Scene(); cinema.background = new THREE.Color(0x020205);
    rig = new THREE.Group(); cam = new THREE.PerspectiveCamera(70, 1, 0.05, 3000); rig.add(cam); cinema.add(rig);
    const tl = new THREE.TextureLoader();
    const skyT = tl.load('textures/milkyway.jpg'); skyT.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, color: 0x55555c, depthWrite: false }));
    sky.rotation.set(1.05, 0, 0.35); cinema.add(sky);
    // a dark floor disc with a faint gold rim keeps the room grounded
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.MeshBasicMaterial({ color: 0x07080c, transparent: true, opacity: 0.94 }));
    floor.rotation.x = -Math.PI / 2; cinema.add(floor);
    const rim = new THREE.Mesh(new THREE.RingGeometry(3.36, 3.42, 96), new THREE.MeshBasicMaterial({ color: 0xe9c27a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.002; cinema.add(rim);
    // the screen: inside face of a cylinder slice centred on -Z; u runs right→left from in here, so flip it
    screen = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, SCREEN_H, 72, 1, true, Math.PI - ARC / 2, ARC),
      new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { map: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        // the film buffer already holds tone-mapped, sRGB-encoded colour (OutputPass), so write it straight out
        fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor=vec4(texture2D(map,vec2(1.0-vUv.x,vUv.y)).rgb,1.0); }' }));
    screen.position.y = SCREEN_Y; cinema.add(screen);
    // subtitles sit across the lower edge of the screen, like a cinema
    sub = new Panel(3.6, 0.78, 520); sub.mesh.position.set(0, SCREEN_Y - SCREEN_H / 2 + 0.5, -RADIUS + 0.45); cinema.add(sub.mesh);
    for (let i = 0; i < 2; i++) {
      const c = R.xr.getController(i);
      c.addEventListener('selectstart', () => onPlay && onPlay());
      c.addEventListener('squeezestart', recenter);
      rig.add(c);
    }
  }

  async function enter() {
    if (session) return;
    onEnter && onEnter();               // runs inside the click: starts audio and the film
    await fontsReady();
    if (!built) build();
    composer.renderToScreen = false; composer.setPixelRatio(1); composer.setSize(FILM_W, FILM_H); stage.bloom.setSize(FILM_W, FILM_H);
    stage.camera.aspect = FILM_W / FILM_H; stage.camera.updateProjectionMatrix();
    R.xr.enabled = true;
    try { session = await startXR(R, { scale: 0.9, onEnd: leave }); }
    catch (e) { console.warn('XR', e); restore(); return; }
    api.active = true; placeIn = 3; lastKey = '';
  }
  function restore() {
    R.xr.enabled = false; composer.renderToScreen = true;
    composer.setPixelRatio(Math.min(2, devicePixelRatio)); stage.resize();
  }
  function leave() { session = null; api.active = false; restore(); onExit && onExit(); }

  function recenter() {
    const h = headLocal(cam), ry = -h.yaw, p = h.p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    rig.rotation.set(0, ry, 0); rig.position.set(-p.x, 0, -p.z);
  }

  function drawSub(c) {
    sub.draw((g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.35, 'rgba(0,0,0,.62)'); grad.addColorStop(1, 'rgba(0,0,0,.78)');
      g.fillStyle = grad; roundRect(g, 0, 0, W, H, 40); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (c.ending) {
        g.fillStyle = INK; g.font = `400 46px ${FONT.thai}`;
        wrap(g, c.ending, W * 0.86).slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 150 + i * 70));
        return;
      }
      g.fillStyle = GOLD; g.font = `400 26px ${FONT.mono}`; g.fillText(c.meta, W / 2, 96);
      g.fillStyle = INK; g.font = `500 64px ${FONT.thai}`; g.fillText(c.title, W / 2, 178);
      g.fillStyle = INK2; g.font = `400 36px ${FONT.sans}`;
      wrap(g, c.line, W * 0.84).slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 248 + i * 54));
      g.fillStyle = 'rgba(245,239,228,.42)'; g.font = `400 22px ${FONT.mono}`;
      g.fillText('ไกปืน เล่น / หยุด  ·  คันโยก เปลี่ยนบท  ·  ปุ่ม A เปิด/ปิดเสียงบรรยาย  ·  ปุ่มกำ จัดจอให้อยู่ตรงหน้า', W / 2, H - 26);
    });
  }

  function present() {
    // 1) the film, mono, offscreen; the XR camera must stay out of it
    const xrRT = R.getRenderTarget();
    R.xr.enabled = false; composer.render();
    R.setRenderTarget(xrRT); R.xr.enabled = true;
    screen.material.uniforms.map.value = composer.readBuffer.texture;
    // 2) subtitles and controls
    const c = getCap(), key = c.ending || c.key;
    if (key !== lastKey) { lastKey = key; drawSub(c); }
    sub.mesh.material.opacity = c.ending ? 1 : 0.25 + 0.75 * c.alpha;
    for (const e of pads.read(session)) {
      if (e.stick) onChapter && onChapter(e.stick);
      else if (e.button === 4) onVO && onVO();
      else if (e.button === 5) recenter();
    }
    if (placeIn > 0 && --placeIn === 0) recenter();
    // 3) the cinema, stereo
    R.render(cinema, cam);
  }
  return api;
}
