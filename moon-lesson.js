// Moon phases, eclipses and seasons: one set of canvas drawings shared by the page sheet and the VR board.
// Each draw function paints a W×H canvas from a small state object and lays itself out wide (side by side)
// or tall (stacked) from the aspect ratio. Nothing here touches the DOM.

export const SYNODIC = 29.530589; // mean days from one new moon to the next
export const TILT = 23.44;   // Earth's axial tilt, degrees
export const MOON_INCL = 5.1; // the Moon's orbit against Earth's, degrees

const F = { sans: '"IBM Plex Sans Thai", system-ui, sans-serif', mono: '"IBM Plex Mono", ui-monospace, monospace' };
const C = { ink: '#f1ebe0', ink2: '#c5beb1', ink3: '#8f897d', acc: '#f4a95c', accHi: '#ffc084', sun: '#ffcf73', sea: '#4f8fd0', line: 'rgba(255,255,255,.16)', dark: '#0d0f15' };
const TAU = Math.PI * 2, D2R = Math.PI / 180;

// ---------------------------------------------------------------- moon phase maths
// How far the Moon stands east of the Sun (degrees), from low-precision ecliptic longitudes (Astronomical
// Almanac series, about 0.3°). Checked against published 2026 phases (Perth Observatory and others): new moon
// 10 Oct 15:50 UTC, first quarter 18 Oct 16:12, full moon 26 Oct 04:12, last quarter 3 Oct 13:24, all within
// half an hour. A mean-lunation count from the new moon was a day off at that full moon, so it isn't used.
const centuries = date => (date.getTime() / 864e5 + 2440587.5 - 2451545) / 36525;
const sin = x => Math.sin(x * D2R);
// the Sun's ecliptic longitude, degrees (about 0.01°)
export function sunLongitude(date) { const T = centuries(date), g = 357.528 + 35999.050 * T; return 280.460 + 36000.771 * T + 1.915 * sin(g) + 0.020 * sin(2 * g); }
export function elongation(date = new Date()) {
  const T = centuries(date);
  const moon = 218.32 + 481267.881 * T + 6.29 * sin(134.9 + 477198.85 * T) - 1.27 * sin(259.2 - 413335.38 * T) + 0.66 * sin(235.7 + 890534.23 * T)
    + 0.21 * sin(269.9 + 954397.70 * T) - 0.19 * sin(357.5 + 35999.05 * T) - 0.11 * sin(186.6 + 966404.05 * T);
  return ((moon - sunLongitude(date)) % 360 + 360) % 360;
}
// the phase as a 'moon age' in days (elongation spread over a mean month), which is what the slider moves
export function moonAge(date = new Date()) { return elongation(date) / 360 * SYNODIC; }
export function phaseInfo(age) {
  const E = age / SYNODIC * TAU, frac = (1 - Math.cos(E)) / 2, waxing = age < SYNODIC / 2;
  const q = SYNODIC / 4, near = (x, w) => Math.abs(age - x) < w;
  const name = age < 1 || age > SYNODIC - 1 ? 'เดือนดับ' : near(q, 1) ? 'ครึ่งดวงข้างขึ้น' : near(2 * q, 1) ? 'เต็มดวง · วันเพ็ญ' : near(3 * q, 1) ? 'ครึ่งดวงข้างแรม'
    : age < q ? 'เสี้ยวข้างขึ้น' : age < 2 * q ? 'ค่อนดวงข้างขึ้น' : age < 3 * q ? 'ค่อนดวงข้างแรม' : 'เสี้ยวข้างแรม';
  // Thai lunar day, approximately: the n-th day after new moon is ขึ้น n ค่ำ up to 15 (full), then แรม 1–15 ค่ำ
  const n = Math.floor(age) + 1, day = n <= 15 ? `ขึ้น ${n} ค่ำ` : `แรม ${Math.min(15, n - 15)} ค่ำ`;
  return { E, frac, waxing, name, day };
}

// ---------------------------------------------------------------- season maths
export const dayOfYear = d => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;
// the latitude where the noon Sun stands straight overhead (declination), from the Sun's longitude on that day of 2026
export const declination = doy => Math.asin(Math.sin(TILT * D2R) * sin(sunLongitude(new Date(Date.UTC(2026, 0, doy, 12))))) / D2R;
export function sunAt(lat, doy) {
  const dec = declination(doy), x = -Math.tan(lat * D2R) * Math.tan(dec * D2R);
  return { noon: 90 - Math.abs(lat - dec), hours: x <= -1 ? 24 : x >= 1 ? 0 : 2 * Math.acos(x) / D2R / 15 };
}
export const CITIES = [['กรุงเทพฯ', 13.75], ['โตเกียว', 35.7]];
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function doyLabel(doy) { const d = new Date(Date.UTC(2026, 0, doy)); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }

// ---------------------------------------------------------------- shared bits
function text(g, s, x, y, { size = 16, color = C.ink2, weight = 400, align = 'left', font = F.sans, base = 'alphabetic' } = {}) {
  g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y);
}
function glow(g, x, y, r, color, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1;
}
function sunDisc(g, x, y, r) {
  glow(g, x, y, r * 2.4, 'rgba(255,170,70,.55)');
  const gr = g.createRadialGradient(x - r * .25, y - r * .25, r * .1, x, y, r);
  gr.addColorStop(0, '#fffbe8'); gr.addColorStop(.45, '#ffd784'); gr.addColorStop(1, '#f39a3b');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
// a body lit from direction (lx, ly) in screen space: base colour, then the night half shaded
function litBody(g, x, y, r, color, lx, ly, night = 'rgba(4,5,9,.86)') {
  g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  const L = Math.hypot(lx, ly) || 1, ux = lx / L, uy = ly / L;
  const gr = g.createLinearGradient(x + ux * r, y + uy * r, x - ux * r, y - uy * r);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.47, 'rgba(0,0,0,0)'); gr.addColorStop(.53, night); gr.addColorStop(1, night);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function badge(g, s, x, y, size) {
  g.font = `500 ${size}px ${F.sans}`; const w = g.measureText(s).width + size * 1.2, h = size * 1.7;
  g.fillStyle = 'rgba(244,169,92,.14)'; g.strokeStyle = 'rgba(244,169,92,.55)'; g.lineWidth = 1;
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, h / 2) : g.rect(x, y, w, h); g.fill(); g.stroke();
  text(g, s, x + w / 2, y + h / 2 + size * .05, { size, color: C.accHi, weight: 500, align: 'center', base: 'middle' });
}
function arrow(g, x1, y1, x2, y2, color, w = 2, head = 9) {
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1); g.beginPath(); g.moveTo(x2, y2);
  g.lineTo(x2 - head * Math.cos(a - .45), y2 - head * Math.sin(a - .45)); g.lineTo(x2 - head * Math.cos(a + .45), y2 - head * Math.sin(a + .45)); g.closePath(); g.fill();
}

// The Moon as seen from Earth (north up, northern-hemisphere view): the dark part is a half disc
// on the unlit side plus half an ellipse whose width follows cos(elongation).
let moonImg = null;
export function setMoonImage(img) { moonImg = img; }
function moonPhaseDisc(g, x, y, r, E) {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
  if (moonImg && moonImg.complete && moonImg.naturalWidth) { const w = moonImg.naturalWidth; g.drawImage(moonImg, w * .25, 0, w * .5, moonImg.naturalHeight, x - r, y - r, 2 * r, 2 * r); }
  else { g.fillStyle = '#c9c3b8'; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const k = Math.cos(E), rx = r * Math.abs(k), waxing = E < Math.PI;
  g.fillStyle = 'rgba(6,7,11,.9)'; g.beginPath();
  if (waxing) { g.arc(x, y, r, Math.PI / 2, Math.PI * 1.5, false); g.ellipse(x, y, rx, r, 0, -Math.PI / 2, Math.PI / 2, k < 0); }
  else { g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false); g.ellipse(x, y, rx, r, 0, Math.PI / 2, k < 0 ? -Math.PI / 2 : Math.PI * 1.5, k < 0); }
  g.closePath(); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
}

// ---------------------------------------------------------------- 1 · phases
export function drawPhases(g, W, H, { age = moonAge(), today = moonAge() } = {}) {
  const wide = W / H > 1.15, u = wide ? Math.min(W / 16, H / 9) : Math.min(W / 9, H / 12);
  const P = phaseInfo(age);
  // orbit view: Sun far to the left, Earth in the middle, the Moon going round anticlockwise (seen from above the north pole)
  const ox = wide ? W * .32 : W * .5, oy = wide ? H * .5 : H * .25, R = wide ? Math.min(W * .15, H * .33) : Math.min(W * .3, H * .17);
  for (let i = 0; i < 6; i++) { const yy = oy + (i - 2.5) * R * .42; arrow(g, ox - R * 1.75, yy, ox - R * 1.32, yy, 'rgba(255,207,115,.5)', 1.5, 7); }
  text(g, 'แสงอาทิตย์', ox - R * 1.55, oy - R * 1.25, { size: u * .36, color: 'rgba(255,207,115,.85)', align: 'center' });
  g.setLineDash([4, 6]); g.strokeStyle = C.line; g.lineWidth = 1.2; g.beginPath(); g.arc(ox, oy, R, 0, TAU); g.stroke(); g.setLineDash([]);
  arrow(g, ox + R * Math.cos(-0.35) * 1.08, oy + R * Math.sin(-0.35) * 1.08, ox + R * Math.cos(-0.62) * 1.08, oy + R * Math.sin(-0.62) * 1.08, 'rgba(255,255,255,.35)', 1.3, 6);
  litBody(g, ox, oy, R * .2, C.sea, -1, 0);
  text(g, 'โลก', ox, oy + R * .2 + u * .5, { size: u * .34, color: C.ink2, align: 'center' });
  // eight reference positions, each lit on its sunward (left) side, and the Moon now
  const at = a => { const phi = Math.PI + a / SYNODIC * TAU; return [ox + R * Math.cos(phi), oy - R * Math.sin(phi)]; };
  for (let i = 0; i < 8; i++) { const [x, y] = at(i * SYNODIC / 8); g.globalAlpha = .35; litBody(g, x, y, R * .065, '#d8d2c6', -1, 0); g.globalAlpha = 1; }
  const [mx, my] = at(age);
  g.strokeStyle = C.acc; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, R * .13, 0, TAU); g.stroke();
  litBody(g, mx, my, R * .085, '#e9e3d6', -1, 0);
  // what that looks like from Earth
  const px = wide ? W * .74 : W * .5, py = wide ? H * .44 : H * .64, pr = wide ? Math.min(W * .13, H * .27) : Math.min(W * .27, H * .13);
  glow(g, px, py, pr * 1.6, 'rgba(255,255,255,.06)');
  moonPhaseDisc(g, px, py, pr, P.E);
  text(g, 'มองจากโลก', px, py - pr - u * .45, { size: u * .36, color: C.ink3, align: 'center' });
  text(g, P.name, px, py + pr + u * .85, { size: u * .62, color: C.ink, weight: 500, align: 'center' });
  text(g, `${P.day} · สว่าง ${Math.round(P.frac * 100)}% · อายุ ${age.toFixed(1)} วัน`, px, py + pr + u * 1.5, { size: u * .36, color: C.ink2, align: 'center' });
  if (Math.abs(age - today) < 0.05) badge(g, 'คืนนี้', px - u * .9, py + pr + u * 1.85, u * .3);
}

// ---------------------------------------------------------------- 2 · eclipses
export function drawEclipse(g, W, H, { mode = 'solar' } = {}) {
  const wide = W / H > 1.15, u = wide ? Math.min(W / 16, H / 9) : Math.min(W / 9, H / 12);
  badge(g, 'ภาพไม่ตรงตามสัดส่วน', u * .4, u * .35, u * .3);
  if (mode === 'tilt') return eclipseTilt(g, W, H, u, wide);
  const y = H * (wide ? .5 : .42), sx = -W * .02, sr = H * (wide ? .36 : .2);
  sunDisc(g, sx, y, sr);
  const solar = mode === 'solar', near = solar ? W * .52 : W * .6, far = solar ? W * .8 : W * .85;
  const er = u * (wide ? .85 : .9), mr = er * .32;
  const bx = solar ? near : near, cx = solar ? far : far; // the body casting the shadow sits at bx, the one in it at cx
  const br = solar ? mr : er, cr = solar ? er : mr;
  // umbra (dark cone) and penumbra (fainter wedge) behind the caster, drawn from tangents to the Sun
  const len = W - bx, sl = (sr + br) / (bx - sx), pg = g.createLinearGradient(bx, 0, W, 0);
  pg.addColorStop(0, 'rgba(70,80,110,.26)'); pg.addColorStop(.75, 'rgba(70,80,110,.14)'); pg.addColorStop(1, 'rgba(70,80,110,0)');
  g.fillStyle = pg; g.beginPath(); g.moveTo(bx, y - br); g.lineTo(bx + len, y - br - len * sl); g.lineTo(bx + len, y + br + len * sl); g.lineTo(bx, y + br); g.closePath(); g.fill();
  // the umbra is drawn to reach Earth's day side (solar) or to run well past the Moon (lunar), as it does in reality
  const tip = solar ? cx - cr * .92 - bx : cx - bx + cr * 9;
  g.fillStyle = 'rgba(2,3,6,.78)'; g.beginPath(); g.moveTo(bx, y - br); g.lineTo(bx + tip, y); g.lineTo(bx, y + br); g.closePath(); g.fill();
  if (solar) {
    litBody(g, cx, y, cr, C.sea, -1, 0);
    // where the umbra touches Earth: a small dark spot on the sunlit face
    g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.ellipse(cx - cr * .96, y, cr * .07, cr * .16, 0, 0, TAU); g.fill();
    litBody(g, bx, y, br, '#d8d2c6', -1, 0);
  } else {
    litBody(g, bx, y, br, C.sea, -1, 0);
    g.fillStyle = '#8f3d2a'; g.beginPath(); g.arc(cx, y, cr, 0, TAU); g.fill(); glow(g, cx, y, cr * 1.8, 'rgba(160,60,40,.35)');
  }
  const ly = y + Math.max(er, sr * .3) + u * .75;
  text(g, 'ดวงอาทิตย์', sx + sr * .62, y + u * .12, { size: u * .38, color: '#3a1d05', weight: 600, align: 'center' });
  text(g, solar ? 'ดวงจันทร์' : 'โลก', bx, ly, { size: u * .36, color: C.ink2, align: 'center' });
  text(g, solar ? 'โลก' : 'ดวงจันทร์', cx, ly, { size: u * .36, color: C.ink2, align: 'center' });
  text(g, 'เงามืด', bx + Math.min(tip, cx - bx) * .45, y - br - u * .3, { size: u * .3, color: C.ink3, align: 'center' });
  const px = bx + (cx - bx) * .55; text(g, 'เงามัว', px, y - br - (px - bx) * sl - u * .25, { size: u * .3, color: C.ink3, align: 'center' });
  text(g, solar ? 'สุริยุปราคา: เงาของดวงจันทร์ตกบนโลก' : 'จันทรุปราคา: ดวงจันทร์เข้าไปในเงาของโลก', W / 2, H - u * (wide ? 1.1 : 1.6), { size: u * .5, color: C.ink, weight: 500, align: 'center' });
  if (!solar) text(g, 'แสงที่หักเหผ่านบรรยากาศโลกทำให้ดวงจันทร์เป็นสีแดงอิฐ', W / 2, H - u * (wide ? .5 : .9), { size: u * .34, color: C.ink3, align: 'center' });
}
// Side view: the Moon's orbit is tilted about 5° to Earth's, so most new and full moons pass above or below the shadow.
function eclipseTilt(g, W, H, u, wide) {
  const rows = [['เดือนส่วนใหญ่: ดวงจันทร์ผ่านเหนือหรือใต้แนวเงา', 1], ['บางช่วงของปี ทั้งสามเรียงตรงพอดี: เกิดอุปราคา', 0]];
  rows.forEach(([cap, off], i) => {
    const y = H * (i ? .74 : .36), sx = W * .1, ex = W * .62;
    sunDisc(g, sx, y, u * .55);
    g.strokeStyle = 'rgba(255,207,115,.35)'; g.lineWidth = 1; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(sx, y); g.lineTo(W * .92, y); g.stroke(); g.setLineDash([]);
    litBody(g, ex, y, u * .38, C.sea, -1, 0);
    // the Moon's orbit seen edge-on, drawn steeper than the real 5.1° so the tilt shows
    const a = 12 * D2R * (off ? 1 : 0.0001), L = u * 2.6;
    g.strokeStyle = 'rgba(216,210,198,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(ex - L * Math.cos(a), y + L * Math.sin(a)); g.lineTo(ex + L * Math.cos(a), y - L * Math.sin(a)); g.stroke();
    const nm = [ex - L * .62 * Math.cos(a), y + L * .62 * Math.sin(a)], fm = [ex + L * .62 * Math.cos(a), y - L * .62 * Math.sin(a)];
    litBody(g, nm[0], nm[1], u * .13, '#d8d2c6', -1, 0); litBody(g, fm[0], fm[1], u * .13, off ? '#d8d2c6' : '#8f3d2a', -1, 0);
    text(g, cap, W * .5, y + u * 1.25, { size: u * .38, color: i ? C.ink : C.ink2, weight: i ? 500 : 400, align: 'center' });
    if (off) text(g, `เอียงจริงราว ${MOON_INCL}° (วาดให้ชันกว่าจริง)`, ex + L * .75, y - L * Math.sin(a) - u * .45, { size: u * .3, color: C.ink3, align: 'center' });
  });
}

// ---------------------------------------------------------------- 3 · seasons
export function drawSeasons(g, W, H, { doy = dayOfYear(new Date()) } = {}) {
  const wide = W / H > 1.15, u = wide ? Math.min(W / 16, H / 9) : Math.min(W / 9, H / 12);
  // orbit seen from above the plane at a slant; Earth goes round anticlockwise seen from above the north pole.
  // Angle 180° (left) is the June solstice; the axis always leans the same way in space (to the right here),
  // so in June the north pole leans toward the Sun and in December away from it.
  const cx = wide ? W * .34 : W * .5, cy = wide ? H * .5 : H * .27, A = wide ? Math.min(W * .26, H * .62) : W * .38, B = A * .38;
  g.strokeStyle = C.line; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, A, B, 0, 0, TAU); g.stroke();
  sunDisc(g, cx, cy, u * .55);
  const pos = d => { const th = Math.PI + (d - 172) / 365.25 * TAU; return [cx + A * Math.cos(th), cy - B * Math.sin(th), th]; };
  const earth = (d, r, hi) => {
    const [x, y] = pos(d);
    litBody(g, x, y, r, hi ? C.sea : '#3d6a99', cx - x, cy - y);
    const tx = Math.sin(TILT * D2R), ty = -Math.cos(TILT * D2R);
    g.strokeStyle = hi ? C.ink : 'rgba(241,235,224,.55)'; g.lineWidth = hi ? 2 : 1.3; g.beginPath(); g.moveTo(x - tx * r * 1.5, y - ty * r * 1.5); g.lineTo(x + tx * r * 1.5, y + ty * r * 1.5); g.stroke();
    g.fillStyle = hi ? C.accHi : 'rgba(255,192,132,.6)'; g.beginPath(); g.arc(x + tx * r * 1.5, y + ty * r * 1.5, hi ? 3.2 : 2.2, 0, TAU); g.fill(); // north pole end
    return [x, y];
  };
  const MARK = [[172, '21 มิ.ย.'], [265, '22 ก.ย.'], [355, '21 ธ.ค.'], [79, '20 มี.ค.']];
  for (const [d, l] of MARK) { const [x, y] = earth(d, u * .3, false); text(g, l, x, y + (y > cy ? u * .95 : -u * .62), { size: u * .3, color: C.ink3, align: 'center' }); }
  const [ex, ey] = earth(doy, u * .44, true);
  g.strokeStyle = C.acc; g.lineWidth = 1.6; g.beginPath(); g.arc(ex, ey, u * .62, 0, TAU); g.stroke();
  text(g, 'แกนโลกเอียงไปทางเดิมเสมอ', cx, cy + B + u * 1.35, { size: u * .32, color: C.ink3, align: 'center' });
  // the selected day for two cities: noon Sun height and daylight
  const dec = declination(doy), bx = wide ? W * .66 : W * .08, by = wide ? H * .14 : H * .55, bw = wide ? W * .3 : W * .84;
  text(g, doyLabel(doy), bx, by + u * .55, { size: u * .62, color: C.ink, weight: 500 });
  text(g, `แสงอาทิตย์ตั้งฉากที่ละติจูด ${Math.abs(dec).toFixed(1)}° ${dec >= 0 ? 'เหนือ' : 'ใต้'}`, bx, by + u * 1.15, { size: u * .32, color: C.ink2 });
  CITIES.forEach(([name, lat], i) => {
    const s = sunAt(lat, doy), y0 = by + u * (1.85 + i * 1.9);
    text(g, `${name} (${lat}° เหนือ)`, bx, y0, { size: u * .36, color: C.ink, weight: 500 });
    const bar = (y, v, max, label, col) => {
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(bx, y, bw, u * .2); g.fillStyle = col; g.fillRect(bx, y, bw * Math.max(0, Math.min(1, v / max)), u * .2);
      text(g, label, bx + bw, y - u * .08, { size: u * .28, color: C.ink2, align: 'right' });
    };
    bar(y0 + u * .45, s.noon, 90, `ดวงอาทิตย์เที่ยงวันสูง ${Math.round(s.noon)}°`, C.acc);
    bar(y0 + u * 1.05, s.hours, 24, `กลางวันยาว ${Math.floor(s.hours)} ชม. ${Math.round(s.hours % 1 * 60)} นาที`, '#79aefc');
  });
}
