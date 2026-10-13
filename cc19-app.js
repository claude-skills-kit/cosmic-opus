// Cosmic Calendar v19 — timeline, UI, calendar zoom, audio, export contract
import { THREE, createStage, makeSky, GU, clamp, lerp, smooth, ramp } from './cc19-core.js';
import { makeCosmos } from './cc19-cosmos.js';
import { makeEarthScenes } from './cc19-earth.js';
import { VO, VO_LEAD, VO_TAIL, voFile, SFX, sfxFile } from './cc-vo.js';
import { AudioKit } from './audio-kit.js';
import { initCosmicVR } from './cc-vr.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const AGE=13.8e9, YEAR_S=365*86400;

// ---------------------------------------------------------------- story
const SCENES=[
 {id:'bigbang',dur:10.5,ya:[13.8e9,13.79962e9],audio:'bigbang',fx:[[1.3,'bang']],th:'บิกแบง',en:'The Big Bang',
  cth:'เอกภพทั้งหมดเริ่มต้นจากสภาวะที่ร้อนและหนาแน่นอย่างยิ่ง ก่อนจะขยายตัวออกในชั่วพริบตาเดียว',cen:'The entire universe begins in an unimaginably hot, dense state — and expands in an instant.'},
 {id:'cmb',dur:8,ya:[13.79962e9,13.6e9],audio:'bigbang',th:'แสงแรกของเอกภพ',en:'First Light',
  cth:'380,000 ปีต่อมา เอกภพเย็นลงพอที่แสงจะเดินทางได้อย่างอิสระ แสงแรกนั้นยังมาถึงเราจนทุกวันนี้ เป็นคลื่นไมโครเวฟพื้นหลังของจักรวาล',cen:'After 380,000 years the universe cools enough for light to travel freely. We still detect it today as the cosmic microwave background.'},
 {id:'stars',dur:8,ya:[13.6e9,13.4e9],audio:'stars',th:'ดาวฤกษ์ดวงแรก',en:'The First Stars',
  cth:'แรงโน้มถ่วงดึงก๊าซไฮโดรเจนเข้าหากันตามใยจักรวาล จนดาวฤกษ์ดวงแรกจุดติด และส่องสว่างขึ้นในความมืด',cen:'Gravity gathers hydrogen along the cosmic web until the first stars ignite and end the dark ages.'},
 {id:'supernova',dur:8,ya:[13.4e9,13.0e9],audio:'supernova',fx:[[3.6,'impact']],th:'ดาวเกิดและดับ',en:'Stars Live and Die',
  cth:'ดาวมวลมากเผาเชื้อเพลิงจนหมด จากนั้นก็ระเบิดเป็นซูเปอร์โนวา หว่านคาร์บอน ออกซิเจน และเหล็กออกสู่อวกาศ ธาตุพวกนี้วันหนึ่งจะกลายมาเป็นตัวเรา',cen:'Massive stars exhaust their fuel and explode, scattering carbon, oxygen and iron — the atoms that will one day make us.'},
 {id:'galaxy',dur:10,ya:[13.0e9,11.0e9],audio:'galaxy',th:'กำเนิดทางช้างเผือก',en:'The Milky Way Forms',
  cth:'กลุ่มก๊าซและดาวนับพันล้านดวงรวมตัวกัน หมุนวนกลายเป็นทางช้างเผือก กาแล็กซีกังหันที่เป็นบ้านของเรา',cen:'Clouds of gas and billions of stars merge and settle into our spiral home galaxy.'},
 {id:'blackhole',dur:9,ya:[11.0e9,4.7e9],join:1,audio:'galaxy',th:'หลุมดำใจกลางกาแล็กซี',en:'Sagittarius A*',
  cth:'ที่ใจกลางทางช้างเผือก มีหลุมดำมวลยิ่งยวดหนักกว่าดวงอาทิตย์ 4 ล้านเท่า แรงโน้มถ่วงของมันบิดได้แม้แต่แสงให้โค้งงอ',cen:'At the heart of the Milky Way lies a black hole four million times the mass of the Sun. Its gravity bends light itself.'},
 {id:'sunbirth',dur:8,ya:[4.65e9,4.57e9],audio:'sun',fx:[[5.8,'swell']],th:'กำเนิดดวงอาทิตย์',en:'The Sun Is Born',
  cth:'เมฆก๊าซและฝุ่นยุบตัวลงด้วยแรงโน้มถ่วง จนแกนกลางร้อนพอจะจุดปฏิกิริยาฟิวชัน แล้วดาวฤกษ์ของเราก็ถือกำเนิด',cen:'A cloud of gas and dust collapses until its core is hot enough for fusion — our star ignites.'},
 {id:'disk',dur:10,ya:[4.57e9,4.54e9],join:1,audio:'coalesce',th:'ดาวเคราะห์ก่อตัว',en:'Planets Coalesce',
  cth:'ในจานรอบดวงอาทิตย์ ฝุ่นและหินชนกัน เกาะกันเป็นก้อนที่ใหญ่ขึ้นเรื่อย ๆ และในที่สุดก็กลายเป็นดาวเคราะห์',cen:'Dust and rock in the disk around the young Sun collide and clump into ever-larger bodies — and finally planets.'},
 {id:'solar',dur:9,ya:[4.54e9,4.52e9],join:1,audio:'solar',th:'ระบบสุริยะของเรา',en:'Our Solar System',
  cth:'ดาวเคราะห์แปดดวงโคจรรอบดวงอาทิตย์ และดวงที่สามคือบ้านของเรา',cen:'Eight planets circle the Sun. The third one is home.'},
 {id:'theia',dur:11,ya:[4.51e9,4.47e9],audio:'theia',fx:[[4.3,'impact']],th:'กำเนิดดวงจันทร์',en:'The Moon Is Born',
  cth:'เธีย ดาวเคราะห์ขนาดเท่าดาวอังคาร พุ่งเข้าชนโลกที่ยังอายุน้อย เศษซากที่กระเด็นออกมาค่อย ๆ รวมตัวกันเป็นดวงจันทร์',cen:'A Mars-sized world called Theia strikes the young Earth. The debris gathers into the Moon.'},
 {id:'bombardment',dur:8,ya:[4.1e9,3.85e9],join:1,audio:'bombardment',th:'ยุคระดมชนครั้งใหญ่',en:'The Great Bombardment',
  cth:'อุกกาบาตนับไม่ถ้วนพุ่งชนโลก ผิวโลกหลอมละลายซ้ำแล้วซ้ำเล่า และพวกมันก็นำน้ำมาสะสมไว้บนดาว',cen:'Countless impacts pound the Earth, melting its crust again and again — and delivering water.'},
 {id:'firstlife',dur:11,ya:[3.85e9,3.5e9],join:1,audio:'firstlife',th:'สิ่งมีชีวิตแรก',en:'First Life',
  cth:'โลกเย็นลง ไอน้ำควบแน่นเป็นมหาสมุทร แล้วในน้ำอุ่นใต้ทะเลลึก เซลล์แรกก็เริ่มแบ่งตัว',cen:'The Earth cools, oceans form, and in warm deep waters the first cells begin to divide.'},
 {id:'oxygen',dur:9,ya:[2.8e9,2.3e9],audio:'earth',th:'โลกมีออกซิเจน',en:'The Great Oxidation',
  cth:'ไซยาโนแบคทีเรียสังเคราะห์แสงและปล่อยออกซิเจนออกมา ท้องฟ้าเปลี่ยนเป็นสีฟ้า ส่วนเหล็กในทะเลก็ตกตะกอนกลายเป็นสนิม',cen:'Cyanobacteria release oxygen by photosynthesis. The sky turns blue and iron in the seas rusts out.'},
 {id:'snowball',dur:8,ya:[720e6,635e6],join:1,audio:'earth',th:'โลกบอลหิมะ',en:'Snowball Earth',
  cth:'น้ำแข็งแผ่ปกคลุมเกือบทั้งดาว จนกระทั่งภูเขาไฟปล่อยคาร์บอนไดออกไซด์มากพอให้โลกกลับมาอุ่นขึ้นอีกครั้ง',cen:'Ice creeps almost to the equator — until volcanic carbon dioxide warms the world again.'},
 {id:'cambrian',dur:9,ya:[541e6,380e6],join:1,audio:'cambrian',th:'ชีวิตเบ่งบาน',en:'Life Explodes',
  cth:'การระเบิดแห่งยุคแคมเบรียนทำให้ทะเลเต็มไปด้วยสัตว์หลายเซลล์ ต่อมาพืชก็ขึ้นมาปกคลุมผืนดินให้เขียวชอุ่ม',cen:'The Cambrian explosion fills the seas with animals, then plants creep onto land and turn it green.'},
 {id:'dinosaurs',dur:11,ya:[230e6,66e6],join:1,audio:'cambrian',fx:[[5.2,'impact']],th:'ยุคไดโนเสาร์ และวันที่ฟ้าถล่ม',en:'The Age of Dinosaurs Ends',
  cth:'ไดโนเสาร์ครองโลกอยู่กว่า 160 ล้านปี จนดาวเคราะห์น้อยกว้าง 10 กิโลเมตรพุ่งชนคาบสมุทรยูกาตัน ฝุ่นบดบังดวงอาทิตย์ และเปิดทางให้สัตว์เลี้ยงลูกด้วยนม',cen:'Dinosaurs rule for 160 million years — until a 10 km asteroid strikes Yucatán, darkening the sky and opening the way for mammals.'},
 {id:'humans',dur:9,ya:[300000,12000],log:1,audio:'humans',th:'มนุษย์ถือกำเนิด',en:'Humans Arrive',
  cth:'มนุษย์ยุคใหม่ถือกำเนิดในแอฟริกา แล้วกองไฟของพวกเขาก็ค่อย ๆ กระจายไปทั่วทุกทวีป',cen:'Modern humans emerge in Africa, and their campfires slowly spread across every continent.'},
 {id:'civilization',dur:10,ya:[12000,70],log:1,join:1,audio:'humans',th:'อารยธรรม',en:'Civilization',
  cth:'จากไร่นาแห่งแรกจนถึงเมืองที่สว่างไสวในวันนี้ ทั้งหมดกินเวลาแค่ 27 วินาทีสุดท้ายของปีจักรวาล',cen:'From the first farms to today’s glowing cities: the last 27 seconds of the cosmic year.',
  ticks:[[12000,'เริ่มทำเกษตรกรรม','Agriculture'],[5200,'ประดิษฐ์ตัวอักษร','Writing'],[4500,'มหาพีระมิดแห่งกีซา','The Great Pyramid'],[2600,'สมัยพุทธกาล','The age of the Buddha'],[575,'แท่นพิมพ์','The printing press'],[339,'นิวตันกับกฎแรงโน้มถ่วง','Newton’s gravity'],[266,'ปฏิวัติอุตสาหกรรม','Industrial Revolution'],[147,'หลอดไฟฟ้า','Electric light']]},
 {id:'spaceage',dur:8,ya:[69,57],audio:'spaceage',fx:[[0.6,'sparkle']],th:'ยุคอวกาศ',en:'The Space Age',
  cth:'ปี 1957 สปุตนิก 1 ขึ้นสู่วงโคจร และวันนี้ดาวเทียมนับหมื่นดวงห่อหุ้มโลกเราไว้',cen:'In 1957 Sputnik 1 reaches orbit. Today more than ten thousand satellites wrap the planet.'},
 {id:'moon',dur:9,ya:[57,56.8],audio:'moon',th:'เหยียบดวงจันทร์',en:'We Reach the Moon',
  cth:'มนุษย์ได้เดินบนดวงจันทร์ในปี 1969 และได้เห็นโลกลอยขึ้นเหนือขอบฟ้าของอีกโลกหนึ่ง',cen:'In 1969 humans walk on the Moon — and watch the Earth rise over another world’s horizon.'},
 {id:'paleblue',dur:22,ya:[36,0],audio:'paleblue',th:'จุดสีฟ้าจาง ๆ',en:'A Pale Blue Dot',
  cth:'ยานวอยเอเจอร์ 1 หันกล้องกลับมามองบ้านในปี 1990 จากระยะ 6 พันล้านกิโลเมตร และโลกทั้งใบก็เหลือเพียงจุดเล็ก ๆ จุดเดียวในลำแสงอาทิตย์',cen:'In 1990 Voyager 1 looks back from six billion kilometres. The whole Earth is a speck caught in a sunbeam.'}
];
// fit each scene to its narration: a scene too short for its line plays slower (k<1) instead of cutting the voice;
// d0 is the scene's designed length and every animation inside it keeps running on that clock (lt*k)
SCENES.forEach(s=>{ s.d0=s.dur; if(VO[s.id]) s.dur=Math.max(s.d0,VO_LEAD+VO[s.id]+VO_TAIL); s.k=s.d0/s.dur; });
let acc=0; SCENES.forEach((s,i)=>{ s.i=i; s.start=acc; acc+=s.dur; }); const TOTAL=acc;
const sceneAt=t=>{ for(let i=SCENES.length-1;i>=0;i--) if(t>=SCENES[i].start) return i; return 0; };
function yaAt(s,lt){ const p=clamp(lt/s.dur); return s.log?Math.exp(lerp(Math.log(s.ya[0]),Math.log(s.ya[1]),p)):lerp(s.ya[0],s.ya[1],p); }

// ---------------------------------------------------------------- stage
const stage=createStage($('#gl'));
const sky=makeSky(stage.scene);
const C=makeCosmos(stage), ES=makeEarthScenes(stage);
const OBJ={...C,...ES}; const ALL=[...C._all,...ES._all];
const kit=new AudioKit(); // narration + recorded effects; wired up further down
SCENES.forEach(s=>{ s.obj=OBJ[s.id]; if(!s.obj) console.warn('missing scene',s.id); });

// ---------------------------------------------------------------- calendar formatting
const MTH=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MEN=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MDAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
const nf=(n,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
function calOf(ya){
  const before=ya/AGE*YEAR_S, sec=YEAR_S-before; let day=Math.floor(sec/86400), m=0; while(m<11&&day>=MDAYS[m]){ day-=MDAYS[m]; m++; }
  const ds=sec-Math.floor(sec/86400)*86400; const hh=Math.floor(ds/3600), mm=Math.floor(ds%3600/60), ss=ds%60;
  const last=before<60; const sstr=last?ss.toFixed(ss>59.9?2:1).padStart(4,'0'):String(Math.floor(ss)).padStart(2,'0');
  const tm=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${sstr}`;
  return {th:`${day+1} ${MTH[m]} · ${tm}`,en:`${MEN[m]} ${day+1} · ${tm}`,f:sec/YEAR_S,before};
}
function yaText(ya){
  if(ya>=1e9) return [`${nf(ya/1e9,2)} พันล้านปีก่อน`,`${nf(ya/1e9,2)} billion years ago`];
  if(ya>=1e6) return [`${nf(ya/1e6,0)} ล้านปีก่อน`,`${nf(ya/1e6,0)} million years ago`];
  if(ya>=1e4) return [`${nf(ya,0)} ปีก่อน`,`${nf(ya,0)} years ago`];
  const y=Math.round(2026-ya); if(ya<0.6) return ['ปัจจุบัน','today'];
  return y<=0?[`${nf(1-y)} ปีก่อนคริสตกาล`,`${nf(1-y)} BC`]:[`ค.ศ. ${y}`,`AD ${y}`];
}

// ---------------------------------------------------------------- calendar bar (zooms: year → December → Dec 31 → last minute)
const LV=[
  {name:'ปีจักรวาล · 13,800 ล้านปี',ticks:MTHS.map((m,i)=>[i/12,m]),pos:c=>c.f},
  {name:'ธันวาคม',ticks:[1,5,10,15,20,25,31].map(d=>[(d-1)/31,String(d)]),pos:c=>(c.f*365-334)/31},
  {name:'31 ธันวาคม',ticks:[0,3,6,9,12,15,18,21,24].map(h=>[h/24,String(h).padStart(2,'0')+':00']),pos:c=>c.f*365-364},
  {name:'นาทีสุดท้าย · 23:59',ticks:[0,10,20,30,40,50,60].map(s=>[s/60,':'+String(s).padStart(2,'0')]),pos:c=>1-c.before/60}
];
const calEl=$('#cal'); calEl.innerHTML=LV.map((l,i)=>`<div class="lvl" data-l="${i}"><span class="lname">${l.name}</span><div class="ltrack"><div class="lline"></div>${l.ticks.map(([p,t])=>`<i style="left:${p*100}%"><b>${t}</b></i>`).join('')}<div class="lfill"></div><div class="lmark"></div></div></div>`).join('');
let curLv=-1;
function setCal(c){
  const lv=c.before<=60?3:c.f>=364/365?2:c.f>=334/365?1:0;
  if(lv!==curLv){ $$('.lvl').forEach(e=>{ const l=+e.dataset.l; e.classList.toggle('on',l===lv); e.classList.toggle('past',l<lv); }); curLv=lv; }
  const p=clamp(LV[lv].pos(c)); const e=$(`.lvl[data-l="${lv}"]`); e.querySelector('.lmark').style.left=(p*100)+'%'; e.querySelector('.lfill').style.width=(p*100)+'%';
}

// ---------------------------------------------------------------- captions / ticker / labels
let capScene=-1;
function setCaption(s){ const c=$('#cap'); c.classList.remove('in'); void c.offsetWidth;
  $('#c-th').textContent=s.th; $('#c-en').textContent=s.en; $('#c-pth').textContent=s.cth; $('#c-pen').textContent=s.cen;
  $('#c-num').textContent=String(s.i+1).padStart(2,'0')+' / '+SCENES.length; c.classList.add('in');
  $('#ticker').innerHTML=(s.ticks||[]).map(([ya,th,en])=>`<li data-ya="${ya}"><time>${calOf(ya).th.split('· ')[1]}</time><span><b>${th}</b><em>${en}</em></span></li>`).join('');
}
const labelPool=[]; const PV=new THREE.Vector3();
function drawLabels(list){
  const w=innerWidth,h=innerHeight;
  while(labelPool.length<list.length){ const d=document.createElement('div'); d.className='plabel'; $('#labels').appendChild(d); labelPool.push(d); }
  labelPool.forEach((d,i)=>{ const L=list[i]; if(!L){ d.style.opacity=0; return; }
    PV.copy(L.p); PV.y+=L.off*1.5+0.1; PV.project(stage.camera); if(PV.z>1){ d.style.opacity=0; return; }
    d.innerHTML=`<span>${L.th}</span><em>${L.en}</em>`; d.style.opacity=L.a; d.style.transform=`translate(-50%,-100%) translate(${(PV.x*0.5+0.5)*w}px,${(-PV.y*0.5+0.5)*h}px)`; });
}

// ---------------------------------------------------------------- transport
const KEY='cc19.playhead';
let playhead=0, playing=false, started=false, seekingHost=false;
try{ const v=parseFloat(localStorage.getItem(KEY)); if(v>0&&v<TOTAL-1) playhead=v; }catch(e){}
const segs=$('#segs'); segs.innerHTML=SCENES.map(s=>`<div class="seg" style="flex:${s.dur}" data-i="${s.i}"><i></i><span class="tip">${s.th}</span></div>`).join('');
$('#chlist').innerHTML=SCENES.map(s=>{ const c=calOf(s.ya[0]); return `<button data-i="${s.i}"><span class="n">${String(s.i+1).padStart(2,'0')}</span><span class="t"><b>${s.th}</b><em>${s.en}</em></span><span class="d">${c.th.split(' · ')[0]}${c.before<86400?' · '+c.th.split(' · ')[1].slice(0,8):''}</span></button>`; }).join('');
$$('#chlist button').forEach(b=>b.onclick=()=>{ seek(SCENES[+b.dataset.i].start+0.01); $('#chapters').classList.remove('open'); if(!playing) setPlay(true); });
$('#b-ch').onclick=e=>{ e.stopPropagation(); $('#chapters').classList.toggle('open'); };
document.addEventListener('click',e=>{ if(!e.target.closest('#chapters,#b-ch')) $('#chapters').classList.remove('open'); });
const mmss=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function updateScrub(){ $$('.seg').forEach((el,i)=>{ const s=SCENES[i]; el.querySelector('i').style.width=clamp((playhead-s.start)/s.dur)*100+'%'; el.classList.toggle('cur',sceneAt(playhead)===i); }); $('#time').textContent=mmss(playhead)+' / '+mmss(TOTAL); }
let scrubbing=false;
function scrubTo(e){ const r=segs.getBoundingClientRect(); seek(clamp((e.clientX-r.left)/r.width)*TOTAL); }
segs.addEventListener('pointerdown',e=>{ scrubbing=true; segs.setPointerCapture(e.pointerId); scrubTo(e); });
segs.addEventListener('pointermove',e=>{ if(scrubbing) scrubTo(e); });
segs.addEventListener('pointerup',()=>{ scrubbing=false; });
const PLAY='<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>', PAUSE='<svg viewBox="0 0 24 24"><path d="M6.5 4.5h3.8v15H6.5zM13.7 4.5h3.8v15h-3.8z"/></svg>';
function setPlay(p){ playing=p; if(!p) voStop(); $('#b-play').innerHTML=p?PAUSE:PLAY; if(window.CosmicAudio&&CosmicAudio.isReady()) CosmicAudio.setPlaying(p); if(p) hideEnding(); }
$('#b-play').innerHTML=PLAY;
$('#b-play').onclick=()=>{ if(playhead>=TOTAL-0.05) seek(0); setPlay(!playing); };
let lastScene=-1;
function seek(t){ playhead=clamp(t,0,TOTAL); lastScene=-2; disStart=-1; soundReset(); }

// language / mute / fullscreen / chrome autohide
const LANGS=['both','th','en'], LL={both:'ไทย + EN',th:'ไทย',en:'EN'}; let lang='both'; try{ lang=localStorage.getItem('cc19.lang')||'both'; }catch(e){}
function applyLang(){ document.body.dataset.lang=lang; $('#b-lang').textContent=LL[lang]; } applyLang();
$('#b-lang').onclick=()=>{ lang=LANGS[(LANGS.indexOf(lang)+1)%3]; try{localStorage.setItem('cc19.lang',lang);}catch(e){} applyLang(); };
let muted=false; try{ muted=localStorage.getItem('cc19.mute')==='1'; }catch(e){}
function applyMute(){ $('#b-mute').classList.toggle('off',muted); if(window.CosmicAudio&&CosmicAudio.isReady()) CosmicAudio.setEnabled(!muted); kit.setEnabled(!muted); } applyMute();
$('#b-mute').onclick=()=>{ muted=!muted; try{localStorage.setItem('cc19.mute',muted?'1':'0');}catch(e){} applyMute(); };
const fs=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.().catch(()=>{});
$('#b-fs').onclick=fs;
let idleT=0; const wake=()=>{ document.body.classList.remove('idle'); idleT=performance.now(); };
addEventListener('pointermove',wake); addEventListener('keydown',wake);
function audioInit(){ if(!kit.ready){ kit.init(); kit.setEnabled(!muted); const i=sceneAt(playhead); SCENES.slice(i,i+3).forEach(s=>{ kit.buffer(voFile(s.id)); (SFX[s.id]||[]).forEach(c=>kit.buffer(sfxFile(c[1]))); }); } // later scenes load one ahead
  if(window.CosmicAudio&&!CosmicAudio.isReady()){ CosmicAudio.init(); CosmicAudio.setEnabled(!muted); CosmicAudio.setScene(SCENES[sceneAt(playhead)].audio); CosmicAudio.setPlaying(playing); } }
addEventListener('keydown',e=>{
  if(!started||e.metaKey||e.ctrlKey) return; const k=e.code;
  if(k==='Space'){ e.preventDefault(); $('#b-play').click(); }
  else if(k==='ArrowRight') seek(playhead+5); else if(k==='ArrowLeft') seek(playhead-5);
  else if(k==='BracketRight'||k==='PageDown') seek(SCENES[Math.min(SCENES.length-1,sceneAt(playhead)+1)].start+0.01);
  else if(k==='BracketLeft'||k==='PageUp'){ const i=sceneAt(playhead); seek(SCENES[playhead-SCENES[i].start<1.5?Math.max(0,i-1):i].start+0.01); }
  else if(k==='KeyF') fs(); else if(k==='KeyM') $('#b-mute').click(); else if(k==='KeyL') $('#b-lang').click(); else if(k==='KeyN') $('#b-vo').click();
  else if(k==='KeyH') document.body.classList.toggle('clean');
});

// ---------------------------------------------------------------- narration + recorded effects
let narr=true; try{ narr=localStorage.getItem('cc19.vo')!=='0'; }catch(e){}
function applyVO(){ $('#b-vo').classList.toggle('off',!narr); $('#b-vo').title=narr?'ปิดเสียงบรรยาย (N)':'เปิดเสียงบรรยาย (N)'; }
$('#b-vo').onclick=()=>{ narr=!narr; try{localStorage.setItem('cc19.vo',narr?'1':'0');}catch(e){} applyVO(); if(!narr) voStop(); }; applyVO();
let voH=null, voI=-1, voDone=-1, fxI=-1, fxNext=0, fxLive=[];
const duckScore=on=>{ if(window.CosmicAudio&&CosmicAudio.isReady()) CosmicAudio.setDuck(on); };
function voStop(f=0.25){ if(voH){ voH.stop(f); voH=null; kit.duck(false); duckScore(false); } }
function fxStop(f=0.6){ fxLive.forEach(h=>h.stop(f)); fxLive=[]; }
function soundReset(){ voStop(); fxStop(0.3); voDone=-1; fxI=-1; }
function syncSound(i,s,lt){
  if(!kit.ready) return;
  const on=playing&&!scrubbing&&!muted, v=VO[s.id];
  // one narration clip per scene, starting VO_LEAD in; a clip that already finished stays finished
  const want=on&&narr&&v&&lt>=VO_LEAD&&lt<VO_LEAD+v-0.3&&voDone!==i;
  if(voH&&(voI!==i||!want)) voStop();
  if(want&&!voH){ voI=i; const off=lt-VO_LEAD;
    const h=voH=kit.play(voFile(s.id),{bus:'voice',offset:off,fadeIn:off>0.15?0.2:0.02,onend:()=>{ if(voH===h){ voH=null; voDone=i; kit.duck(false); duckScore(false); } }});
    kit.duck(true); duckScore(true); }
  // effects fire as the playhead crosses them; cue times are on the scene's own clock (cc-vo.js)
  if(fxI!==i){ fxStop(0.9); fxI=i; fxNext=0; const n=SCENES[i+1]; if(n){ kit.buffer(voFile(n.id)); (SFX[n.id]||[]).forEach(c=>kit.buffer(sfxFile(c[1]))); } }
  const cues=SFX[s.id]||[];
  if(on) while(fxNext<cues.length){ const [at,file,gain,pk]=cues[fxNext], st=at/s.k-pk; if(lt<st) break; if(lt-st<0.4) fxLive.push(kit.play(sfxFile(file),{gain})); fxNext++; }
  else if(fxLive.length) fxStop(0.3);
}
// while a line is playing, nudge the film toward the voice so lips-and-picture never drift apart
function voDrift(){ if(!voH||!voH.src||voH.ended) return 0; const s=SCENES[voI], d=s.start+VO_LEAD+(kit.now-voH.started)-playhead; return Math.abs(d)>0.04&&Math.abs(d)<0.6?d*0.12:0; }

// ---------------------------------------------------------------- VR cinema (WebXR, e.g. Meta Quest)
const capState={i:0,alpha:0,date:'',ending:null, get key(){ return this.i+'|'+lang+'|'+this.ending; },
  get title(){ const s=SCENES[this.i]; return lang==='en'?s.en:s.th; }, get line(){ const s=SCENES[this.i]; return lang==='en'?s.cen:s.cth; },
  get meta(){ return String(this.i+1).padStart(2,'0')+' / '+SCENES.length+'   ·   '+this.date; } };
const vr=initCosmicVR({ stage, buttons:[$('#b-vr'),$('#b-vr2')], getCap:()=>capState,
  onEnter:()=>{ audioInit(); GU.uPx.value=1; if(!started) begin(playhead>3?SCENES[sceneAt(playhead)].start+0.01:0); else if(!playing) setPlay(true); },
  onExit:()=>{ curPR=0; lastScene=-2; },
  onPlay:()=>$('#b-play').click(),
  onChapter:d=>{ const i=sceneAt(playhead); seek(SCENES[Math.max(0,Math.min(SCENES.length-1,i+d))].start+0.01); if(!playing) setPlay(true); },
  onVO:()=>$('#b-vo').click() });

// ---------------------------------------------------------------- camera: story path + gentle user orbit
let yaw=0,pitch=0,zoom=1,drag=false,px=0,py=0,lastUser=-1e9;
const cv=$('#gl');
cv.addEventListener('pointerdown',e=>{ drag=true; px=e.clientX; py=e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove',e=>{ if(!drag) return; yaw-=(e.clientX-px)*0.004; pitch=clamp(pitch-(e.clientY-py)*0.004,-1.2,1.2); px=e.clientX; py=e.clientY; lastUser=performance.now(); });
cv.addEventListener('pointerup',()=>drag=false);
cv.addEventListener('wheel',e=>{ e.preventDefault(); zoom=clamp(zoom*Math.exp(clamp(e.deltaY,-100,100)*0.0012),0.45,2.6); lastUser=performance.now(); },{passive:false});
cv.addEventListener('dblclick',()=>{ lastUser=-1e9; });
const BLEND=1.6;
function camFor(i,lt){
  const s=SCENES[i]; const k=s.obj.cam(lt);
  if(s.join&&i>0&&lt<BLEND){ const p=SCENES[i-1]; const q=p.obj.cam(p.d0); const u=smooth(lt/BLEND); k.p=q.p.clone().lerp(k.p,u); k.l=q.l.clone().lerp(k.l,u); k.f=lerp(q.f,k.f,u); }
  return k;
}
const tmp=new THREE.Vector3(), sph=new THREE.Spherical();

// ---------------------------------------------------------------- frame
const ctx={sky,labels:[],cam:stage.camera};
let curPR=0, lastNow=performance.now(), disStart=-1;
function render(t,dt,now){
  const i=sceneAt(t), s=SCENES[i], lt=t-s.start, l0=lt*s.k, d0=dt*s.k; // l0/d0: the scene's own clock
  const cutHit=playing&&!scrubbing&&s.obj.cuts&&s.obj.cuts.some(ct=>l0-d0<ct&&l0>=ct);
  if(!vr.active&&((i!==lastScene&&lastScene===i-1&&playing&&!scrubbing)||cutHit)){ stage.capture(); disStart=t; } // the dissolve reads the screen, which a headset doesn't have
  if(i!==lastScene){ const natural=lastScene===i-1&&playing;
    if(window.CosmicAudio&&CosmicAudio.isReady()&&(lastScene<0||SCENES[lastScene]?.audio!==s.audio)){ natural&&!kit.ready?CosmicAudio.enterScene(s.audio):CosmicAudio.setScene(s.audio); } // recorded effects replace the synth stingers
    lastScene=i; setCaption(s); const pr=s.obj.lowres?Math.min(1,devicePixelRatio):Math.min(2,devicePixelRatio);
    if(pr!==curPR&&!vr.active){ curPR=pr; stage.renderer.setPixelRatio(pr); stage.composer.setPixelRatio(pr); stage.resize(); } }
  // fx triggers
  if(playing&&!scrubbing&&s.fx&&!kit.ready&&window.CosmicAudio&&CosmicAudio.isReady()) for(const [ft,name] of s.fx){ if(l0-d0<ft&&l0>=ft) CosmicAudio.trigger(name); }
  syncSound(i,s,lt);
  ALL.forEach(g=>g.visible=false);
  ctx.flash=0; ctx.streak=0; ctx.fade=1; ctx.bars=1; ctx.shake=0; ctx.beams=0; ctx.labels.length=0;
  GU.uTime.value=t;
  const k=camFor(i,l0);
  // user orbit decays back to the story framing after a pause
  const idle=(performance.now()-lastUser)/1000; if(s.obj.still){ yaw*=0.9; pitch*=0.9; zoom=lerp(zoom,1,0.1); }
  if(!drag&&idle>3.5){ const d=Math.min(1,dt*1.2); yaw*=1-d; pitch*=1-d; zoom=lerp(zoom,1,d); }
  tmp.copy(k.p).sub(k.l); sph.setFromVector3(tmp); sph.theta+=yaw; sph.phi=clamp(sph.phi-pitch,0.05,Math.PI-0.05); sph.radius*=zoom; tmp.setFromSpherical(sph);
  const cam=stage.camera; cam.position.copy(k.l).add(tmp);
  const drift=s.obj.still?0:0.004*sph.radius; cam.position.x+=Math.sin(t*0.37)*drift; cam.position.y+=Math.sin(t*0.29+1)*drift*0.7;
  cam.fov=k.f; cam.lookAt(k.l); cam.updateProjectionMatrix();
  s.obj.update(l0,d0,ctx);
  if(ctx.shake>0){ cam.position.x+=(Math.random()-0.5)*ctx.shake*sph.radius*0.3; cam.position.y+=(Math.random()-0.5)*ctx.shake*sph.radius*0.3; }
  sky.follow(cam);
  let fade=ctx.fade; const dk=disStart<0?0:1-smooth((t-disStart)/1.4); if(dk<=0.001||t<disStart) disStart=-1; stage.dis.uniforms.uK.value=Math.max(0,dk); stage.dis.uniforms.uZ.value=1+0.035*(1-dk);
  const F=stage.finish.uniforms; F.uFade.value=fade; F.uFlash.value=ctx.flash; F.uStreak.value=ctx.streak; F.uBars.value=ctx.bars; F.uTime.value=now*0.001;
  GU.uPH.value=(vr.active?vr.filmH:stage.renderer.domElement.height)*0.5/Math.tan(cam.fov*Math.PI/360);
  // UI
  const ya=yaAt(s,lt), c=calOf(ya), yt=yaText(ya); setCal(c);
  $('#c-date').textContent=lang==='en'?c.en:c.th; $('#c-ya').textContent=lang==='en'?yt[1]:yt[0];
  const capA=Math.min(smooth((lt-0.5)/0.8),smooth((s.dur-lt-0.2)/0.7)); capState.alpha=capA; capState.i=i; capState.date=lang==='en'?c.en:c.th; $('#cap').style.opacity=capA; $('#scrim').style.opacity=0.55+0.45*capA*(s.obj.bright?1:0.6); document.body.classList.toggle('bright',!!s.obj.bright);
  $$('#ticker li').forEach(li=>li.classList.toggle('on',ya<=+li.dataset.ya*1.0001));
  $('#beams').style.opacity=ctx.beams; drawLabels(ctx.labels);
  if(vr.active) vr.present(); else stage.composer.render();
  if(t>=TOTAL-0.02&&playing){ setPlay(false); showEnding(); }
}
function loop(now){
  const dt=Math.min(0.1,(now-lastNow)/1000); lastNow=now;
  if(seekingHost) return;
  if(playing&&!scrubbing) playhead=Math.min(TOTAL,playhead+dt+voDrift());
  render(playhead,dt,now); updateScrub();
  if(started&&playing&&performance.now()-idleT>3200) document.body.classList.add('idle');
  if(Math.floor(now/600)!==Math.floor((now-dt*1000)/600)){ try{ localStorage.setItem(KEY,String(playhead)); }catch(e){} $('#viewport').dataset.screenLabel='t='+playhead.toFixed(0)+'s · '+SCENES[sceneAt(playhead)].en; }
}
stage.renderer.setAnimationLoop(loop); // also drives WebXR frames

// ---------------------------------------------------------------- intro / ending
function begin(from){ started=true; audioInit(); $('#intro').classList.add('gone'); seek(from); setPlay(true); wake(); }
$('#b-start').onclick=()=>begin(0);
if(playhead>3){ $('#b-resume').hidden=false; $('#b-resume').textContent='ดูต่อจาก '+SCENES[sceneAt(playhead)].th; $('#b-resume').onclick=()=>begin(SCENES[sceneAt(playhead)].start+0.01); }
function showEnding(){ $('#ending').classList.add('show'); capState.ending=$('.e-th').textContent; }
function hideEnding(){ $('#ending').classList.remove('show'); capState.ending=null; }
$('#b-replay').onclick=()=>{ hideEnding(); seek(0); setPlay(true); };
$('#b-stay').onclick=hideEnding;

// ---------------------------------------------------------------- host timeline / video export contract
const root=$('#viewport'); root.setAttribute('data-om-exportable-video-with-duration-secs',String(TOTAL));
let hostT=null;
root.addEventListener('data-om-seek-to-time-frame',e=>{
  const t=+((e.detail&&e.detail.time)||0); started=true; $('#intro').classList.add('gone'); hideEnding(); setPlay(false);
  seekingHost=true; clearTimeout(hostT); hostT=setTimeout(()=>{ seekingHost=false; },400);
  seek(t); render(playhead,1/30,performance.now()); updateScrub();
});
window.__cc={stage,OBJ,ES,seek:t=>{ started=true; $('#intro').classList.add('gone'); seek(t); },play:setPlay,SCENES,TOTAL,
  voice:()=>voH&&voH.src?{scene:SCENES[voI].id,at:+(kit.now-voH.started).toFixed(2)}:null};
