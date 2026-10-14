import { SolarScene } from './solar-3d.js';
import { makeTools, orb, fmt, thDate, store, ORDER, C, durTxt } from './solar-tools-v2.js';
import { SolarAudio, VO, VO_TEXT } from './solar-audio.js';
import { LESSON_VO, TOUR_EN } from './solar-lessons.js';
import { initSolarVR } from './solar-vr.js';
const S = window.SOLAR;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const isMobile = () => innerWidth <= 900;
const IC = {
  play:'<svg class="ic" viewBox="0 0 16 16"><path d="M5 3.2v9.6L12.8 8z" fill="currentColor" stroke="none"/></svg>',
  pause:'<svg class="ic" viewBox="0 0 16 16"><path d="M5 3.5v9M11 3.5v9" stroke-width="2.2"/></svg>',
  prev:'<svg class="ic" viewBox="0 0 16 16"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
  next:'<svg class="ic" viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
  x:'<svg class="ic" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  sys:'<svg class="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="1.8" fill="currentColor"/><ellipse cx="8" cy="8" rx="6.6" ry="2.8"/></svg>'
};

// ---------------- scene ----------------
const scene = new SolarScene($('#gl'), $('#labels'), {
  onSelect: id => { if (tour.on) tour.stop(); select(id); },
  onLight: (t, r) => light.tick(t, r)
});

// ---------------- sound ----------------
const audio = new SolarAudio();
const SND_ON='<svg class="ic" viewBox="0 0 16 16"><path d="M2.5 6v4h2.7L9 13V3L5.2 6z" fill="currentColor" stroke="none"/><path d="M11.2 5.4a3.6 3.6 0 0 1 0 5.2M12.9 3.7a6 6 0 0 1 0 8.6"/></svg>',
      SND_OFF='<svg class="ic" viewBox="0 0 16 16"><path d="M2.5 6v4h2.7L9 13V3L5.2 6z" fill="currentColor" stroke="none"/><path d="M11.3 6.2l3.4 3.6M14.7 6.2l-3.4 3.6"/></svg>';
function soundUI(){ const b=$('#b-sound'); b.innerHTML=audio.on?SND_ON:SND_OFF; b.classList.toggle('off',!audio.on); b.title=audio.on?'ปิดเสียง (M)':'เปิดเสียง (M)'; document.body.classList.toggle('vo-on',audio.on); }
$('#b-sound').onclick=()=>{ audio.init(); audio.setOn(!audio.on); soundUI(); };
soundUI();
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>audio.init(),{once:true,capture:true}));

// ---------------- sheet (modal) ----------------
function openSheet(html, {w=880}={}){
  const b=$('#sheetbody'); b.innerHTML=html; b.scrollTop=0;
  $('#sheet').style.setProperty('--w', w+'px'); $('#sheet').classList.add('open');
  return b;
}
function closeSheet(){ $('#sheet').classList.remove('open'); tools.clearKey(); hushExtra(); }
// the moon / seasons sheet narrates with 'x-' clips; they stop with the sheet
function hushExtra(){ if(audio.voiceId&&audio.voiceId.startsWith('x-')) audio.stopVoice(); }
$('#sheet-x').innerHTML = IC.x;
$('#sheet-x').onclick = closeSheet;
$('#sheet').onclick = e => { if (e.target.id==='sheet') closeSheet(); };
const tools = makeTools({ scene, openSheet, select: id => { closeSheet(); select(id); }, sfx: n => audio.sfx(n, 0.7), hush: hushExtra,
  saying: key => audio.voiceId === key,
  say: (key, onend) => { if (audio.voiceId === key) return audio.stopVoice(); lessonStop(); if (tour.on) tour.stop();
    audio.init(); if (!audio.on) { audio.setOn(true); soundUI(); } audio.narrate(key, onend, 0, 'th'); } });
$$('[data-tool]').forEach(b => b.onclick = () => {
  const t=b.dataset.tool;
  if (t==='light') return light.on ? light.stop() : light.start();
  if (tour.on) tour.stop();
  tools[t]();
});
$('#b-help').onclick = () => tools.help();
$('#b-full').onclick = fullscreen;
function fullscreen(){ if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(()=>{}); }

// ---------------- dock ----------------
const DOCK = {sun:40,mercury:17,venus:24,earth:25,mars:20,jupiter:36,saturn:31,uranus:27,neptune:27,moon:15};
$('#dock').innerHTML = `<button class="dk" data-id="" title="ภาพรวมทั้งระบบ (O)"><span class="dk-o"><span class="dk-all">${IC.sys}</span></span><span class="dk-n">ภาพรวม</span></button><span class="dk-sep"></span>` +
  ORDER.map((id,i) => { const b=S.byId(id), key=id==='sun'?'0':id==='moon'?'9':String(i);
    return `<button class="dk" data-id="${id}" title="${b.th} · ${b.en} (${key})"><span class="dk-o">${orb(b,DOCK[id])}</span><span class="dk-n">${b.th.replace(/^ดาว/,'')}</span></button>`; }).join('');
$$('.dk').forEach(d => d.onclick = () => { if (tour.on) tour.stop(); d.dataset.id ? select(d.dataset.id) : overview(); });
function markDock(id){ $$('.dk').forEach(n => n.classList.toggle('on', n.dataset.id === (id||''))); }

// ---------------- panel ----------------
let current=null, focusId=null, tab=store.get('tab','ov');
const TABS=[['ov','ภาพรวม'],['in','โครงสร้าง'],['at','บรรยากาศ'],['mo','บริวาร'],['mi','ภารกิจ'],['fa','เกร็ดน่ารู้']];
function select(id){
  if (!id) return overview();
  closeSheet();
  current=focusId=id; markDock(id);
  renderPanel(S.byId(id));
  $('#panel').classList.add('open'); document.body.classList.add('panel-open');
  hideHint(); syncOffset(); scene.focusOn(id);
  audio.focusBed(id); audio.sfx('sol-whoosh',0.45); if(!tour.on&&audio.voiceId&&audio.voiceBody()!==id){ lessonStop(); audio.stopVoice(); }
  lessonUI();
}
function overview(){ closePanel(); focusId=null; markDock(null); scene.focusOn(null); audio.focusBed(null); }
function closePanel(){ lessonStop(); if(!tour.on) audio.stopVoice(); $('#panel').classList.remove('open'); document.body.classList.remove('panel-open'); current=null; syncOffset(); }
function syncOffset(){
  if (!$('#panel').classList.contains('open')) return scene.setPanelOffset(0);
  if (isMobile()) scene.setPanelOffset($('#panel').offsetHeight, 'bottom');
  else scene.setPanelOffset($('#panel').offsetWidth + 32, 'right');
}
addEventListener('resize', syncOffset);
function stepBody(d){ const i=ORDER.indexOf(focusId), n=ORDER.length; select(ORDER[i<0?(d>0?0:n-1):(i+d+n)%n]); }

function dayTxt(b){ const h=Math.abs(b.rotHours); return h>=48 ? fmt(h/24)+' วัน' : fmt(h)+' ชม.'; }
function keyStats(b){
  if (b.kind==='star') return [['อุณหภูมิผิว',b.tempC.replace(/\s*\(.*\)/,'')],['หมุนรอบตัวเอง',dayTxt(b)],['กว้างกว่าโลก',fmt(b.r_km/6371,0)+' เท่า']];
  if (b.kind==='moon') return [['ห่างจากโลก',fmt(b.orbitKm)+' กม.'],['หมุนรอบตัวเอง',dayTxt(b)],['โคจรรอบโลก',fmt(b.orbitDays)+' วัน']];
  const y=S.periodYears(b.el.a[0]);
  return [['ห่างดวงอาทิตย์',fmt(b.el.a[0])+' AU'],['หมุนรอบตัวเอง',dayTxt(b)],['โคจรรอบดวงอาทิตย์',y<1?fmt(y*365.25,0)+' วัน':fmt(y)+' ปี']];
}
function kicker(b){
  if (b.kind==='star') return 'ดาวฤกษ์ · ศูนย์กลางระบบ';
  if (b.kind==='moon') return 'ดาวบริวารของโลก';
  return 'ดาวเคราะห์ดวงที่ '+ORDER.indexOf(b.id)+' จากดวงอาทิตย์';
}
function renderPanel(b){
  const i=ORDER.indexOf(b.id), nx=S.byId(ORDER[(i+1)%ORDER.length]), nq=(S.QUIZ[b.id]||[]).length;
  const p=$('#panel'); p.style.setProperty('--pc', b.color);
  p.innerHTML=`<div class="p-top"><button class="pnav" data-nav="-1" title="ดาวก่อนหน้า (←)">${IC.prev}</button><span class="pcount">${String(i+1).padStart(2,'0')} / ${ORDER.length}</span>
      <button class="pnav" data-nav="1" title="ดาวถัดไป (→)">${IC.next}</button><button class="pclose" title="ปิด (Esc)">${IC.x}</button></div>
    <div class="p-scroll">
      <header class="p-hero"><div class="p-kick">${kicker(b)}</div><h2>${b.th}</h2><div class="p-en">${b.en}</div><p class="p-tag">${b.tagline}</p>
        <dl class="p-keys">${keyStats(b).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></header>
      <nav class="p-tabs">${TABS.map(([k,l])=>`<button data-tab="${k}" class="${k===tab?'on':''}${hasVO(b.id,k)?' vo':''}"${hasVO(b.id,k)?' title="มีเสียงบรรยาย"':''}>${l}</button>`).join('')}</nav>
      <div class="p-body" id="pbody"></div>
      <footer class="p-foot"><button class="btn" data-listen title="ฟังบรรยายทีละแท็บ แท็บจะเปลี่ยนตามเสียง">${SND_ON}<span>ฟังบทเรียน</span></button>${nq?`<button class="btn primary" data-quiz>ทำแบบทดสอบ · ${nq} ข้อ</button>`:''}<button class="btn" data-next>ถัดไป: ${nx.th} ${IC.next}</button></footer>
    </div>`;
  p.querySelector('.pclose').onclick=closePanel;
  p.querySelectorAll('[data-nav]').forEach(x=>x.onclick=()=>stepBody(+x.dataset.nav));
  p.querySelector('[data-next]').onclick=()=>stepBody(1);
  const q=p.querySelector('[data-quiz]'); if(q) q.onclick=()=>tools.quiz(b.id);
  p.querySelector('[data-listen]').onclick=()=>{ if(lesson.on&&lesson.id===b.id) return lessonStop(); if(tour.on) tour.stop(); lessonPlay(b,tab); };
  p.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{ setTab(b,x.dataset.tab);
    // during a lesson a tap moves the narration to that tab, or stops it if the tab has no clip
    if(lesson.on&&lesson.id===b.id) hasVO(b.id,tab)?lessonPlay(b,tab):lessonStop(); });
  drawTab(b); lessonUI();
}
function setTab(b,t){
  tab=t; store.set('tab',tab); const p=$('#panel');
  p.querySelectorAll('[data-tab]').forEach(y=>{ const on=y.dataset.tab===t; y.classList.toggle('on',on); if(on) y.scrollIntoView({block:'nearest',inline:'nearest'}); });
  drawTab(b);
}

// ---------------- lesson player: narrates the open body tab by tab and turns the tabs with the voice ----------------
const lesson={on:false,id:null,t:null};
const tabKey=(id,t)=>t==='ov'?id:`${id}-${t}`;
function hasVO(id,t){ return t==='ov'?!!VO[id]:!!LESSON_VO[`${id}-${t}`]; }
function lessonPlay(b,t){
  const order=TABS.map(x=>x[0]), next=order.slice(Math.max(0,order.indexOf(t))).find(k=>hasVO(b.id,k));
  if(!next) return lessonStop();
  audio.init(); if(!audio.on){ audio.setOn(true); soundUI(); }
  Object.assign(lesson,{on:true,id:b.id,t:next}); if(tab!==next) setTab(b,next);
  // lessons are Thai only, so the overview tab uses the Thai tour clip whatever the tour language is
  audio.narrate(tabKey(b.id,next),()=>{ if(!lesson.on||lesson.id!==b.id||lesson.t!==next) return;
    const k=order.indexOf(next)+1; if(k<order.length&&order.slice(k).some(x=>hasVO(b.id,x))) lessonPlay(b,order[k]); else lessonStop(); },0,'th');
  lessonUI(); requestAnimationFrame(lessonTick);
}
function lessonStop(){ if(!lesson.on) return; lesson.on=false; audio.stopVoice(); lessonUI(); }
function lessonUI(){
  const p=$('#panel'), on=lesson.on&&lesson.id===current, btn=p.querySelector('[data-listen]');
  if(btn){ btn.classList.toggle('on',on); btn.querySelector('span').textContent=on?'หยุดบรรยาย':'ฟังบทเรียน'; }
  p.querySelectorAll('[data-tab]').forEach(x=>{ x.classList.toggle('playing',on&&x.dataset.tab===lesson.t); if(!on) x.style.removeProperty('--p'); });
}
function lessonTick(){ if(!lesson.on) return; const x=$(`#panel [data-tab="${lesson.t}"]`), pr=audio.voiceProgress();
  if(x&&pr>=0) x.style.setProperty('--p',pr.toFixed(3)); requestAnimationFrame(lessonTick); }
function drawTab(b){
  const el=$('#pbody'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  el.innerHTML = ({ov:tabOverview,in:tabInterior,at:tabAtmos,mo:tabMoons,mi:tabMissions,fa:tabFacts})[tab](b);
  const w=el.querySelector('[data-kg]');
  if (w){ const out=el.querySelector('[data-kgout]'), up=()=>{ const kg=Math.max(0,+w.value||0); store.set('kg',kg); out.textContent=fmt(kg*b.gravity/9.807,1); }; w.oninput=up; up(); }
}
function tabOverview(b){
  const ref=b.id==='earth'?S.byId('moon'):S.byId('earth');
  const big=b.r_km>=ref.r_km?b:ref, small=big===b?ref:b, BIG=128, sm=Math.max(2,BIG*small.r_km/big.r_km), ratio=b.r_km/ref.r_km;
  const cap = b.id==='earth' ? `โลกกว้างกว่าดวงจันทร์ราว ${fmt(1/ratio,1)} เท่า`
            : ratio>=1 ? `${b.th}กว้างกว่าโลก ${fmt(ratio,ratio<10?1:0)} เท่า` : `${b.th}กว้างเพียง ${fmt(ratio*100,0)}% ของโลก`;
  const stats=[['รัศมี',fmt(b.r_km)+' กม.'],['มวล',b.mass],['แรงโน้มถ่วงที่ผิว',fmt(b.gravity)+' m/s²'],['แกนเอียง',fmt(b.tilt)+'°'],['อุณหภูมิ',b.tempC],
    ['หมุนรอบตัวเอง',dayTxt(b)+(b.rotHours<0?' (หมุนกลับทิศ)':'')]];
  return `<p class="lede">${b.intro}</p>
    <figure class="szfig"><div class="szrow"><div class="szi">${orb(big,BIG)}<span>${big.th}</span></div><div class="szi">${orb(small,sm)}<span>${small.th}</span></div></div><figcaption>${cap}</figcaption></figure>
    <div class="wmini"><label>ถ้าคุณหนัก <input type="number" data-kg value="${store.get('kg',40)}" min="1" max="300"> กก. บนโลก</label>
      <p>${b.kind==='star'?'แรงดึงที่ผิวดวงอาทิตย์เท่ากับ':'บน'+b.th+'คุณจะหนัก'} <b data-kgout></b> กก.</p></div>
    <h4 class="sub">ตัวเลขสำคัญ</h4><dl class="stats">${stats.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
const LAYER_R={sun:[.25,.7,.97],mercury:[.85,.97],venus:[.53,.96],earth:[.19,.55,.97],mars:[.54,.96],jupiter:[.2,.78,.97],saturn:[.2,.5,.97],uranus:[.25,.8],neptune:[.25,.8],moon:[.2,.96]};
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>{ const A=hx(a),B=hx(b); return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
function layerColor(b,i,n){
  const hot=['#fff3cc','#ffc463','#ee7632','#a8432a'], t=n>1?i/(n-1):1, p=t*(hot.length-1), k=Math.min(hot.length-2,Math.floor(p));
  return mix(mix(hot[k],hot[k+1],p-k), b.color, Math.pow(t,1.5)*0.85);
}
function tabInterior(b){
  const n=b.layers.length, f=LAYER_R[b.id]||[], R=[]; let prev=0;
  for (let i=0;i<n;i++){ let r=i===n-1?1:(f[i]??Math.pow((i+1)/n,0.75)); r=Math.max(r,prev+0.1); R.push(r); prev=r; }
  const K=1/R[n-1]; for (let i=0;i<n;i++) R[i]*=K;
  const SZ=236, c=SZ/2, rr=c-0.5, cols=b.layers.map((_,i)=>layerColor(b,i,n));
  let svg='';
  for (let i=n-1;i>=0;i--){ const r=R[i]*rr; svg+=`<path d="M${c} ${c}L${c+r} ${c}A${r} ${r} 0 0 1 ${c} ${c+r}Z" fill="${cols[i]}" stroke="rgba(0,0,0,.28)" stroke-width=".8"/>`; }
  svg+=`<path d="M${c} ${c}H${c+rr}M${c} ${c}V${c+rr}" stroke="rgba(255,255,255,.55)" stroke-width="1"/>`;
  b.layers.forEach((_,i)=>{ const m=((i?R[i-1]:0)+R[i])/2*rr, a=(18+54*(n>1?i/(n-1):0.5))*Math.PI/180, x=c+m*Math.cos(a), y=c+m*Math.sin(a);
    svg+=`<circle cx="${x}" cy="${y}" r="8" fill="rgba(10,11,16,.72)"/><text x="${x}" y="${y+3.4}" text-anchor="middle" font-size="9.5" font-family="IBM Plex Mono" fill="#fff">${i+1}</text>`; });
  return `<figure class="cut"><div class="cut-w">${orb(b,SZ)}<svg viewBox="0 0 ${SZ} ${SZ}">${svg}</svg></div><figcaption>ภาพตัดขวางโดยประมาณ · ชั้นที่บางมากถูกขยายให้มองเห็น</figcaption></figure>
    <ol class="layers">${b.layers.map((l,i)=>`<li><span class="ln" style="background:${cols[i]}">${i+1}</span><div><b>${l.th}</b><em>${l.en}</em><p>${l.d}</p></div></li>`).join('')}</ol>`;
}
function tabAtmos(b){
  const seg=[]; b.atmos.split(/\s*·\s*/).forEach(p=>{ const m=p.match(/^(.+?)\s+~?([\d.]+)\s*%/); if(m) seg.push({n:m[1].trim(),v:parseFloat(m[2])}); });
  const bar = seg.length>=2 && seg.reduce((a,s)=>a+s.v,0)>80
    ? `<div class="compbar">${seg.map((s,i)=>`<span style="flex:${Math.max(s.v,1.6)};--k:${i}"></span>`).join('')}</div>
       <ul class="complist">${seg.map((s,i)=>`<li style="--k:${i}"><i></i><b>${s.n}</b><span>${fmt(s.v,2)}%</span></li>`).join('')}</ul>` : '';
  return `${bar?`<h4 class="sub" style="margin-top:0">องค์ประกอบของอากาศ</h4>${bar}`:''}<p class="lede">${b.atmos}</p>`;
}
function tabMoons(b){
  return (b.moons.length?`<ol class="layers">${b.moons.map((m,i)=>`<li><span class="ln">${i+1}</span><div><b>${m.n}</b><p>${m.d}</p></div></li>`).join('')}</ol>`:'')+
    (b.moonNote?`<p class="note">${b.moonNote}</p>`:'')+(!b.moons.length&&!b.moonNote?'<p class="note">ไม่มีดาวบริวาร</p>':'');
}
function tabMissions(b){ return `<ol class="mis">${b.missions.map(m=>`<li><span class="y">${m.y}</span><div><b>${m.n}</b><p>${m.d}</p></div></li>`).join('')}</ol>`; }
function tabFacts(b){ return `<div class="facts">${b.facts.map((f,i)=>`<div class="fact"><b>${String(i+1).padStart(2,'0')}</b><p>${f}</p></div>`).join('')}</div>`; }

// ---------------- time deck ----------------
const speedEl=$('#speed');
const daysPerSec=v=>(v<0?-1:1)*Math.pow(10,Math.abs(v)*(5/3)-2);
function speedText(d){ const a=Math.abs(d), s=d<0?'ย้อน ':''; if(a<1/24) return s+fmt(a*1440)+' นาที/วิ'; if(a<1) return s+fmt(a*24)+' ชม./วิ'; if(a<400) return s+fmt(a)+' วัน/วิ'; return s+fmt(a/365.25)+' ปี/วิ'; }
function applySpeed(){ const d=daysPerSec(+speedEl.value); scene.setSpeed(d); $('#speedlabel').textContent=speedText(d); }
speedEl.value=store.get('speed',1.2); speedEl.oninput=()=>{ store.set('speed',+speedEl.value); applySpeed(); }; applySpeed();
function setPlayIcon(){ $('#play').innerHTML=scene.playing?IC.pause:IC.play; }
function togglePlay(){ scene.playing=!scene.playing; setPlayIcon(); }
$('#play').onclick=togglePlay; setPlayIcon();
const dateField=$('#datefield');
function syncDate(){ const d=scene.date; if(isNaN(d)) return; $('#d-th').textContent=thDate(d); $('#d-ce').textContent='ค.ศ. '+d.getUTCFullYear(); if(document.activeElement!==dateField) dateField.value=d.toISOString().slice(0,10); }
setInterval(syncDate,250); syncDate();
dateField.onchange=()=>{ const d=new Date(dateField.value+'T12:00:00Z'); if(!isNaN(d)) scene.setDate(d); };
$('#today').onclick=()=>{ scene.setDate(new Date()); syncDate(); };
$$('[data-mode]').forEach(btn=>btn.onclick=()=>{
  // on narrow screens only the active button shows, and tapping it flips to the other mode
  let m=btn.dataset.mode; if(btn.classList.contains('on')&&matchMedia('(max-width:560px)').matches) m=m==='map'?'true':'map';
  $$('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===m)); scene.setMode(m); });
const toggles={orbits:v=>scene.setOrbits(v),labels:v=>scene.setLabels(v),belts:v=>scene.setBelts(v)};
$$('[data-tog]').forEach(b=>b.onclick=()=>{ const on=!b.classList.contains('on'); b.classList.toggle('on',on); toggles[b.dataset.tog](on); });
new ResizeObserver(()=>document.documentElement.style.setProperty('--deckH',$('#deck').offsetHeight+'px')).observe($('#deck'));

// ---------------- guided tour ----------------
const tour={on:false,i:0,paused:false,t:0,dur:12000,last:0,
  steps:[{id:null,title:'ระบบสุริยะของเรา',en:'Our Solar System',text:VO_TEXT.overview,textEn:TOUR_EN.overview},
    ...ORDER.map(id=>{ const b=S.byId(id); return {id,title:b.th,en:b.en,text:VO_TEXT[id]||b.tagline+' — '+b.facts[0],textEn:TOUR_EN[id]}; })],
  start(){ if(light.on) light.stop(); lessonStop(); closeSheet(); closePanel(); hideHint(); this.on=true; this.paused=false; audio.init(); audio.sfx('sol-tour',0.8);
    document.body.classList.add('touring'); $('#tour').classList.add('on'); $('#b-tour').classList.add('on'); scene.setAutoRotate(true);
    this.go(0); this.last=performance.now(); requestAnimationFrame(tourLoop); },
  go(i){ if(i>=this.steps.length) return this.stop(); this.i=Math.max(0,i); this.t=0; const s=this.steps[this.i];
    focusId=s.id; markDock(s.id); scene.focusOn(s.id); audio.focusBed(s.id);
    const vo=s.id||'overview'; this.dur=((audio.clipDur(vo)||10.4)+1.6)*1000; if(this.paused) audio.stopVoice(); else audio.narrate(vo);
    $('#t-step').textContent=String(this.i+1).padStart(2,'0')+' / '+String(this.steps.length).padStart(2,'0');
    const tx=$('#t-txt'); tx.classList.remove('in'); void tx.offsetWidth; tx.classList.add('in');
    const en=audio.lang==='en'; $('#t-txt').lang=en?'en':'th';
    $('#t-title').innerHTML=en?`${s.en}<small>${s.title}</small>`:`${s.title}<small>${s.en}</small>`; $('#t-text').textContent=en?s.textEn:s.text; this.setIcon(); },
  next(){ this.go(this.i+1); }, prev(){ this.go(this.i-1); },
  toggle(){ this.paused=!this.paused; this.setIcon(); const vo=this.steps[this.i].id||'overview'; this.paused?audio.stopVoice():audio.narrate(vo,null,this.t/1000); },
  setIcon(){ $('#t-pause').innerHTML=this.paused?IC.play:IC.pause; },
  stop(){ if(!this.on) return; this.on=false; audio.stopVoice(); document.body.classList.remove('touring'); $('#tour').classList.remove('on'); $('#b-tour').classList.remove('on'); scene.setAutoRotate(false); }
};
function tourLoop(now){ if(!tour.on) return; const dt=now-tour.last; tour.last=now; if(!tour.paused){ tour.t+=dt; if(tour.t>=tour.dur) tour.next(); }
  $('#t-bar').style.width=Math.min(100,tour.t/tour.dur*100)+'%'; requestAnimationFrame(tourLoop); }
$('#b-tour').onclick=()=>tour.on?tour.stop():tour.start();
$('#t-prev').innerHTML=IC.prev; $('#t-next').innerHTML=IC.next;
$('#t-prev').onclick=()=>tour.prev(); $('#t-next').onclick=()=>tour.next(); $('#t-pause').onclick=()=>tour.toggle();
// tour narration language: Thai (Jessica) or English (Kokoro)
function langUI(){ const en=audio.lang==='en'; $('#t-lang').textContent=en?'ไทย':'EN'; $('#t-lang').title=en?'บรรยายภาษาไทย (E)':'Narrate in English (E)'; }
function toggleLang(){ audio.setLang(audio.lang==='en'?'th':'en'); langUI(); if(tour.on) tour.go(tour.i); toast(audio.lang==='en'?'ทัวร์บรรยายภาษาอังกฤษ':'ทัวร์บรรยายภาษาไทย'); }
$('#t-lang').onclick=toggleLang; langUI();
$('#t-exit').onclick=()=>tour.stop();
// phones hide the tour paragraph while the narrator reads it; this brings it back for anyone who wants to read along
let showText=store.get('showText',false);
const ccUI=()=>{ document.body.classList.toggle('show-text',showText); $('#t-cc').classList.toggle('on',showText); };
$('#t-cc').onclick=()=>{ showText=!showText; store.set('showText',showText); ccUI(); }; ccUI(); $('#t-open').onclick=()=>{ const id=tour.steps[tour.i].id; tour.stop(); id?select(id):overview(); };

// ---------------- light travel ----------------
const clock=s=>{ const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=Math.floor(s%60); return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(x).padStart(2,'0'); };
const light={on:false,f:store.get('lf',60),hits:new Set(),arr:[],
  start(){ if(tour.on) tour.stop(); closeSheet(); hideHint(); this.on=true; this.hits.clear(); this.done=false;
    const T=S.julianCenturies(scene.date);
    this.arr=ORDER.filter(id=>S.byId(id).el).map(id=>{ const h=S.heliocentric(S.byId(id).el,T), au=Math.hypot(h.x,h.y,h.z); return {id,t:au*S.AU/C}; });
    $('#lh-list').innerHTML=this.arr.map(a=>{ const b=S.byId(a.id); return `<div class="lh-i" data-id="${a.id}">${orb(b,14)}<b>${b.th.replace(/^ดาว/,'')}</b><span>${clock(a.t)}</span></div>`; }).join('');
    $('#lh-msg').textContent='เวลาในวงเล็บคือเวลาที่แสงใช้เดินทางจริง ณ ตำแหน่งดาววันนี้';
    $$('[data-lf]').forEach(b=>b.classList.toggle('on',+b.dataset.lf===this.f));
    $('#lighthud').classList.add('on'); $('[data-tool=light]').classList.add('on'); scene.startLight(this.f); },
  stop(){ this.on=false; scene.stopLight(); $('#lighthud').classList.remove('on'); $('[data-tool=light]').classList.remove('on'); },
  tick(t,rAU){
    $('#lh-clock').textContent=clock(t);
    for(const a of this.arr){ if(this.hits.has(a.id)||t<a.t) continue; this.hits.add(a.id);
      const b=S.byId(a.id); $(`.lh-i[data-id="${a.id}"]`)?.classList.add('hit');
      $('#lh-msg').textContent=`แสงถึง${b.th}แล้ว — ใช้เวลา ${durTxt(a.t)}`;
      const lab=scene.labelOf(a.id); if(lab){ lab.classList.remove('flash'); void lab.offsetWidth; lab.classList.add('flash'); } }
    if(rAU>52&&!this.done){ this.done=true; scene.stopLight(); $('#lh-msg').textContent='แสงออกพ้นแถบไคเปอร์แล้ว กดเริ่มใหม่เพื่อดูอีกครั้ง'; }
  }
};
$('#lh-x').innerHTML=IC.x; $('#lh-x').onclick=()=>light.stop();
$('#lh-again').onclick=()=>light.start();
$$('[data-lf]').forEach(b=>b.onclick=()=>{ light.f=+b.dataset.lf; store.set('lf',light.f); scene.setLightFactor(light.f); $$('[data-lf]').forEach(x=>x.classList.toggle('on',x===b)); });

// ---------------- hint, bare mode, keys ----------------
let hintT=setTimeout(hideHint,9000);
function hideHint(){ clearTimeout(hintT); $('#hint').classList.add('gone'); }
$('#gl').addEventListener('pointerdown',()=>setTimeout(hideHint,1200),{once:true});
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'),1800); }
function bare(){ const on=document.body.classList.toggle('bare'); if(on) toast('ซ่อนเมนูแล้ว — กด H เพื่อแสดงอีกครั้ง'); }
const KEY_BODY={Digit1:'mercury',Digit2:'venus',Digit3:'earth',Digit4:'mars',Digit5:'jupiter',Digit6:'saturn',Digit7:'uranus',Digit8:'neptune',Digit9:'moon',Digit0:'sun'};
addEventListener('keydown',e=>{
  if (e.target.matches('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if ($('#sheet').classList.contains('open')){ if(e.code==='Escape') closeSheet(); else if(tools.key(e)) e.preventDefault(); return; }
  const k=e.code;
  if (k==='Space'){ e.preventDefault(); tour.on?tour.toggle():togglePlay(); }
  else if (k==='ArrowRight'||k==='ArrowLeft'){ const d=k==='ArrowRight'?1:-1; tour.on?(d>0?tour.next():tour.prev()):stepBody(d); }
  else if (KEY_BODY[k]){ if(tour.on) tour.stop(); select(KEY_BODY[k]); }
  else if (k==='KeyO'){ if(tour.on) tour.stop(); overview(); }
  else if (k==='KeyT') tour.on?tour.stop():tour.start();
  else if (k==='KeyL') light.on?light.stop():light.start();
  else if (k==='KeyF') fullscreen();
  else if (k==='KeyM') $('#b-sound').click();
  else if (k==='KeyE') toggleLang();
  else if (k==='KeyH') bare();
  else if (e.key==='?') tools.help();
  else if (k==='Escape'){ if(document.body.classList.contains('bare')) bare(); else if(tour.on) tour.stop(); else if(light.on) light.stop(); else closePanel(); }
});

// ---------------- VR (WebXR, e.g. Meta Quest) ----------------
initSolarVR({ scene, S, ORDER, audio, button: $('#b-vr'),
  onEnter: () => { if (tour.on) tour.stop(); if (light.on) light.stop(); lessonStop(); closeSheet(); closePanel(); hideHint(); document.body.classList.add('in-vr'); },
  onExit: () => { document.body.classList.remove('in-vr'); $$('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===scene.mode)); overview(); }
});

window.__ss={scene,audio,tour,lesson}; // read-only handle for automated checks

// ---------------- start ----------------
markDock(null);
scene.focusOn(null);
