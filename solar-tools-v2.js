// เครื่องมือประกอบการสอน — เทียบขนาด · คำนวณ · ไทม์ไลน์ · ควิซ · ดวงจันทร์และฤดูกาล · คู่มือ
import { drawPhases, drawEclipse, drawSeasons, moonAge, dayOfYear, setMoonImage } from './moon-lesson.js';
import { EXTRA_TEXT } from './solar-lessons.js';
const S = window.SOLAR;
export const ORDER = ['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','moon'];
export const C = 299792.458;
export const fmt = (n,d) => Number(n).toLocaleString('th-TH',{maximumFractionDigits:d??(Math.abs(n)<10?2:0)});
export const thDate = d => d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
export const store = {
  get(k,d){ try{ const v=localStorage.getItem('sse2.'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('sse2.'+k,JSON.stringify(v)); }catch(e){} }
};
export function orb(b,px){
  const sun=b.kind==='star';
  return `<span class="orb${sun?' is-sun':''}${b.id==='saturn'?' has-ring':''}" style="--s:${px}px;--c:${b.color};${sun?'':`--tex:url('textures/${b.tex}');`}"></span>`;
}
export function lenTxt(cm){
  if(cm<1) return fmt(cm*10,1)+' มม.';
  if(cm<100) return fmt(cm,1)+' ซม.';
  if(cm<100000) return fmt(cm/100,cm<1000?2:0)+' ม.';
  return fmt(cm/100000,1)+' กม.';
}
export function durTxt(s){
  if(s<60) return fmt(s,1)+' วินาที';
  if(s<3600) return Math.floor(s/60)+' นาที '+Math.round(s%60)+' วินาที';
  if(s<86400) return Math.floor(s/3600)+' ชั่วโมง '+Math.round(s%3600/60)+' นาที';
  if(s<86400*730) return fmt(s/86400,0)+' วัน';
  return fmt(s/31557600,s<31557600*100?1:0)+' ปี';
}

export function makeTools({scene, openSheet, select, sfx, say, saying, hush}){
  let quizKey = null;
  const head=(k,t,sub,tabs)=>`<header class="sh-head"><div class="kick">${k}</div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}${
    tabs?`<nav class="sh-tabs">${tabs.map(([id,l],i)=>`<button data-t="${id}"${i?'':' class="on"'}>${l}</button>`).join('')}</nav>`:''}</header><div class="sh-body"></div>`;
  function tabbed(root,map,first){
    const body=root.querySelector('.sh-body');
    const go=t=>{ root.querySelectorAll('.sh-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); body.innerHTML=''; body.className='sh-body in'; map[t](body); };
    root.querySelectorAll('.sh-tabs button').forEach(b=>b.onclick=()=>go(b.dataset.t));
    go(first||Object.keys(map)[0]);
  }

  // ---------- เทียบขนาด ----------
  function compare(){
    const root=openSheet(head('เครื่องมือ · เทียบขนาด','ใหญ่แค่ไหนกันนะ','ขนาดของดาวทุกดวงตามสัดส่วนจริง และลองย่อระบบสุริยะให้เท่ากับของที่จับต้องได้ในห้องเรียน',
      [['scale','สัดส่วนจริง'],['fam','ถ้าโลกเท่ากับ…']]),{w:940});
    tabbed(root,{scale:scaleTab,fam:famTab});
  }
  function scaleTab(el){
    const J=118, k=J/(S.byId('jupiter').r_km*2), sun=S.byId('sun'), sd=sun.r_km*2*k, E=S.byId('earth');
    const ids=['mercury','venus','earth','moon','mars','jupiter','saturn','uranus','neptune'];
    const ratio=sun.r_km/E.r_km;
    el.innerHTML=`<div class="poster"><div class="ps-sun" style="--d:${sd}px"></div>
      <span class="ps-sunlab">ดวงอาทิตย์<small>${fmt(sun.r_km*2/1e6,2)} ล้าน กม.</small></span>
      <div class="ps-row">${ids.map(id=>{ const b=S.byId(id), d=Math.max(2,b.r_km*2*k);
        return `<div class="ps-it${id==='saturn'?' sat':''}"><div class="ps-b">${orb(b,d)}</div><b>${b.th.replace(/^ดาว/,'')}</b><small>${fmt(b.r_km*2,0)} กม.</small></div>`; }).join('')}</div></div>
      <div class="tiles">
        <div class="tile"><b>${fmt(ratio,0)}</b><span>จำนวนโลกที่เรียงต่อกันข้ามเส้นผ่านศูนย์กลางดวงอาทิตย์ได้</span></div>
        <div class="tile"><b>${fmt(Math.pow(ratio,3)/1e6,1)} ล้าน</b><span>จำนวนโลกที่บรรจุลงในดวงอาทิตย์ได้ (เทียบปริมาตร)</span></div>
        <div class="tile"><b>${fmt(Math.pow(S.byId('jupiter').r_km/E.r_km,3),0)}</b><span>จำนวนโลกที่บรรจุลงในดาวพฤหัสบดีได้</span></div>
      </div>`;
  }
  const REF=[['เมล็ดพริกไทย',0.5],['ลูกแก้ว',1.6],['ลูกปิงปอง',4],['ลูกเทนนิส',6.7],['ลูกฟุตบอล',22]];
  function famTab(el){
    let sel=store.get('ref',2);
    const draw=()=>{
      const [name,cm]=REF[sel], k=cm/(6371*2), sun=S.byId('sun');
      const dist=id=>S.byId(id).el.a[0]*S.AU*k;
      el.innerHTML=`<div class="chips">${REF.map(([n,c],i)=>`<button class="chip${i===sel?' on':''}" data-i="${i}">${n}<small>${fmt(c,1)} ซม.</small></button>`).join('')}</div>
      <p class="say">ถ้าโลกเท่ากับ<b>${name}</b> ดวงอาทิตย์จะเป็นลูกบอลกว้าง <b>${lenTxt(sun.r_km*2*k)}</b> ตั้งอยู่ห่างออกไป <b>${lenTxt(dist('earth'))}</b> ส่วนดาวเนปจูนจะอยู่ไกลถึง <b>${lenTxt(dist('neptune'))}</b></p>
      <table class="tbl"><thead><tr><th>ดาว</th><th class="r">ขนาดเท่ากับ</th><th class="r">ห่างจากดวงอาทิตย์</th></tr></thead><tbody>${
        ORDER.filter(id=>id!=='moon').map(id=>{ const b=S.byId(id);
          return `<tr><td><span class="tn">${orb(b,18)}${b.th}</span></td><td class="r">${lenTxt(b.r_km*2*k)}</td><td class="r">${b.el?lenTxt(dist(id)):'—'}</td></tr>`; }).join('')}</tbody></table>`;
      el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ sel=+b.dataset.i; store.set('ref',sel); draw(); });
    };
    draw();
  }

  // ---------- เครื่องคำนวณ ----------
  function calc(tab){
    const root=openSheet(head('เครื่องมือ · เครื่องคำนวณ','ถ้าฉันไปอยู่บนดาวดวงอื่น','ใส่ตัวเลขของตัวเองแล้วดูผลทันที ทุกค่าคำนวณจากข้อมูลจริงของดาวแต่ละดวง',
      [['w','น้ำหนัก'],['age','อายุ'],['go','เวลาเดินทาง']]),{w:880});
    tabbed(root,{w:weightTab,age:ageTab,go:travelTab},tab);
  }
  function weightTab(el){
    let kg=store.get('kg',40);
    const MAX=2.6;
    el.innerHTML=`<div class="calc-top"><label class="fld"><span>น้ำหนักของคุณบนโลก</span><div class="knum"><input type="number" id="w-n" min="1" max="300" value="${kg}"><em>กก.</em></div></label>
      <input type="range" id="w-r" min="5" max="150" value="${Math.min(150,kg)}"></div>
      <div class="bars">${ORDER.map(id=>{ const b=S.byId(id), g=b.gravity/9.807;
        return `<div class="bar${g>MAX?' over':''}"><span class="tn">${orb(b,20)}${b.th}</span><div class="trk"><i style="--w:${Math.min(100,g/MAX*100)}%;--c:${b.color}"></i></div><b data-g="${g}"></b></div>`; }).join('')}</div>
      <p class="note">ตัวเลขที่ต่างกันมาจากแรงโน้มถ่วงที่ผิวของดาวแต่ละดวง มวลของร่างกายคุณยังเท่าเดิมทุกที่ · ดวงอาทิตย์ไม่มีพื้นให้ยืน ตัวเลขนี้คือแรงดึงที่ระดับผิว</p>`;
    const n=el.querySelector('#w-n'), r=el.querySelector('#w-r');
    const draw=()=>{ el.querySelectorAll('[data-g]').forEach(x=>x.innerHTML=`${fmt(kg*x.dataset.g,1)} <small>กก.</small>`); };
    n.oninput=()=>{ kg=Math.max(0,+n.value||0); r.value=Math.min(150,kg); store.set('kg',kg); draw(); };
    r.oninput=()=>{ kg=+r.value; n.value=kg; store.set('kg',kg); draw(); };
    draw();
  }
  function ageTab(el){
    const today=new Date().toISOString().slice(0,10);
    el.innerHTML=`<div class="calc-top"><label class="fld"><span>วันเกิดของคุณ</span><input type="date" id="a-d" value="${store.get('birth','2013-06-15')}" max="${today}"></label></div>
      <p class="say" id="a-say"></p><div class="agegrid" id="a-g"></div>`;
    const inp=el.querySelector('#a-d');
    const draw=()=>{
      const b0=new Date(inp.value+'T00:00:00'); if(isNaN(b0)) return;
      const days=(Date.now()-b0)/864e5; if(days<0) return;
      store.set('birth',inp.value);
      el.querySelector('#a-say').innerHTML=`คุณมีชีวิตมาแล้ว <b>${fmt(days,0)} วัน</b> ระหว่างนั้นโลกพาคุณโคจรรอบดวงอาทิตย์ไปแล้วราว <b>${fmt(days/365.25*2*Math.PI*S.AU/1e9,2)} พันล้านกิโลเมตร</b>`;
      el.querySelector('#a-g').innerHTML=ORDER.filter(id=>S.byId(id).el).map(id=>{
        const b=S.byId(id), P=S.periodYears(b.el.a[0])*365.25, age=days/P, next=new Date(b0.getTime()+Math.ceil(age+1e-9)*P*864e5);
        return `<div class="agec">${orb(b,36)}<div><span class="an">อายุบน${b.th}</span><b>${fmt(age,age<1?2:age<10?1:0)}</b><small>ปี</small><em>วันเกิดครั้งถัดไป ${thDate(next)}</em></div></div>`;
      }).join('');
    };
    inp.oninput=draw; draw();
  }
  const SPEEDS=[['เดิน',5],['รถยนต์',100],['เครื่องบิน',900],['จรวด',40000],['ยานพาร์กเกอร์',700000],['แสง',C*3600]];
  function distFromEarth(id){
    const T=S.julianCenturies(scene.date), e=S.heliocentric(S.byId('earth').el,T), b=S.byId(id);
    if(b.kind==='star') return Math.hypot(e.x,e.y,e.z)*S.AU;
    if(id==='moon') return 384400;
    const p=S.heliocentric(b.el,T); return Math.hypot(p.x-e.x,p.y-e.y,p.z-e.z)*S.AU;
  }
  function travelTab(el){
    let dest=store.get('dest','mars'), sp=store.get('spd',3);
    const draw=()=>{
      const km=distFromEarth(dest), sec=km/SPEEDS[sp][1]*3600, b=S.byId(dest);
      el.innerHTML=`<div class="fld"><span>จุดหมายจากโลก</span><div class="pick">${ORDER.filter(i=>i!=='earth').map(id=>{ const x=S.byId(id);
          return `<button class="pk${id===dest?' on':''}" data-d="${id}">${orb(x,24)}<span>${x.th.replace(/^ดาว/,'')}</span></button>`; }).join('')}</div></div>
        <div class="fld"><span>เดินทางด้วย</span><div class="chips">${SPEEDS.map(([n,v],i)=>`<button class="chip${i===sp?' on':''}" data-s="${i}">${n}<small>${i===5?'300,000 กม./วิ':fmt(v)+' กม./ชม.'}</small></button>`).join('')}</div></div>
        <div class="trip"><div class="trip-big"><small>${SPEEDS[sp][0]}จากโลกไป${b.th} ใช้เวลา</small><b>${durTxt(sec)}</b></div>
          <dl class="kv"><div><dt>ระยะทาง ณ ${thDate(scene.date)}</dt><dd>${fmt(km)} กม.</dd></div><div><dt>แสงใช้เวลา</dt><dd>${durTxt(km/C)}</dd></div>
          ${S.COMPARE.filter(c=>c.km<km).slice(0,2).map(c=>`<div><dt>เท่ากับระยะ${c.th}</dt><dd>${fmt(km/c.km,0)} เท่า</dd></div>`).join('')}</dl></div>
        <p class="note">ระยะห่างระหว่างดาวเปลี่ยนทุกวันตามตำแหน่งในวงโคจร ลองเปลี่ยนวันที่ในแถบเวลาด้านล่างแล้วกลับมาดูใหม่</p>`;
      el.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{ dest=x.dataset.d; store.set('dest',dest); draw(); });
      el.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>{ sp=+x.dataset.s; store.set('spd',sp); draw(); });
    };
    draw();
  }

  // ---------- ไทม์ไลน์ ----------
  function timeline(){
    const root=openSheet(head('เครื่องมือ · ไทม์ไลน์','การเดินทางสู่อวกาศของมนุษย์',`${S.TIMELINE.length} เหตุการณ์สำคัญ ตั้งแต่ดาวเทียมดวงแรกจนถึงภารกิจปัจจุบัน`),{w:780});
    const g={}; S.TIMELINE.forEach(t=>{ const d=Math.floor(parseInt(t.y,10)/10)*10; (g[d]=g[d]||[]).push(t); });
    root.querySelector('.sh-body').innerHTML=`<div class="tl2">${Object.keys(g).sort().map(d=>`<section><h4><span>ทศวรรษ</span>${d}</h4><ol>${
      g[d].map(t=>`<li><span class="y">${t.y}</span><div><b>${t.th}</b><em>${t.en}</em></div></li>`).join('')}</ol></section>`).join('')}</div>`;
  }

  // ---------- แบบทดสอบ ----------
  function quiz(id){
    const pool = id ? (S.QUIZ[id]||[]).map(q=>({...q,body:id}))
                    : Object.entries(S.QUIZ).flatMap(([k,v])=>v.map(q=>({...q,body:k}))).sort(()=>Math.random()-0.5).slice(0,10);
    const title = id ? S.byId(id).th : 'รวมทุกดาว';
    const root=openSheet(head('แบบทดสอบ',title,null),{w:740});
    const el=root.querySelector('.sh-body'); el.classList.add('qz');
    let i=0, right=0, answered=false; const log=[];
    const nextId = id ? ORDER[(ORDER.indexOf(id)+1)%ORDER.length] : null;
    function render(){
      answered=false;
      if(i>=pool.length) return result();
      const q=pool[i], b=S.byId(q.body);
      el.innerHTML=`<div class="qz-top"><span>ข้อ ${i+1} จาก ${pool.length}</span><div class="qz-prog"><i style="width:${i/pool.length*100}%"></i></div><span>ถูก ${right}</span></div>
        <div class="qz-card in">${id?'':`<div class="qz-tag">${orb(b,18)}${b.th}</div>`}<h3>${q.q}</h3>
        <div class="qz-opts">${q.a.map((a,j)=>`<button class="qz-o" data-j="${j}"><kbd>${j+1}</kbd><span>${a}</span></button>`).join('')}</div>
        <div class="qz-ex" hidden></div></div>`;
      el.querySelectorAll('.qz-o').forEach(o=>o.onclick=()=>answer(+o.dataset.j));
    }
    function answer(j){
      if(answered) return; answered=true;
      const q=pool[i], ok=j===q.c; if(ok) right++; sfx&&sfx(ok?'sol-right':'sol-wrong');
      log.push({q,j,ok});
      el.querySelectorAll('.qz-o').forEach(o=>{ const k=+o.dataset.j; o.disabled=true; if(k===q.c) o.classList.add('right'); else if(k===j) o.classList.add('wrong'); else o.classList.add('dim'); });
      const ex=el.querySelector('.qz-ex'); ex.hidden=false;
      ex.innerHTML=`<p><b>${ok?'ถูกต้อง':'ยังไม่ถูก'}</b> ${q.e}</p><button class="btn primary" id="qz-n">${i+1<pool.length?'ข้อถัดไป':'ดูผลคะแนน'} <kbd>Enter</kbd></button>`;
      el.querySelector('.qz-top span:last-child').textContent='ถูก '+right;
      el.querySelector('#qz-n').onclick=()=>{ i++; render(); };
    }
    function result(){
      const pct=Math.round(right/pool.length*100);
      const msg = pct===100?'เยี่ยมมาก ตอบถูกทุกข้อ':pct>=70?'เก่งมาก เข้าใจเนื้อหาส่วนใหญ่แล้ว':pct>=40?'ใกล้แล้ว ลองอ่านทบทวนอีกนิด':'ลองกลับไปอ่านเนื้อหาแล้วทำใหม่อีกครั้ง';
      const wrong=log.filter(x=>!x.ok);
      el.innerHTML=`<div class="qz-res in"><div class="ring" style="--p:${pct}"><b>${right}<small>/${pool.length}</small></b></div>
        <div><h3>${msg}</h3><p>ตอบถูก ${pct}%</p><div class="row-btn"><button class="btn primary" id="qz-r">ทำใหม่</button>${nextId?`<button class="btn" id="qz-x">ไปเรียน${S.byId(nextId).th}ต่อ</button>`:''}</div></div></div>
        ${wrong.length?`<h4 class="sub">ทบทวนข้อที่ตอบผิด</h4><ul class="review">${wrong.map(x=>`<li><b>${x.q.q}</b><p>คำตอบคือ “${x.q.a[x.q.c]}” — ${x.q.e}</p></li>`).join('')}</ul>`:''}`;
      el.querySelector('#qz-r').onclick=()=>{ i=0; right=0; log.length=0; if(!id) pool.sort(()=>Math.random()-0.5); render(); };
      const nx=el.querySelector('#qz-x'); if(nx) nx.onclick=()=>select(nextId);
    }
    quizKey=e=>{
      const m=e.code.match(/^(?:Digit|Numpad)([1-4])$/);
      if(m && !answered && el.querySelector('.qz-o')){ const j=+m[1]-1; if(j<pool[i].a.length){ answer(j); return true; } }
      if(e.code==='Enter' && answered){ i++; render(); return true; }
      return false;
    };
    render();
  }

  // ---------- ดวงจันทร์ · อุปราคา · ฤดูกาล ----------
  const PLAY='<svg class="ic" viewBox="0 0 16 16"><path d="M5 3.2v9.6L12.8 8z" fill="currentColor" stroke="none"/></svg>', PAUSE='<svg class="ic" viewBox="0 0 16 16"><path d="M5 3.5v9M11 3.5v9" stroke-width="2.2"/></svg>';
  const SPK='<svg class="ic" viewBox="0 0 16 16"><path d="M2.5 6v4h2.7L9 13V3L5.2 6z" fill="currentColor" stroke="none"/><path d="M11.2 5.4a3.6 3.6 0 0 1 0 5.2"/></svg>';
  let moonTex=null;
  // a canvas that fills its column (16:9 when there is room, 4:5 on phones) and repaints on resize and once the fonts are in
  function board(el, draw){
    const wrap=document.createElement('div'); wrap.className='ml-board'; const cv=document.createElement('canvas'); wrap.appendChild(cv); el.appendChild(wrap);
    const paint=()=>{ const w=wrap.clientWidth; if(!w) return; const h=Math.round(w*(w>=560?9/16:5/4)), dpr=Math.min(2,devicePixelRatio||1);
      if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){ cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); cv.style.height=h+'px'; }
      const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h); draw(g,w,h); };
    new ResizeObserver(paint).observe(wrap); if(document.fonts) document.fonts.ready.then(paint);
    return paint;
  }
  function narration(el, key, txt){
    const d=document.createElement('div'); d.className='ml-narr';
    d.innerHTML=`<button class="btn" data-say>${SPK}<span>ฟังบรรยาย</span></button><p>${txt}</p>`; el.appendChild(d);
    const b=d.querySelector('[data-say]'), ui=()=>{ const on=saying(key); b.classList.toggle('on',on); b.querySelector('span').textContent=on?'หยุดบรรยาย':'ฟังบรรยาย'; };
    b.onclick=()=>{ say(key,ui); ui(); }; ui();
  }
  // a looping animation that stops itself once its tab is gone
  function looper(el, step){
    let on=false, last=0;
    const tick=now=>{ if(!on) return; if(!el.isConnected){ on=false; return; } step(Math.min(0.1,(now-last)/1000)); last=now; requestAnimationFrame(tick); };
    return { get on(){ return on; }, set(v){ on=v; if(v){ last=performance.now(); requestAnimationFrame(tick); } } };
  }
  function playBtn(ctl, loop){
    const b=ctl.querySelector('[data-play]'), ui=()=>{ b.innerHTML=loop.on?PAUSE:PLAY; b.title=loop.on?'หยุด':'เล่น'; };
    b.onclick=()=>{ loop.set(!loop.on); ui(); }; ui(); return ui;
  }
  function moon(tab){
    if(!moonTex){ moonTex=new Image(); moonTex.src='textures/moon_color_4k.jpg'; setMoonImage(moonTex); }
    const root=openSheet(head('บทเรียน · โลกและดวงจันทร์','ข้างขึ้นข้างแรม อุปราคา และฤดูกาล','สามเรื่องนี้เกิดจากการโคจรของโลกและดวงจันทร์ ลองเลื่อนดู แล้วกดฟังคำอธิบาย',
      [['phases','ข้างขึ้นข้างแรม'],['eclipse','อุปราคา'],['seasons','ฤดูกาล']]),{w:920});
    tabbed(root,{phases:phasesTab,eclipse:eclipseTab,seasons:seasonsTab},tab);
  }
  function phasesTab(el){
    hush(); const today=moonAge(); let age=today;
    const paint=board(el,(g,w,h)=>drawPhases(g,w,h,{age,today}));
    const ctl=document.createElement('div'); ctl.className='ml-ctl';
    ctl.innerHTML=`<button class="ib ml-play" data-play></button><label class="ml-range"><span>อายุดวงจันทร์</span><input type="range" min="0" max="29.5" step="0.05" value="${age.toFixed(2)}"></label><button class="chip" data-now>คืนนี้</button>`;
    el.appendChild(ctl);
    const r=ctl.querySelector('input'), set=a=>{ age=a; r.value=a.toFixed(2); paint(); };
    const loop=looper(el,dt=>set((age+dt*2.5)%29.5)), ui=playBtn(ctl,loop);
    r.oninput=()=>{ loop.set(false); ui(); age=+r.value; paint(); };
    ctl.querySelector('[data-now]').onclick=()=>{ loop.set(false); ui(); set(today); };
    narration(el,'x-phases',EXTRA_TEXT.phases);
  }
  function eclipseTab(el){
    hush(); let mode='solar';
    const paint=board(el,(g,w,h)=>drawEclipse(g,w,h,{mode}));
    const ctl=document.createElement('div'); ctl.className='ml-ctl';
    ctl.innerHTML=`<div class="chips">${[['solar','สุริยุปราคา'],['lunar','จันทรุปราคา'],['tilt','ทำไมไม่เกิดทุกเดือน']].map(([k,l])=>`<button class="chip${k===mode?' on':''}" data-m="${k}">${l}</button>`).join('')}</div>`;
    el.appendChild(ctl);
    ctl.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; ctl.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x===b)); paint(); });
    narration(el,'x-eclipse',EXTRA_TEXT.eclipse);
  }
  function seasonsTab(el){
    hush(); const today=dayOfYear(new Date()); let doy=today;
    const paint=board(el,(g,w,h)=>drawSeasons(g,w,h,{doy:Math.round(doy)}));
    const ctl=document.createElement('div'); ctl.className='ml-ctl';
    ctl.innerHTML=`<button class="ib ml-play" data-play></button><label class="ml-range"><span>วันในหนึ่งปี</span><input type="range" min="1" max="365" step="1" value="${doy}"></label><button class="chip" data-now>วันนี้</button>`;
    el.appendChild(ctl);
    const r=ctl.querySelector('input'), set=d=>{ doy=d; r.value=Math.round(d); paint(); };
    const loop=looper(el,dt=>set((doy-1+dt*40)%365+1)), ui=playBtn(ctl,loop);
    r.oninput=()=>{ loop.set(false); ui(); doy=+r.value; paint(); };
    ctl.querySelector('[data-now]').onclick=()=>{ loop.set(false); ui(); set(today); };
    narration(el,'x-seasons',EXTRA_TEXT.seasons);
  }

  // ---------- คู่มือ ----------
  function help(){
    const K=[['Space','เล่น / หยุดเวลา'],['← →','ดาวก่อนหน้า / ถัดไป'],['1 – 8','ดาวเคราะห์ดวงที่ 1–8 นับจากดวงอาทิตย์'],['9','ดวงจันทร์'],['0','ดวงอาทิตย์'],
      ['O','ถอยกล้องดูทั้งระบบ'],['T','เริ่ม / จบทัวร์นำชม'],['E','ทัวร์บรรยายภาษาไทย / อังกฤษ'],['L','แสงเดินทาง'],['F','เต็มจอ'],['H','ซ่อนเมนูทั้งหมด (สำหรับฉายขึ้นจอ)'],['Esc','ปิดหน้าต่าง']];
    const M=[['ลาก','หมุนมุมมอง'],['ล้อเมาส์ / บีบสองนิ้ว','ซูมเข้า–ออก'],['คลิกขวาลาก / ลากสองนิ้ว','เลื่อนมุมมอง'],['กดชื่อดาว','เปิดบทเรียนของดาวดวงนั้น']];
    const root=openSheet(head('คู่มือ','วิธีใช้และคีย์ลัด',null),{w:720});
    root.querySelector('.sh-body').innerHTML=`<div class="help"><div><h4 class="sub">แป้นพิมพ์</h4><dl>${K.map(([k,v])=>`<div><dt><kbd>${k}</kbd></dt><dd>${v}</dd></div>`).join('')}</dl></div>
      <div><h4 class="sub">เมาส์ / หน้าจอสัมผัส</h4><dl>${M.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <h4 class="sub">ที่มาของภาพพื้นผิว</h4><p class="note">ภาพพื้นผิวดาวและทางช้างเผือก: Solar System Scope (อ้างอิงข้อมูล NASA) สัญญาอนุญาต CC BY 4.0 · แผนที่ปกติและค่าสะท้อนแสงของโลก: ตัวอย่างจาก three.js</p></div></div>`;
  }

  return { compare, calc, timeline, quiz, moon, help, key:e=>quizKey?quizKey(e):false, clearKey:()=>{ quizKey=null; } };
}
