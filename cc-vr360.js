// Cosmic Calendar — VR 360°: you stand inside each scene instead of watching it on a screen.
// The story camera's path still carries you (it moves you, it never turns you) and your head looks around freely.
// The scene is re-aimed only behind a short blink at a cut, so the world never rotates around you.
// The eyes are placed by hand rather than under a scaled camera rig (which would break point sizes, sprites and the far
// plane): each eye sits at the story camera plus your real head offset × f, where f, in world units per real metre, sets
// how vast a scene feels. Both eyes render into one HDR buffer, as the film does; a light bloom and the film's grade
// (ACES, sRGB) carry it into the headset, and the text panels go on top. The buffer's resolution follows the frame rate.
import * as THREE from 'three';
import { GU, NOISE, SAFE } from './cc19-core.js';
import { Panel, FONT } from './vr-kit.js';

const V3 = THREE.Vector3, ONE = new V3(1, 1, 1), UP = new V3(0, 1, 0);
const FADE_OUT = 0.28, FADE_IN = 0.5;          // the blink at a cut, seconds
const BLINK_TURN = 30 * Math.PI / 180;           // a join that would swing the subject further than this blinks too
const RES_MAX = 0.8, RES_MIN = 0.36;             // HDR buffer scale against the headset's framebuffer
const FLASH_MAX = 0.6;                           // whole-view flashes are capped: in a headset they fill your eyes
const LOOK_CUE = 55 * Math.PI / 180;             // a chevron points at the story's subject once it drifts this far off
const INK = '#f5efe4', INK2 = '#a8a194', GOLD = '#e9c27a';
// Per scene, or per shot when a scene has cuts:
//   f      world units per real metre: small makes a scene feel vast, larger gives near things stereo depth
//   m      share of the story camera's travel you ride (1 all of it; less for the long fly-throughs)
//   res    cap on the HDR buffer scale, for the heaviest pixel shaders
//   blink  always blink into this shot, even from a join
//   ground stand on the Moon: a level regolith plain at your real floor replaces the lunar sphere
//   patch  a change to the scene, made after its own update each frame (the film resets it the next)
const SHOT = {
  bigbang: { f: 0.1 }, cmb: { f: 0.1, res: 0.6 }, stars: { f: 0.1, m: 0.6 }, supernova: { f: 0.15 },
  galaxy: { f: 0.2 }, blackhole: { f: 0.2, res: 0.42 }, sunbirth: { f: 0.2 }, disk: { f: 0.2 }, solar: { f: 0.2 },
  theia: { f: 0.015 }, bombardment: { f: 0.015 }, firstlife: [{ f: 0.015, m: 0.55, blink: true }, { f: 0.3 }],
  oxygen: { f: 0.015 }, snowball: { f: 0.015 }, cambrian: { f: 0.015 }, dinosaurs: { f: 0.015 },
  humans: { f: 0.015 }, civilization: { f: 0.015 }, spaceage: { f: 0.015 }, gagarin: { f: 0.015 },
  moon: { f: 0.002, ground: true }, voyager: { f: 0.2 },
  // the film frames the dot with a long lens; at a headset's true angles it would be a speck you can't find
  paleblue: { f: 0.015, patch: o => o.group.children[0].scale.multiplyScalar(2.2) }
};
const cutsOf = s => s.obj.cuts || [];
const cutIndex = (s, l0) => cutsOf(s).filter(ct => l0 >= ct).length;
const shotStart = (s, c) => c ? cutsOf(s)[c - 1] : 0;
const shotEnd = (s, c) => c < cutsOf(s).length ? cutsOf(s)[c] : s.d0;
function cfgOf(s, c) { const v = SHOT[s.id] || {}; return { f: 0.05, m: 1, res: RES_MAX, ...(Array.isArray(v) ? v[Math.min(c, v.length - 1)] : v) }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- post passes
const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FS = SAFE + `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 tap(vec2 o){ vec3 c = texture2D(tSrc, vUv + o * uTexel).rgb; return badv(c) ? vec3(0.0) : clamp(c, 0.0, 60.0); }
void main(){ vec3 c = 0.25 * (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)));
  float v = dot(c, vec3(0.299, 0.587, 0.114)); gl_FragColor = vec4(c * smoothstep(0.82, 1.1, v), 1.0); }`;
const DOWN_FS = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){ gl_FragColor = vec4(0.25 * (texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb
  + texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb), 1.0); }`;
// a 9-tap Gaussian from 5 linear taps; each eye's side of the buffer is blurred on its own (uSplit: where the right eye starts)
const BLUR_FS = `uniform sampler2D tSrc; uniform vec2 uDir; uniform float uHalf, uSplit; varying vec2 vUv;
vec3 tap(vec2 uv){ bool l = vUv.x < uSplit; uv.x = clamp(uv.x, (l ? 0.0 : uSplit) + uHalf, (l ? uSplit : 1.0) - uHalf); return texture2D(tSrc, uv).rgb; }
void main(){ vec3 c = tap(vUv) * 0.2270270270;
  c += (tap(vUv + uDir * 1.3846153846) + tap(vUv - uDir * 1.3846153846)) * 0.3162162162;
  c += (tap(vUv + uDir * 3.2307692308) + tap(vUv - uDir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0); }`;
// drawn once per eye through the headset's own cameras: the film's grade, then three's ACES and sRGB, as OutputPass does
const COMP_VS = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COMP_FS = SAFE + `uniform sampler2D tScene, tBloomA, tBloomB; uniform vec2 uFb; uniform float uFade, uFlash, uBloom; uniform vec3 uTint;
void main(){ vec2 uv = gl_FragCoord.xy / uFb; vec3 col = texture2D(tScene, uv).rgb; col = badv(col) ? vec3(0.0) : clamp(col, 0.0, 4000.0);
  col += (texture2D(tBloomA, uv).rgb * 0.7 + texture2D(tBloomB, uv).rgb * 0.9) * uBloom;
  col *= uTint;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col * vec3(0.94, 0.98, 1.08), col, smoothstep(0.0, 0.25, lum));
  col = mix(col, col * vec3(1.04, 1.0, 0.93), smoothstep(0.4, 1.0, lum) * 0.4);
  gl_FragColor = vec4(max(col * uFade + vec3(uFlash), vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const postMat = (fs, uniforms, vs = POST_VS) => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

// ---------------------------------------------------------------- the Moon underfoot
// The film shoots Earthrise from 0.018 lunar radii up, a lunar-orbit view. In a headset you stand instead: a level
// regolith plain to the real horizon (2.4 km for a standing eye on the real Moon), rocks within reach for stereo depth.
const GROUND_FS = NOISE + `uniform vec3 uSun, uC; uniform float uF; varying vec3 vPW;
// craters on a grid of s-metre cells: a worn bowl and a low rim, a little out of round; returns the slope (dh/dx, dh/dz)
vec2 craters(vec2 p, float s, float dens, float seed, inout float alb){
  vec2 g = vec2(0.0); vec2 c0 = floor(p / s);
  for(int j = -1; j <= 1; j++) for(int i = -1; i <= 1; i++){
    vec2 c = c0 + vec2(float(i), float(j)); vec2 h = hash22(c + seed);
    if(h.x > dens) continue;
    float r = s * (0.1 + 0.36 * h.y * h.y); vec2 ctr = (c + 0.2 + 0.6 * hash22(c + seed + 3.7)) * s;
    vec2 d = p - ctr; float L = length(d); vec2 dir = d / max(L, 1e-4);
    float q = L / r * (1.0 + 0.08 * sin(atan(dir.y, dir.x) * 5.0 + h.x * 40.0)); if(q > 1.8) continue;
    float e = q - 1.0, fresh = hash12(c + seed + 9.1);
    float deep = mix(0.12, 0.3, fresh * fresh);                     // most craters are old and shallow
    float dh = (q < 1.0 ? deep * q : 0.0) - mix(0.03, 0.07, fresh) * exp(-e * e * 14.0) * 28.0 * e;
    g += dir * dh;
    alb += 0.05 * fresh * fresh * exp(-e * e * 6.0);                  // the young ones keep a brighter ejecta ring
  }
  return g;
}
void main(){
  vec2 p = (vPW.xz - uC.xz) / uF;                     // metres across the plain
  float px = max(length(dFdx(p)), length(dFdy(p)));   // metres under one pixel: detail finer than that fades out
  float alb = 0.1 + 0.035 * snoise(vec3(p * 0.0025, 1.3)) + 0.02 * snoise(vec3(p * 0.02, 4.1)) + 0.012 * snoise(vec3(p * 0.15, 6.2)) * smoothstep(2.0, 0.3, px)
            + 0.014 * snoise(vec3(p * 1.7, 7.7)) * smoothstep(0.25, 0.03, px);
  vec2 g = craters(p, 150.0, 0.3, 1.0, alb) * smoothstep(40.0, 8.0, px)
         + craters(p, 30.0, 0.4, 9.0, alb) * smoothstep(9.0, 2.0, px)
         + craters(p, 6.0, 0.45, 17.0, alb) * smoothstep(2.0, 0.4, px)
         + craters(p, 1.2, 0.5, 23.0, alb) * smoothstep(0.4, 0.08, px);
  float fine = smoothstep(0.2, 0.03, px);
  g += vec2(snoise(vec3(p * 2.6, 1.0)), snoise(vec3(p * 2.6, 9.0))) * 0.07 * fine + vec2(snoise(vec3(p * 9.0, 3.0)), snoise(vec3(p * 9.0, 5.0))) * 0.05 * smoothstep(0.05, 0.008, px);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y)), L = normalize(uSun);
  float diff = max(dot(N, L), 0.0);
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.93) * max(alb, 0.03) * (3.8 * diff + 0.03), 1.0);
}`;
function makeGround() {
  const scene = new THREE.Scene(), R_M = 2400;
  const mat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: new V3(1, 0.4, -0.3) }, uC: { value: new V3() }, uF: { value: 1 } },
    vertexShader: 'varying vec3 vPW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GROUND_FS });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 192).rotateX(-Math.PI / 2), mat); disc.frustumCulled = false; scene.add(disc);
  // rocks, in metres (the group is scaled by f): three shapes, mostly pebbles, half sunk in the dust, none at your feet
  let a = 13; const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6a64, roughness: 1, metalness: 0 });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new V3(), S = new V3(), rocks = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.IcosahedronGeometry(1, 3), pa = geo.attributes.position, v = new V3();
    const w = [0, 1, 2, 3].map(() => [rnd() * 6 + 2, rnd() * 6.28, new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()]);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).normalize(); let r = 1; for (const [fq, ph, ax] of w) r += 0.09 * Math.sin(v.dot(ax) * fq + ph); r -= 0.25 * Math.max(0, v.y - 0.55); v.multiplyScalar(r); pa.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const n = 90, im = new THREE.InstancedMesh(geo, rockMat, n);
    for (let i = 0; i < n; i++) {
      const r = 2.6 + 80 * rnd() * rnd(), t = rnd() * Math.PI * 2, s = 0.03 + 0.32 * Math.pow(rnd(), 4);
      S.set(s * (0.8 + 0.5 * rnd()), s * (0.4 + 0.3 * rnd()), s * (0.8 + 0.5 * rnd()));
      P.set(Math.cos(t) * r, -S.y * 0.3, Math.sin(t) * r); Q.setFromEuler(new THREE.Euler(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5));
      im.setMatrixAt(i, M.compose(P, Q, S));
    }
    im.frustumCulled = false; rocks.add(im);
  }
  scene.add(rocks);
  const sun = new THREE.DirectionalLight(0xfff6ea, 3.8 * Math.PI), amb = new THREE.AmbientLight(0x8090b0, 0.08);
  scene.add(sun, sun.target, amb);
  return {
    scene, far: R_M * 1.2,
    place(center, f, sunDir) {
      disc.position.copy(center); disc.scale.setScalar(R_M * f); rocks.position.copy(center); rocks.scale.setScalar(f);
      mat.uniforms.uC.value.copy(center); mat.uniforms.uF.value = f; mat.uniforms.uSun.value.copy(sunDir).normalize();
      sun.target.position.copy(center); sun.position.copy(center).add(mat.uniforms.uSun.value);
    }
  };
}

// ---------------------------------------------------------------- the pale blue dot's sunbeam
// In the film it is a CSS gradient over the picture; here a few faint bands of scattered light stand in space,
// facing you, through the Earth.
function makeBeams(scene) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 8; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0); [[0, 0], [0.25, 0.4], [0.5, 1], [0.75, 0.4], [1, 0]].forEach(([p, a]) => gr.addColorStop(p, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 8); const tex = new THREE.CanvasTexture(c);
  const grp = new THREE.Group(), tilt = new THREE.Group(); grp.add(tilt); grp.visible = false; scene.add(grp);
  // colour, strength, offset across the view (radians from the Earth), width (radians) — from the CSS bands at 36/47/55/59 %
  const B = [[0xffaa78, 0.10, -0.1, 0.11], [0xbe78ff, 0.08, -0.021, 0.11], [0x78c8ff, 0.12, 0.035, 0.08], [0xffdcaa, 0.10, 0.065, 0.11]].map(([col, k, o, w]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.userData = { k, o, w }; tilt.add(m); return m;
  });
  tilt.rotation.z = -0.12;
  return {
    show(on, viewer, target, k) {
      grp.visible = on && k > 0.005; if (!grp.visible) return;
      const D = viewer.distanceTo(target); grp.position.copy(target); grp.lookAt(viewer);
      for (const m of B) { const u = m.userData; m.position.set(Math.tan(u.o) * D, 0, 0); m.scale.set(Math.tan(u.w) * D, D * 3, 1); m.material.opacity = u.k * 0.6 * k; }
    }
  };
}

// ---------------------------------------------------------------- the module
export function makeImmersive({ R, stage, scenes, camFor, isPlaying, earth, getCap, drawCaption }) {
  let built = false, session = null, ready = false, wait = 0;
  let ui, uiRig, vcam, sub, cue, labels = [], ground, beams, eyes, gEyes, hdr, bA1, bA2, bB1, bB2;
  let mBright, mDown, mBlur, mComp, postScene, postCam, postQuad, compScene, capKey = '', subYaw = null, subMove = false, lastNow = 0;
  const REF = new Map();                 // shot key → the direction to aim ahead
  const RES = new Map();                 // shot key → the HDR scale this shot sustains
  const FLOOR = new Map();               // shot key → a scale below which this shot ran no faster
  const shot = { key: -1, i: 0, c: 0, f: 0.05, m: 1, res: RES_MAX, ground: false, q: new THREE.Quaternion(), anchor: new V3(), p0: new V3(), aim: new V3(), t0: 0 };
  const cur = { i: 0, l0: 0, t: 0 }, base = new V3(), viewer = new V3(), look = new V3(), head = new V3();
  const tv = new V3(), tv2 = new V3(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), te = new THREE.Euler(), te2 = new THREE.Euler();
  const perf = { last: 0, med: 0, best: 1, slow: 0, fast: 0, at: 0, key: -1, trial: null, kLast: 0.7 };
  const api = { place, present, enter, leave, reset, reaim, fontsReady: () => { capKey = ''; labels.forEach(l => l.key = ''); }, test: null };

  function build() {
    built = true;
    ui = new THREE.Scene(); uiRig = new THREE.Group(); vcam = new THREE.PerspectiveCamera(70, 1, 0.05, 100); uiRig.add(vcam); ui.add(uiRig);
    sub = new Panel(1.34, 0.29, 1400); ui.add(sub.mesh);
    for (let i = 0; i < 10; i++) { const p = new Panel(1.0, 0.32, 500); p.mesh.visible = false; p.key = ''; ui.add(p.mesh); labels.push(p); }
    cue = new Panel(0.13, 0.13, 800); cue.draw((g, W, H) => {
      g.strokeStyle = GOLD; g.lineWidth = W * 0.11; g.lineCap = g.lineJoin = 'round';
      g.beginPath(); g.moveTo(W * 0.36, H * 0.2); g.lineTo(W * 0.66, H * 0.5); g.lineTo(W * 0.36, H * 0.8); g.stroke();
    });
    cue.mesh.visible = false; ui.add(cue.mesh);
    eyes = [0, 1].map(() => { const c = new THREE.PerspectiveCamera(); c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; return c; });
    gEyes = [0, 1].map(() => { const c = new THREE.PerspectiveCamera(); c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; return c; });
    const msaa = R.extensions.has('WEBGL_multisampled_render_to_texture') ? 4 : 0; // resolves on-tile on Quest; a blit elsewhere costs too much
    hdr = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: msaa });
    const small = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    bA1 = small(); bA2 = small(); bB1 = small(); bB2 = small();
    mBright = postMat(BRIGHT_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    mDown = postMat(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    mBlur = postMat(BLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uHalf: { value: 0 }, uSplit: { value: 0.5 } });
    mComp = postMat(COMP_FS, { tScene: { value: hdr.texture }, tBloomA: { value: bA1.texture }, tBloomB: { value: bB1.texture }, uFb: { value: new THREE.Vector2(1, 1) },
      uFade: { value: 1 }, uFlash: { value: 0 }, uBloom: { value: 0.55 }, uTint: { value: new V3(1, 1, 1) } }, COMP_VS);
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); postScene = new THREE.Scene();
    postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mBright); postQuad.frustumCulled = false; postScene.add(postQuad);
    compScene = new THREE.Scene(); const cq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mComp); cq.frustumCulled = false; compScene.add(cq);
    ground = makeGround(); beams = makeBeams(stage.scene);
    api.test = { shot, cur, RES, FLOOR, REF, perf, labels, sub, cue, aimOf, get k() { return RES.get(shot.key); }, get hdr() { return hdr; }, get fade() { return mComp.uniforms.uFade.value; }, get ready() { return ready; } };
  }

  function enter(s) { if (!built) build(); session = s; reset(); Object.assign(perf, { last: 0, med: 0, best: 1, key: -1, trial: null, kLast: 0.7 }); RES.clear(); FLOOR.clear(); REF.clear(); }
  function leave() { session = null; ready = false; shot.key = -1; if (built) { beams.show(false); [hdr, bA1, bA2, bB1, bB2].forEach(t => t.dispose()); } }
  // start over at the next frame: black, then the current shot aimed ahead of wherever you face
  function reset() { shot.key = -1; wait = 3; subYaw = null; capKey = ''; }
  function reaim() { if (shot.key >= 0) newShot(shot.i, shot.c, xrCams()); }

  const xrCams = () => { const c = R.xr.getCamera().cameras; return R.xr.isPresenting && c.length >= 2 ? c : null; };

  // the direction that keeps the story camera's view closest to straight ahead over a whole shot:
  // the axis of the smallest cone around its look directions (Bădoiu–Clarkson on the sphere)
  function aimOf(i, c) {
    const key = i * 8 + c; if (REF.has(key)) return REF.get(key);
    const s = scenes[i], a = shotStart(s, c), b = shotEnd(s, c), dirs = [];
    for (let j = 0; j <= 32; j++) { const k = camFor(i, a + (b - a - 1e-3) * j / 32); dirs.push(k.l.clone().sub(k.p).normalize()); }
    const r = dirs.reduce((m, d) => m.add(d), new V3()).normalize();
    for (let it = 1; it <= 80; it++) { let far = dirs[0], fa = -1; for (const d of dirs) { const x = d.angleTo(r); if (x > fa) { fa = x; far = d; } } r.lerp(far, 1 / (it + 1)).normalize(); }
    REF.set(key, r); return r;
  }
  // a join keeps the camera moving without a cut; it only blinks when the next scene would sit far off your aim
  function needsBlink(i) {
    const s = scenes[i], cfg = cfgOf(s, 0);
    return shot.key < 0 || !s.join || !!cfg.blink || !!cfg.ground || shot.ground || cfg.f !== shot.f || aimOf(i, 0).angleTo(shot.aim) > BLINK_TURN;
  }
  function newShot(i, c, cams) {
    if (!cams) return;
    const s = scenes[i], cfg = cfgOf(s, c), r = aimOf(i, c);
    head.copy(cams[0].position).add(cams[1].position).multiplyScalar(0.5);
    te.setFromQuaternion(cams[0].quaternion, 'YXZ');
    // the shot's aim lands straight ahead of where you face now; space has no up, so the world may also tilt to bring
    // the subject to eye level (never on the Moon, which has a horizon)
    const yaw = Math.atan2(-r.x, -r.z), pitch = cfg.ground ? 0 : Math.asin(clamp(r.y, -0.9, 0.9));
    shot.q.setFromEuler(te2.set(pitch, yaw, 0, 'YXZ')).multiply(tq.setFromAxisAngle(UP, -te.y));
    shot.anchor.copy(head); shot.aim.copy(r);
    Object.assign(shot, { key: i * 8 + c, i, c, f: cfg.f, m: cfg.m, res: cfg.res, ground: !!cfg.ground, t0: performance.now() });
    shot.p0.copy(camFor(i, shotStart(s, c)).p);
  }
  function adopt(i, c) {
    const cfg = cfgOf(scenes[i], c);
    Object.assign(shot, { key: i * 8 + c, i, c, m: cfg.m, res: cfg.res }); shot.p0.copy(camFor(i, shotStart(scenes[i], c)).p);
  }

  // Called by the film every frame before its scene update: put the viewer where the story camera is.
  function place(k, i, l0, t) {
    const cams = xrCams(); if (!cams || !built) { ready = false; return; }
    if (wait > 0) { wait--; ready = false; return; }   // the first frames carry no head pose yet
    const s = scenes[i], c = cutIndex(s, l0), key = i * 8 + c;
    if (key !== shot.key) { if (shot.key >= 0 && c === 0 && i === shot.i + 1 && !needsBlink(i)) adopt(i, c); else newShot(i, c, cams); }
    ready = true; cur.i = i; cur.l0 = l0; cur.t = t; look.copy(k.l);
    base.copy(shot.p0).lerp(k.p, shot.m);
    const near = shot.ground ? 1 : Math.min(0.02, shot.f * 0.2), far = 4500;
    for (let e = 0; e < 2; e++) {
      tv.copy(cams[e].position).sub(shot.anchor).multiplyScalar(shot.f).applyQuaternion(shot.q).add(base);
      tq.copy(shot.q).multiply(cams[e].quaternion);
      for (const [E, n, fr] of [[eyes[e], near, far], [gEyes[e], shot.f * 0.15, ground.far * shot.f]]) {
        E.matrixWorld.compose(tv, tq, ONE); E.matrixWorldInverse.copy(E.matrixWorld).invert();
        E.projectionMatrix.copy(cams[e].projectionMatrix); depthRange(E.projectionMatrix, n, fr); E.projectionMatrixInverse.copy(E.projectionMatrix).invert();
      }
    }
    head.copy(cams[0].position).add(cams[1].position).multiplyScalar(0.5);
    viewer.copy(head).sub(shot.anchor).multiplyScalar(shot.f).applyQuaternion(shot.q).add(base);
    // the scenes read the camera position (the Big Bang's fog, the pale blue dot's size)
    const cam = stage.camera; cam.position.copy(viewer); cam.quaternion.copy(shot.q).multiply(cams[0].quaternion); cam.updateMatrixWorld();
  }
  // the scene renders with its own near and far planes; the headset's own pair serves the text panels
  function depthRange(P, n, f) { const e = P.elements; e[10] = -(f + n) / (f - n); e[14] = -2 * f * n / (f - n); }

  function blink(now) {
    const fadeIn = clamp((now - shot.t0) / 1000 / FADE_IN, 0, 1);
    let out = 0;
    if (isPlaying()) {
      const s = scenes[cur.i], nc = cutsOf(s).find(ct => ct > cur.l0 + 1e-4);
      const left = nc !== undefined ? (nc - cur.l0) / s.k : cur.i + 1 < scenes.length && needsBlink(cur.i + 1) ? s.start + s.dur - cur.t : Infinity;
      if (left < FADE_OUT) out = 1 - Math.max(0, left) / FADE_OUT;
    }
    const f = Math.max(out, 1 - fadeIn); return 1 - f * f * (3 - 2 * f);
  }

  // The HDR buffer's scale follows the frame rate, per shot, so one heavy scene can't blur the light ones. It reads the
  // median of the last frames (a shader compiling as a scene opens is a spike, not a slow scene) and waits out the
  // first moments of each shot. Each step down is a trial: if a second later the frames are no faster, the pixels
  // weren't the cost (a scene heavy in points is bound by its vertices), so the step is undone and becomes the floor.
  const ring = new Float32Array(24), sorted = new Float32Array(24); let rn = 0, ri = 0;
  function median() { sorted.set(ring); const a = sorted.subarray(0, rn).sort(); return a[rn >> 1]; }
  function adapt(now) {
    const dt = (now - perf.last) / 1000; perf.last = now; if (!(dt > 0 && dt < 0.5)) return;
    if (perf.key !== shot.key) { perf.key = shot.key; perf.trial = null; perf.slow = perf.fast = 0; perf.at = now; rn = ri = 0; }
    ring[ri] = dt; ri = (ri + 1) % ring.length; rn = Math.min(ring.length, rn + 1);
    perf.best = Math.min(perf.best + 0.00002, dt);
    const fr = session && session.frameRate, budget = Math.max(fr ? 1 / fr : 0, perf.best);   // the nominal rate, or the display's if slower
    let k = RES.has(shot.key) ? RES.get(shot.key) : Math.min(shot.res, perf.kLast + 0.08);   // a new shot starts near what the last one held
    if (rn >= 16) {
      const med = perf.med = median(), floor = FLOOR.get(shot.key) || RES_MIN;
      if (med > budget * 1.2) { perf.slow += dt; perf.fast = 0; } else if (med < budget * 1.07) { perf.fast += dt; perf.slow = 0; } else perf.slow = perf.fast = 0;
      if (perf.trial) {
        if (now - perf.trial.at > 1200) { if (med > perf.trial.med * 0.93) { k = perf.trial.k; FLOOR.set(shot.key, k); } perf.trial = null; perf.slow = 0; perf.at = now; }
      } else if (perf.slow > 0.6 && k > floor && now - perf.at > 1500) {
        perf.trial = { k, med, at: now }; k = Math.max(floor, k * 0.85); perf.slow = 0; perf.at = now; rn = ri = 0;
      } else if (perf.fast > 3 && k < shot.res && now - perf.at > 3000) {
        k = Math.min(shot.res, k + 0.04); perf.fast = 0; perf.at = now;
      }
    }
    RES.set(shot.key, k); perf.kLast = k;
  }
  function fit(w, h) {
    if (hdr.width === w && hdr.height === h) return;
    hdr.setSize(w, h);
    const a = [Math.max(8, Math.round(w / 4)), Math.max(4, Math.round(h / 4))], b = [Math.max(8, Math.round(w / 8)), Math.max(4, Math.round(h / 8))];
    bA1.setSize(...a); bA2.setSize(...a); bB1.setSize(...b); bB2.setSize(...b);
  }
  function pass(mat, rt) { postQuad.material = mat; rt.viewport.set(0, 0, rt.width, rt.height); rt.scissorTest = false; R.setRenderTarget(rt); R.render(postScene, postCam); }
  function bloom() {
    const B = mBright.uniforms, D = mDown.uniforms, U = mBlur.uniforms;
    B.tSrc.value = hdr.texture; B.uTexel.value.set(1 / hdr.width, 1 / hdr.height); pass(mBright, bA1);
    for (const [src, dst, w, h] of [[bA1, bA2, 1, 0], [bA2, bA1, 0, 1]]) { U.tSrc.value = src.texture; U.uDir.value.set(w / src.width, h / src.height); U.uHalf.value = 0.5 / src.width; pass(mBlur, dst); }
    D.tSrc.value = bA1.texture; D.uTexel.value.set(0.5 / bA1.width, 0.5 / bA1.height); pass(mDown, bB1);
    for (const [src, dst, w, h] of [[bB1, bB2, 1, 0], [bB2, bB1, 0, 1]]) { U.tSrc.value = src.texture; U.uDir.value.set(w / src.width, h / src.height); U.uHalf.value = 0.5 / src.width; pass(mBlur, dst); }
  }

  // On the Moon: hide the lunar sphere, put the plain at your real floor, and lift the Earth by the horizon's dip so it
  // clears the level horizon exactly as it clears the curved one in the film.
  function standOnMoon() {
    const M = earth.MOON, E = earth.E;
    if (M.visible) {
      const dist = tv.copy(viewer).sub(M.position).length(), dip = Math.acos(clamp(M.scale.x / dist, -1, 1));
      const ep = E.group.position, h = Math.hypot(ep.x - viewer.x, ep.z - viewer.z), el = Math.atan2(ep.y - viewer.y, h);
      ep.y = viewer.y + h * Math.tan(clamp(el + dip, -1.4, 1.4)); E.group.updateMatrixWorld(true);
      M.visible = false;
    }
    const eye = shot.anchor.y > 0.6 ? shot.anchor.y : 1.6;     // local-floor puts the floor at 0
    tv2.set(0, -eye * shot.f, 0).applyQuaternion(shot.q).add(base);
    ground.place(tv2, shot.f, stage.sun.position);
  }

  function present(ctx) {
    const xrRT = R.getRenderTarget(), cams = xrCams(), now = performance.now();
    if (!ready || !cams || !xrRT) { R.setRenderTarget(xrRT); R.clear(); return; }
    adapt(now);
    const fbW = xrRT.width, fbH = xrRT.height, k = RES.get(shot.key) || shot.res;
    fit(Math.max(16, Math.round(fbW * k / 4) * 4), Math.max(16, Math.round(fbH * k / 4) * 4));
    const sx = hdr.width / fbW, sy = hdr.height / fbH;
    if (shot.ground) standOnMoon();
    const patch = cfgOf(scenes[cur.i], shot.c).patch; if (patch) patch(scenes[cur.i].obj);
    beams.show(true, viewer, look, ctx.beams || 0);
    // 1) the scene, both eyes, into the HDR buffer
    R.xr.enabled = false;
    GU.uPH.value = cams[0].viewport.w * sy * 0.5 * eyes[0].projectionMatrix.elements[5];
    const vp = e => { const v = cams[e].viewport; hdr.viewport.set(Math.round(v.x * sx), Math.round(v.y * sy), Math.round(v.z * sx), Math.round(v.w * sy)); hdr.scissor.copy(hdr.viewport); hdr.scissorTest = true; };
    for (let e = 0; e < 2; e++) { vp(e); R.setRenderTarget(hdr); R.render(stage.scene, eyes[e]); }
    if (shot.ground) {   // near things get their own depth range: the plain from your feet to the horizon, over the sky
      const ac = R.autoClear; R.autoClear = false;
      for (let e = 0; e < 2; e++) { vp(e); R.setRenderTarget(hdr); R.clearDepth(); R.render(ground.scene, gEyes[e]); }
      R.autoClear = ac;
    }
    beams.show(false);
    hdr.scissorTest = false;
    const v1 = cams[1].viewport; mBlur.uniforms.uSplit.value = v1.z > 0 ? v1.x / fbW : 1;   // a mono view (the emulator) has one side
    bloom();
    // 2) grade it into the headset, then the text
    R.setRenderTarget(xrRT); R.xr.enabled = true;
    const F = stage.finish.uniforms, C = mComp.uniforms;
    C.uFb.value.set(fbW, fbH); C.uFade.value = F.uFade.value * blink(now); C.uFlash.value = Math.min(FLASH_MAX, ctx.flash || 0); C.uTint.value.copy(F.uTint.value);
    R.render(compScene, vcam);
    text(ctx, cams, now);
    const ac = R.autoClear; R.autoClear = false; R.render(ui, vcam); R.autoClear = ac;
  }

  // ---------------------------------------------------------------- text: subtitles, labels, a cue toward the subject
  function text(ctx, cams, now) {
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
    const hq = cams[0].quaternion; te.setFromQuaternion(hq, 'YXZ'); const hy = te.y;
    // subtitles: low ahead, following your gaze lazily
    if (subYaw === null) subYaw = hy;
    const d = Math.atan2(Math.sin(hy - subYaw), Math.cos(hy - subYaw));
    if (Math.abs(d) > 0.5) subMove = true;
    if (subMove) { subYaw += d * Math.min(1, dt * 3); if (Math.abs(d) < 0.04) subMove = false; }
    const el = -0.42, dist = 1.6;
    sub.mesh.position.set(-Math.sin(subYaw) * Math.cos(el), Math.sin(el), -Math.cos(subYaw) * Math.cos(el)).multiplyScalar(dist).add(head);
    sub.mesh.lookAt(head);
    const c = getCap(), key = (c.ending || c.key) + '|360';
    if (key !== capKey) { capKey = key; drawCaption(sub, c); }
    sub.mesh.material.opacity = c.ending ? 1 : 0.25 + 0.75 * c.alpha;
    // labels: just above each body, 5 m out along your line of sight to it
    const inv = tq2.copy(shot.q).invert(), list = ctx.labels || [];
    labels.forEach((L, j) => {
      const it = list[j]; L.mesh.visible = !!it; if (!it) return;
      const key = it.th + '|' + it.en; if (L.key !== key) { L.key = key; drawLabel(L, it.th, it.en); }
      tv.copy(it.p).sub(viewer); const D = tv.length(); tv.normalize().applyQuaternion(inv);
      const lift = Math.atan2(it.off || 0, D) + 0.05;          // the body's angular radius, plus a little
      tv2.copy(UP).addScaledVector(tv, -tv.dot(UP)); if (tv2.lengthSq() < 1e-6) tv2.set(0, 0, 1); tv2.normalize();
      tv.multiplyScalar(Math.cos(lift)).addScaledVector(tv2, Math.sin(lift)).normalize();
      L.mesh.position.copy(tv).multiplyScalar(5).add(head); L.mesh.position.y += 0.16; L.mesh.lookAt(head);   // the tick's foot sits on the body
      L.mesh.material.opacity = Math.min(1, it.a);
    });
    // the cue: when the story's subject has drifted well out of view, a chevron at the edge points the way
    tv.copy(look).sub(viewer).normalize().applyQuaternion(inv).applyQuaternion(tq.copy(hq).invert());   // into your head's frame
    const off = Math.acos(clamp(-tv.z, -1, 1));
    cue.mesh.visible = off > LOOK_CUE && isPlaying();
    if (cue.mesh.visible) {
      const a = Math.atan2(tv.y, tv.x), r = Math.tan(0.36) * 1.4;
      cue.mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, -1.4).applyQuaternion(hq).add(head);
      cue.mesh.quaternion.copy(hq).multiply(tq.setFromAxisAngle(tv2.set(0, 0, 1), a));
      cue.mesh.material.opacity = 0.55 + 0.35 * Math.sin(now * 0.006);
    }
  }
  function drawLabel(P, th, en) {
    P.draw((g, W, H) => {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(0,0,0,0.95)'; g.shadowBlur = 16;
      g.fillStyle = INK; g.font = `500 54px ${FONT.thai}`; g.fillText(th, W / 2, 64);
      g.fillStyle = INK2; g.font = `400 21px ${FONT.mono}`; if ('letterSpacing' in g) g.letterSpacing = '5px'; g.fillText(en.toUpperCase(), W / 2, 100);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.shadowBlur = 0; const gr = g.createLinearGradient(0, 112, 0, H - 6); gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(W / 2 - 1.5, 112, 3, H - 118);
    });
  }

  return api;
}
