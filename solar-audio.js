// Solar System Explorer — narration (ElevenLabs Eleven v4, voice "Jessica") and sound
// (ElevenLabs Sound Effects v2), both generated through fal.ai. Shared by the page and VR mode.
import { AudioKit, Bed } from './audio-kit.js';

// clip lengths in seconds, one per tour stop
export const VO = {overview:15.3,sun:20.29,mercury:19.13,venus:14.9,earth:20.35,mars:18.41,jupiter:18.9,saturn:20.48,uranus:20.58,neptune:18.2,moon:19.76};
// what the narrator says, for the tour card to show while it is spoken
export const VO_TEXT = {
  overview: 'ดาวฤกษ์หนึ่งดวง ดาวเคราะห์แปดดวง กับวัตถุเล็ก ๆ อีกนับล้านชิ้น โคจรอยู่ด้วยกันมาราว 4,600 ล้านปีแล้ว ดาวทุกดวงที่เห็นตรงหน้านี้อยู่ในตำแหน่งที่คำนวณจากวันที่จริง ไปดูกันทีละดวง',
  sun: 'ดวงอาทิตย์เป็นดาวแคระเหลือง แต่ก้อนเดียวกุมมวลไว้ถึง 99.86% ของทั้งระบบ ถ้าย่อมันลงเหลือเท่าลูกบาสเกตบอล โลกจะเล็กเท่าหัวเข็มหมุดที่วางห่างออกไป 26 เมตร อีกราว 5 พันล้านปี มันจะพองตัวเป็นดาวยักษ์แดง และกลืนวงโคจรของดาวพุธกับดาวศุกร์',
  mercury: 'หนึ่งวันสุริยะบนดาวพุธยาวถึง 176 วันโลก นานเป็นสองเท่าของหนึ่งปีของมันที่ใช้แค่ 88 วัน มันเล็กที่สุดในระบบ แต่ร้อนสุดขั้วและเย็นสุดขั้วได้ในดวงเดียว และในก้นหลุมใกล้ขั้วที่แสงไม่เคยส่องถึง ยังมีน้ำแข็งซ่อนอยู่',
  venus: 'ดาวศุกร์ที่เราเรียกว่าดาวประจำเมืองหรือดาวประกายพรึก สว่างบนฟ้าเป็นรองแค่ดวงอาทิตย์กับดวงจันทร์ มันเป็นฝาแฝดของโลกที่กลายเป็นนรกเพราะเรือนกระจกวิ่งหนี และบนดาวศุกร์ ดวงอาทิตย์ขึ้นทางทิศตะวันตก',
  earth: 'โลก บ้านของเรา ดาวเคราะห์ดวงเดียวที่รู้ว่ามีชีวิต และมีน้ำเหลวอยู่บนผิวอย่างถาวร มหาสมุทรคลุมผิวโลกไว้ 71% แต่ก้นทะเลถูกสำรวจละเอียดน้อยกว่าผิวดาวอังคารเสียอีก ส่วนวันบนโลกก็ยาวขึ้นราว 1.7 มิลลิวินาทีทุกศตวรรษ เพราะแรงไทดัลจากดวงจันทร์',
  mars: '24 ชั่วโมง 37 นาที นั่นคือความยาวหนึ่งวันบนดาวอังคาร ใกล้กับโลกที่สุดในระบบสุริยะ ดาวทะเลทรายดวงนี้เคยมีแม่น้ำ และเป็นเป้าหมายถัดไปของมนุษย์ ที่นั่นพระอาทิตย์ตกเป็นสีฟ้า และพายุฝุ่นขยายคลุมได้ทั้งดาวนานหลายเดือน',
  jupiter: 'ถ้าเอาดาวเคราะห์ดวงอื่นทั้งหมดมารวมกัน ดาวพฤหัสบดีก็ยังมีมวลมากกว่าถึงสองเท่าครึ่ง ยักษ์ก๊าซดวงนี้หมุนเร็วที่สุดในบรรดาดาวเคราะห์ หนึ่งวันสั้นแค่ 9 ชั่วโมง 56 นาที แสงออโรราที่ขั้วของมันมีพลังงานมากกว่าออโรราของโลกหลายร้อยเท่า',
  saturn: 'ดาวเสาร์ เจ้าของวงแหวนที่สวยที่สุด และเป็นดาวที่เบากว่าน้ำ วงแหวนนี้อาจมีอายุแค่ 100 ล้านปี และกำลังค่อย ๆ ตกลงสู่ตัวดาว ราวทุก 15 ปี วงแหวนจะหันขอบเข้าหาโลกจนเกือบมองไม่เห็น ส่วนลมที่เส้นศูนย์สูตรพัดแรงถึง 1,800 กิโลเมตรต่อชั่วโมง',
  uranus: 'ปี 1781 วิลเลียม เฮอร์เชล ส่องกล้องโทรทรรศน์ไปเจอดาวยูเรนัส ดาวเคราะห์ดวงแรกที่ค้นพบด้วยกล้อง มันเป็นยักษ์น้ำแข็งที่นอนกลิ้งไปตามวงโคจร แกนของมันเอียงสุดขั้วจนวงแหวนบาง ๆ สีมืดทั้ง 13 วงตั้งฉากกับวงโคจร และหนึ่งปีของมันยาวถึง 84 ปีโลก',
  neptune: 'ก่อนจะมีใครมองเห็นดาวเนปจูน คณิตศาสตร์ก็พบมันแล้ว มันอยู่ไกลจากดวงอาทิตย์ 30 หน่วยดาราศาสตร์ แสงอาทิตย์ต้องเดินทางราว 4 ชั่วโมงกว่าจะไปถึง สีของมันน้ำเงินเข้มกว่ายูเรนัสทั้งที่มีมีเทนใกล้เคียงกัน และเรื่องนี้ยังเป็นคำถามที่ปิดไม่ลง',
  moon: 'มองจากโลก ดวงจันทร์กับดวงอาทิตย์ดูใหญ่ใกล้เคียงกัน สุริยุปราคาเต็มดวงจึงเกิดขึ้นได้พอดี บริวารดวงนี้ทำให้โลกมีฤดูกาลที่มั่นคงและมีน้ำขึ้นน้ำลง บนผิวของมันไม่มีลมและฝน รอยเท้าของนักบินอวกาศจึงอยู่ได้นับล้านปี'
};
const VO_ORDER = Object.keys(VO);
const voFile = id => `audio/vo/solar/${String(VO_ORDER.indexOf(id) + 1).padStart(2, '0')}-${id}.mp3`;
const BEDS = { sun: 'sol-sun', earth: 'sol-earth', mars: 'sol-mars', jupiter: 'sol-jupiter', saturn: 'sol-saturn', uranus: 'sol-ice', neptune: 'sol-ice' };
const sfxFile = n => `audio/sfx/${n}.mp3`;

export class SolarAudio {
  constructor() {
    this.kit = new AudioKit(); this.voice = null; this.voiceId = null; this.beds = {}; this.bedName = null;
    try { this.on = localStorage.getItem('ss.sound') !== '0'; } catch (e) { this.on = true; }
    this.kit.on = this.on;
  }
  // must run inside a click / key / select handler the first time
  init() {
    const fresh = !this.kit.ready; this.kit.init(); if (!fresh) return;
    this.space = new Bed(this.kit, sfxFile('sol-amb'), { gain: 0.9 });
    for (const n of new Set(Object.values(BEDS))) this.beds[n] = new Bed(this.kit, sfxFile(n), { gain: 0.8 });
    ['sol-whoosh', 'sol-select', 'sol-tour'].forEach(n => this.kit.prefetch(sfxFile(n)));
    this.space.start(4);
  }
  setOn(on) { this.on = on; this.kit.setEnabled(on); try { localStorage.setItem('ss.sound', on ? '1' : '0'); } catch (e) {} if (!on) this.stopVoice(); }
  sfx(name, gain = 1) { if (this.on && this.kit.ready) this.kit.play(sfxFile(name), { gain }); }
  // crossfade to the ambience of the body in view (none for the rocky inner worlds)
  focusBed(id) {
    const n = BEDS[id] || null; if (n === this.bedName || !this.kit.ready) return;
    if (this.bedName) this.beds[this.bedName].stop(2); this.bedName = n;
    if (n) this.beds[n].start(2.5);
  }
  narrate(id, onend, offset = 0) {
    this.stopVoice(); if (!VO[id] || !this.kit.ready || !this.on || offset > VO[id] - 0.3) return null;
    const h = this.voice = this.kit.play(voFile(id), { bus: 'voice', offset, fadeIn: offset ? 0.2 : 0.02, onend: () => { if (this.voice === h) { this.voice = null; this.voiceId = null; this.kit.duck(false); } onend && onend(); } });
    this.voiceId = id; this.kit.duck(true); return h;
  }
  stopVoice() { if (this.voice) { this.voice.stop(0.25); this.voice = null; this.voiceId = null; this.kit.duck(false); } }
  // 0..1 through the current clip, or -1
  voiceProgress() { const h = this.voice; return h && h.src && h.dur ? Math.min(1, (this.kit.now - h.started) / h.dur) : -1; }
}
