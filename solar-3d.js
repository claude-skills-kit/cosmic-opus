import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FilmShader = {
  uniforms:{tDiffuse:{value:null},uT:{value:0},uGrain:{value:0.018},uVig:{value:0.9}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float uT,uGrain,uVig; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 d=vUv-0.5; float r2=dot(d,d);
    float ca=0.0016*r2;                                  // chromatic aberration at the edges
    vec3 c; c.r=texture2D(tDiffuse,vUv+d*ca).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv-d*ca).b;
    c*=mix(1.0,smoothstep(0.95,0.18,length(d)),uVig);    // vignette
    float g=(h(vUv*vec2(1920.,1080.)+uT)-0.5);
    c+=g*uGrain*(0.35+0.65*(1.0-dot(c,vec3(0.33))));
    gl_FragColor=vec4(c,1.0);
  }`
};

const S = window.SOLAR;
const R2 = Math.PI/180;

// ---------- procedural fallback textures (ใช้เมื่อยังไม่มีไฟล์ใน textures/) ----------
function noise2(x,y,s){ const n=Math.sin(x*12.9898+y*78.233+s)*43758.5453; return n-Math.floor(n); }
function fbmRow(w,y,seed,oct){ const a=new Float32Array(w); for(let o=0;o<oct;o++){ const f=2**o, amp=1/f; const step=w/(8*f); for(let x=0;x<w;x++){ const i=x/step, i0=Math.floor(i), t=i-i0; const p=(k)=>noise2(k%(8*f),y*f/40|0,seed+o*13); const v=p(i0)*(1-t)+p(i0+1)*t; a[x]+=v*amp; } } return a; }
function proceduralTexture(body){
  const w=1024,h=512,c=document.createElement('canvas'); c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  const base=new THREE.Color(body.color);
  const gas = body.kind==='star' || ['jupiter','saturn','uranus','neptune'].includes(body.id);
  for(let y=0;y<h;y++){
    const lat=(y/h-0.5)*2;
    let row;
    if(gas){
      const bands=Math.sin(lat*Math.PI*(body.id==='jupiter'?9:body.id==='saturn'?7:3))*0.5+0.5;
      row=fbmRow(w,y,body.id.length*7,3);
      for(let x=0;x<w;x++){
        const t=bands*0.55+row[x]*0.35+0.15;
        const col=base.clone().offsetHSL(0,(t-0.5)*0.08,(t-0.5)*0.28);
        ctx.fillStyle='#'+col.getHexString(); ctx.fillRect(x,y,1,1);
      }
    } else {
      row=fbmRow(w,y,body.id.length*11,4);
      for(let x=0;x<w;x++){
        const t=row[x]*0.5+0.4-Math.abs(lat)*0.12;
        const col=base.clone().offsetHSL((row[x]-0.5)*0.02,0,(t-0.5)*0.4);
        ctx.fillStyle='#'+col.getHexString(); ctx.fillRect(x,y,1,1);
      }
      // craters / mottling
      for(let k=0;k<22;k++){
        const cx=Math.random()*w, cy=Math.random()*h, r=6+Math.random()*40*(1-Math.abs(lat)*0.3);
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
        g.addColorStop(0,'rgba(0,0,0,0.07)'); g.addColorStop(0.65,'rgba(255,255,255,0.045)'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,r,0,6.3); ctx.fill();
      }
    }
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function ringTexture(){
  const w=1024,h=8,c=document.createElement('canvas'); c.width=w;c.height=h; const ctx=c.getContext('2d');
  for(let x=0;x<w;x++){
    const u=x/w;
    let a=0.85;
    if(u<0.28) a=0; else if(u>0.98) a=0;
    a*= 0.55+0.45*Math.sin(u*140)*0.5+0.3*Math.sin(u*47);
    if(u>0.70&&u<0.735) a*=0.12; // Cassini division
    const l=200+40*Math.sin(u*90);
    ctx.fillStyle=`rgba(${l|0},${(l*0.94)|0},${(l*0.8)|0},${Math.max(0,Math.min(1,a))})`;
    ctx.fillRect(x,0,1,h);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

const loader=new THREE.TextureLoader();
function loadTex(file, body, cb){
  if(!file){ cb(proceduralTexture(body)); return; }
  loader.load('textures/'+file, t=>{ t.colorSpace=THREE.SRGBColorSpace; cb(t); }, undefined, ()=>cb(proceduralTexture(body)));
}
function loadRaw(file, cb){ if(!file) return; loader.load('textures/'+file, t=>{ t.anisotropy=8; cb(t); }, undefined, ()=>{}); }

// ---------- physically-motivated planet shader ----------
const PV=`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vW;
void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vP=mv.xyz;
 vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`;
const PF=`#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uDay,uNight,uSpec,uNorm,uClouds,uRingTex; uniform vec4 uFlags,uRing; uniform vec3 uSun,uAtmo,uRingN,uCenter;
uniform float uAtmoK,uGas,uCloudRot,uSunI,uAmb,uNormK;
varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vW;
vec3 perturb(vec3 p,vec3 n,vec3 m,vec2 uv){ vec3 q0=dFdx(p),q1=dFdy(p); vec2 s0=dFdx(uv),s1=dFdy(uv);
 vec3 q1p=cross(q1,n),q0p=cross(n,q0); vec3 T=q1p*s0.x+q0p*s1.x,B=q1p*s0.y+q0p*s1.y;
 float det=max(dot(T,T),dot(B,B)); float sc=det==0.?0.:inversesqrt(det); return normalize(T*(m.x*sc)+B*(m.y*sc)+n*m.z); }
void main(){
#include <logdepthbuf_fragment>
 vec3 Ng=normalize(vN); vec3 N=Ng;
 vec3 L=normalize((viewMatrix*vec4(uSun,1.)).xyz-vP); vec3 V=normalize(-vP);
 if(uFlags.z>0.5){ vec3 m=texture2D(uNorm,vUv).xyz*2.-1.; m.xy*=uNormK; N=perturb(vP,Ng,normalize(m),vUv); }
 vec3 day=texture2D(uDay,vUv).rgb;
 float ng=dot(Ng,L), nl=dot(N,L), mu=max(dot(Ng,V),0.);
 float wrap=uAtmoK>0.?0.1:0.0;
 float diff=clamp((nl+wrap)/(1.+wrap),0.,1.)*smoothstep(-0.12,0.06,ng);
 if(uGas>0.5) diff*=0.62+0.38*pow(mu,0.4);
 float sh=1.;
 if(uRing.x>0.5){ vec3 Lw=normalize(uSun-vW); float dn=dot(Lw,uRingN);
  if(abs(dn)>1e-4){ float t=dot(uCenter-vW,uRingN)/dn; if(t>0.){ float r=length(vW+Lw*t-uCenter); float ru=(r-uRing.y)/(uRing.z-uRing.y);
   if(ru>0.&&ru<1.) sh=1.-texture2D(uRingTex,vec2(ru,.5)).a*0.82; } } }
 if(uFlags.w>0.5){ float c=texture2D(uClouds,vUv-vec2(uCloudRot-0.0012,0.)).r; sh*=1.-c*0.42; }
 vec3 col=day*diff*sh*uSunI;
 if(uAtmoK>0.){ float term=smoothstep(-0.06,0.18,ng)*(1.-smoothstep(0.18,0.5,ng)); col*=mix(vec3(1.),vec3(1.18,0.8,0.58),term*0.55*uAtmoK); }
 if(uFlags.y>0.5){ float s=texture2D(uSpec,vUv).r; vec3 H=normalize(L+V);
  float sp=pow(max(dot(N,H),0.),90.)*1.6+pow(max(dot(N,H),0.),12.)*0.08; col+=vec3(1.,.9,.76)*sp*s*sh*smoothstep(0.,0.12,ng)*uSunI; }
 if(uFlags.x>0.5){ vec3 n=texture2D(uNight,vUv).rgb; float c=uFlags.w>0.5?texture2D(uClouds,vUv-vec2(uCloudRot,0.)).r:0.;
  col+=pow(n,vec3(1.35))*vec3(1.,.74,.42)*2.2*(1.-c*0.7)*smoothstep(0.06,-0.2,ng); }
 if(uAtmoK>0.){ float rim=pow(1.-mu,2.4); float lit=smoothstep(-0.22,0.45,ng);
  col+=uAtmo*rim*lit*uAtmoK*0.9*uSunI; col=mix(col,uAtmo*lit*uSunI,pow(1.-mu,6.)*0.55*uAtmoK); }
 col+=day*uAmb;
 gl_FragColor=vec4(col,1.);
}`;
function planetMaterial(b){
  const gas=['jupiter','saturn','uranus','neptune'].includes(b.id);
  const m=new THREE.ShaderMaterial({vertexShader:PV,fragmentShader:PF,uniforms:{
    uDay:{value:null},uNight:{value:null},uSpec:{value:null},uNorm:{value:null},uClouds:{value:null},uRingTex:{value:null},
    uFlags:{value:new THREE.Vector4()},uRing:{value:new THREE.Vector4()},uSun:{value:new THREE.Vector3()},
    uAtmo:{value:new THREE.Color(b.atmo||'#000')},uAtmoK:{value:b.atmoK||0},uGas:{value:gas?1:0},uCloudRot:{value:0},
    uSunI:{value:1.0},uAmb:{value:0.014},uNormK:{value:b.id==='moon'?1.0:0.6},uRingN:{value:new THREE.Vector3(0,1,0)},uCenter:{value:new THREE.Vector3()}}});
  const U=m.uniforms;
  loadTex(b.tex,b,t=>{t.anisotropy=8;U.uDay.value=t;});
  loadRaw(b.texNight,t=>{t.colorSpace=THREE.SRGBColorSpace;U.uNight.value=t;U.uFlags.value.x=1;});
  loadRaw(b.texSpec,t=>{U.uSpec.value=t;U.uFlags.value.y=1;});
  loadRaw(b.texNormal,t=>{U.uNorm.value=t;U.uFlags.value.z=1;});
  loadRaw(b.texClouds,t=>{U.uClouds.value=t;U.uFlags.value.w=1;});
  return m;
}
function cloudMaterial(){
  return new THREE.ShaderMaterial({vertexShader:PV,transparent:true,depthWrite:false,uniforms:{uTex:{value:null},uSun:{value:new THREE.Vector3()},uSunI:{value:1.0}},
  fragmentShader:`#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex; uniform vec3 uSun; uniform float uSunI; varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
 vec3 N=normalize(vN); vec3 L=normalize((viewMatrix*vec4(uSun,1.)).xyz-vP); float ng=dot(N,L);
 float c=texture2D(uTex,vUv).r; float mu=max(dot(N,normalize(-vP)),0.);
 float lit=smoothstep(-0.1,0.3,ng); vec3 col=vec3(1.,.98,.95)*lit*uSunI*mix(vec3(1.),vec3(1.2,.75,.5),smoothstep(-0.05,0.15,ng)*(1.-smoothstep(0.15,0.4,ng)));
 gl_FragColor=vec4(col,c*0.92*(0.35+0.65*smoothstep(0.,0.35,mu)));
}`});
}
function ringMaterial(){
  return new THREE.ShaderMaterial({vertexShader:PV,transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{uTex:{value:null},uSun:{value:new THREE.Vector3()},uCenter:{value:new THREE.Vector3()},uR:{value:1},uN:{value:new THREE.Vector3(0,1,0)},uSunI:{value:1.0}},
  fragmentShader:`#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex; uniform vec3 uSun,uCenter,uN; uniform float uR,uSunI; varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
 vec4 t=texture2D(uTex,vec2(vUv.x,.5)); if(t.a<0.01) discard;
 vec3 d=normalize(uSun-vW); vec3 oc=vW-uCenter; float b=dot(oc,d);
 float dist=length(oc-d*b); float sh=b<0.?smoothstep(uR*0.985,uR*1.02,dist):1.;
 vec3 camW=cameraPosition; float sameSide=sign(dot(camW-vW,uN))*sign(dot(uSun-vW,uN));
 float face=sameSide>0.?1.:0.28+0.5*(1.-t.a);
 vec3 col=t.rgb*uSunI*sh*face*1.05+t.rgb*0.012;
 gl_FragColor=vec4(col,t.a*0.96);
}`});
}

// ---------- sun shader ----------
const sunMat = new THREE.ShaderMaterial({
  uniforms:{ uTex:{value:null}, uTime:{value:0} },
  vertexShader:`varying vec3 vN; varying vec3 vV; varying vec2 vUv;
  void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform sampler2D uTex; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
  void main(){
    float mu=max(dot(normalize(vN),normalize(vV)),0.0);
    float limb=0.35+0.65*pow(mu,0.55);            // Eddington-like limb darkening
    vec3 tex=texture2D(uTex, vUv+vec2(uTime*0.004,0.)).rgb;
    float lum=dot(tex,vec3(0.33));
    vec3 hot=vec3(1.0,0.93,0.78), warm=vec3(1.0,0.55,0.16);
    vec3 col=mix(warm,hot,clamp(lum*1.25,0.,1.))*limb;
    col+= pow(1.0-mu,3.5)*vec3(0.9,0.28,0.08)*0.9;  // chromosphere rim
    gl_FragColor=vec4(col*1.25,1.0);
  }`
});
function glowSprite(color,size){
  const c=document.createElement('canvas'); c.width=c.height=256; const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,240,210,0.95)'); g.addColorStop(0.14,'rgba(255,190,110,0.55)');
  g.addColorStop(0.4,'rgba(255,140,60,0.16)'); g.addColorStop(1,'rgba(255,120,40,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,color}));
  s.scale.setScalar(size); return s;
}

// ---------- atmosphere shell ----------
function atmoShell(radius,color,strength){
  const m=new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(color)},uS:{value:strength},uLight:{value:new THREE.Vector3(1,0,0)}},
    vertexShader:`varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); vW=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 uColor; uniform float uS; uniform vec3 uLight; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float rim=pow(1.0-max(dot(vN,vV),0.0),3.0); float lit=smoothstep(-0.35,0.35,dot(vW,normalize(uLight)));
      gl_FragColor=vec4(uColor, rim*uS*lit); }`,
    transparent:true, blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius,48,32), m);
}

// ================================================================
export class SolarScene {
  constructor(canvas, labelHost, opts={}){
    this.canvas=canvas; this.labelHost=labelHost; this.onSelect=opts.onSelect||(()=>{}); this.onLight=opts.onLight||null; this.showBelts=true;
    this.mode='map'; this.date=new Date(); this.speed=1; this.playing=true; this.focus=null;
    this.showOrbits=true; this.showLabels=true; this.panelPx=0;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.05;
    this.renderer.xr.enabled=true; this.onXRFrame=null; this._cw=new THREE.Vector3();
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(48,1,0.001,200000);
    this.camera.position.set(0,38,70);
    this.rig=new THREE.Group(); this.rig.add(this.camera); this.scene.add(this.rig); // identity on screen; VR moves and scales it
    this.controls=new OrbitControls(this.camera,canvas);
    this.controls.enableDamping=true; this.controls.dampingFactor=0.055; this.controls.rotateSpeed=0.75;
    this.controls.enableZoom=false; this.controls.minDistance=0; this.controls.maxDistance=Infinity;
    this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.PAN};
    this._zoom(canvas);
    this._buildSky(); this._buildStars(); this._buildHaze(); this._buildBodies(); this._buildBelts(); this._buildLight();
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.55,0.6,0.9);
    this.composer.addPass(this.bloom);
    this.film=new ShaderPass(FilmShader); this.composer.addPass(this.film);
    this.composer.addPass(new OutputPass());
    this.spin={};
    this.ray=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    canvas.addEventListener('pointerdown',e=>{this._down={x:e.clientX,y:e.clientY};});
    canvas.addEventListener('pointerup',e=>{ if(!this._down) return; const d=Math.hypot(e.clientX-this._down.x,e.clientY-this._down.y); if(d<5) this._pick(e); });
    this.clock=new THREE.Clock();
    new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
    this.resize(); this.renderer.setAnimationLoop(()=>this._loop()); // also drives WebXR frames
  }

  // ---------- smooth, clamped zoom (wheel + pinch) ----------
  _zoom(canvas){
    this.distTarget=null; this._pts=new Map(); this._pinch=0;
    const bump=f=>{
      const cur=this.distTarget ?? this.camera.position.distanceTo(this.controls.target);
      this.distTarget=this._clampDist(cur*f);
    };
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const d=Math.max(-120,Math.min(120,e.deltaMode===1?e.deltaY*18:e.deltaY));
      bump(Math.exp(d*0.0016));
    },{passive:false});
    canvas.addEventListener('pointerdown',e=>{ if(e.pointerType==='touch') this._pts.set(e.pointerId,e); });
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerType!=='touch'||!this._pts.has(e.pointerId)) return;
      this._pts.set(e.pointerId,e);
      if(this._pts.size===2){
        const [a,b]=[...this._pts.values()];
        const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
        if(this._pinch) bump(this._pinch/d);
        this._pinch=d;
      }
    });
    const up=e=>{ this._pts.delete(e.pointerId); if(this._pts.size<2) this._pinch=0; };
    canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);
  }
  _clampDist(d){
    const f=this.focus&&this.items.find(i=>i.b.id===this.focus);
    const min=f? this.radiusFor(f.b)*1.35 : (this.mode==='true'?0.02:0.35);
    return Math.max(min,Math.min(this.distFor(30.07)*4.5,d));
  }

  _buildSky(){
    // ทางช้างเผือกจริง (ESO/Solar System Scope, CC BY 4.0)
    const m=new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,color:new THREE.Color(0.42,0.42,0.46)});
    loader.load('textures/milkyway.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;m.map=t;m.needsUpdate=true;});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(95000,64,32),m);
    this.sky.rotation.set(1.05,0,0.35); this.sky.renderOrder=-10; this.scene.add(this.sky);
  }
  _buildHaze(){
    // แสงจักรราศี (zodiacal light) บนระนาบสุริยวิถี
    const c=document.createElement('canvas'); c.width=c.height=512; const cx=c.getContext('2d');
    const rg=cx.createRadialGradient(256,256,0,256,256,256);
    rg.addColorStop(0,'rgba(255,214,158,0.26)'); rg.addColorStop(0.20,'rgba(255,180,110,0.07)');
    rg.addColorStop(0.5,'rgba(180,150,255,0.022)'); rg.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=rg; cx.fillRect(0,0,512,512);
    const t=new THREE.CanvasTexture(c);
    this.haze=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
      new THREE.MeshBasicMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.5}));
    this.haze.rotation.x=-Math.PI/2; this.scene.add(this.haze);
  }

  _buildStars(){
    const N=2200, pos=new Float32Array(N*3), col=new Float32Array(N*3), sz=new Float32Array(N);
    const tints=[[1,.95,.9],[1,.85,.7],[.8,.87,1],[1,1,.95],[1,.72,.55]];
    for(let i=0;i<N;i++){
      const u=Math.random()*2-1, th=Math.random()*6.2832, r=90000, s=Math.sqrt(1-u*u);
      pos[i*3]=r*s*Math.cos(th); pos[i*3+1]=r*u*0.75; pos[i*3+2]=r*s*Math.sin(th);
      const t=tints[(Math.random()*tints.length)|0], b=0.25+Math.pow(Math.random(),3)*0.8;
      col[i*3]=t[0]*b; col[i*3+1]=t[1]*b; col[i*3+2]=t[2]*b;
      sz[i]=(Math.random()<0.03?3.2:1)*(200+Math.random()*700);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    g.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
    const m=new THREE.ShaderMaterial({
      uniforms:{uT:{value:0},uS:{value:1}},
      vertexShader:`attribute float aSize; varying vec3 vC; varying float vTw; uniform float uT,uS;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.);
        vTw=0.78+0.22*sin(uT*1.6+position.x*0.0007+position.y*0.0011);
        gl_Position=projectionMatrix*mv; gl_PointSize=aSize*(1.0/(-mv.z*uS))*40.0; }`,
      fragmentShader:`varying vec3 vC; varying float vTw;
        void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard;
        float a=pow(1.0-r*2.0,2.2); gl_FragColor=vec4(vC*vTw,a); }`,
      transparent:true, vertexColors:true, blending:THREE.AdditiveBlending, depthWrite:false
    });
    this.stars=new THREE.Points(g,m); this.scene.add(this.stars);
  }

  _buildBodies(){
    this.items=[]; this.orbitLines=[];
    for(const b of S.BODIES){
      const geo=new THREE.SphereGeometry(1,96,64);
      let mat;
      if(b.kind==='star'){ mat=sunMat.clone(); loadTex(b.tex,b,t=>{mat.uniforms.uTex.value=t;}); }
      else mat=planetMaterial(b);
      const mesh=new THREE.Mesh(geo,mat);
      const pivot=new THREE.Group(); // holds axial tilt + spin
      pivot.add(mesh);
      const holder=new THREE.Group(); holder.add(pivot); this.scene.add(holder);
      mesh.userData.bodyId=b.id;
      const item={b,mesh,pivot,holder,mat};
      if(b.kind==='star'){ item.glow=glowSprite(0xffffff,9); holder.add(item.glow); }
      else { item.halo=glowSprite(new THREE.Color(b.color).offsetHSL(0,-0.15,0.18),3); item.halo.material.opacity=0.34; holder.add(item.halo); }
      if(b.id==='earth'){ item.atmo=atmoShell(1.028,'#4f93ff',1.25); pivot.add(item.atmo);
        const cm=cloudMaterial(); loadRaw(b.texClouds,t=>{cm.uniforms.uTex.value=t;});
        item.clouds=new THREE.Mesh(new THREE.SphereGeometry(1.006,96,64),cm); mesh.add(item.clouds); }
      if(b.id==='venus'){ item.atmo=atmoShell(1.03,'#ffdca0',0.9); pivot.add(item.atmo); }
      if(b.id==='mars'){ item.atmo=atmoShell(1.012,'#e8a57c',0.45); pivot.add(item.atmo); }
      if(b.id==='neptune'||b.id==='uranus'){ item.atmo=atmoShell(1.02,b.atmo,0.5); pivot.add(item.atmo); }
      if(b.id==='saturn'){
        const RI=1.11,RO=2.33, rg=new THREE.RingGeometry(RI,RO,256,1);
        const uv=rg.attributes.uv, p=rg.attributes.position;
        for(let i=0;i<uv.count;i++){ const r=Math.hypot(p.getX(i),p.getY(i)); uv.setXY(i,(r-RI)/(RO-RI),0.5); }
        const rmat=ringMaterial(); rmat.uniforms.uTex.value=ringTexture();
        loadRaw(b.ring,t=>{t.colorSpace=THREE.SRGBColorSpace;rmat.uniforms.uTex.value=t;mat.uniforms.uRingTex.value=t;mat.uniforms.uRing.value.set(1,RI,RO,0);});
        const ring=new THREE.Mesh(rg,rmat); ring.rotation.x=Math.PI/2; pivot.add(ring); item.ring=ring; item.ringR=[RI,RO];
      }
      if(b.el){
        const mline=new THREE.ShaderMaterial({
          uniforms:{uColor:{value:new THREE.Color(b.color).offsetHSL(0,0.05,0.06)},uHead:{value:0},uDim:{value:1}},
          vertexShader:`attribute float aT; varying float vT; void main(){ vT=aT; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
          fragmentShader:`uniform vec3 uColor; uniform float uHead,uDim; varying float vT;
            void main(){ float d=fract(uHead-vT); float a=0.055+0.95*pow(1.0-d,7.0);
            gl_FragColor=vec4(uColor*(0.55+0.85*a), a*uDim); }`,
          transparent:true, depthWrite:false, blending:THREE.AdditiveBlending});
        const line=new THREE.Line(new THREE.BufferGeometry(),mline); this.scene.add(line);
        item.line=line; this.orbitLines.push(line);
      }
      const lab=document.createElement('button'); lab.className='sol-label'; lab.dataset.id=b.id;
      lab.innerHTML=`<span>${b.th}</span><em>${b.en}</em>`;
      lab.addEventListener('click',()=>this.onSelect(b.id));
      this.labelHost.appendChild(lab); item.label=lab;
      this.items.push(item);
    }
    this._rebuildOrbits();
  }

  // ---------- scale ----------
  radiusFor(b){
    const R=b.r_km/6371;
    if(this.mode==='true') return b.r_km/1e6;
    if(b.kind==='star') return this.mode==='map'?2.2:2.6;
    return 0.5*Math.pow(R,0.42);
  }
  distFor(a){ return this.mode==='true' ? a*S.AU/1e6 : 11*Math.pow(a,0.62); }

  _rebuildOrbits(){
    const T=S.julianCenturies(this.date), N=480;
    for(const it of this.items){
      if(!it.line) continue;
      const raw=S.orbitPath(it.b.el,T,N);
      const pos=new Float32Array((N+1)*3), tt=new Float32Array(N+1);
      raw.forEach((p,i)=>{
        const r=Math.hypot(p.x,p.y,p.z), k=this.distFor(r)/r;
        pos[i*3]=p.x*k; pos[i*3+1]=p.z*k; pos[i*3+2]=-p.y*k; tt[i]=i/N;
      });
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('aT',new THREE.BufferAttribute(tt,1));
      it.line.geometry.dispose(); it.line.geometry=g;
    }
  }

  setMode(m){ if(m===this.mode) return; this.mode=m; this._rebuildOrbits(); this._frameAll(); }
  setDate(d){ this.date=new Date(d); this._rebuildOrbits(); }
  setSpeed(s){ this.speed=s; }
  setPlaying(p){ this.playing=p; }
  setOrbits(v){ this.showOrbits=v; }
  setLabels(v){ this.showLabels=v; }
  focusOn(id){
    this.focus=id;
    if(!id){ this._frameAll(); return; }
    const it=this.items.find(i=>i.b.id===id); if(!it) return;
    this._flyTo(it, this.radiusFor(it.b)*(it.b.id==='saturn'?7:4.2));
  }
  _frameAll(){
    const far=this.distFor(30.07);
    this._tween(new THREE.Vector3(0,far*0.55,far*1.1), new THREE.Vector3(0,0,0));
  }
  _flyTo(it,dist){
    const p=it.holder.position.clone();
    let dir;
    if(p.lengthSq()>1e-6){
      // มองจากมุมเฉียงกับดวงอาทิตย์ ~60° ให้เห็นเส้นแบ่งกลางวัน-กลางคืน
      dir=p.clone().multiplyScalar(-1).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),1.05);
      dir.y=0.28; dir.normalize();
    } else {
      dir=new THREE.Vector3().subVectors(this.camera.position,p).normalize();
      if(dir.lengthSq()<0.001) dir.set(0.4,0.35,1).normalize();
      dir.y=Math.max(dir.y,0.22); dir.normalize();
    }
    this._tween(p.clone().add(dir.multiplyScalar(dist)), p);
  }
  _tween(pos,target){
    this._tw={t:0,fp:this.camera.position.clone(),tp:pos,ft:this.controls.target.clone(),tt:target};
  }

  _pick(e){
    const r=this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    this.ray.setFromCamera(this.pointer,this.camera);
    const hits=this.ray.intersectObjects(this.items.map(i=>i.mesh),false);
    if(hits.length) this.onSelect(hits[0].object.userData.bodyId);
  }

  setPanelOffset(px,side='left'){ this.panelPx=px; this.panelSide=side; this.resize(); }
  resize(){
    if(this.renderer.xr.isPresenting) return;
    const p=this.canvas.parentElement, w=p.clientWidth, h=p.clientHeight;
    this.renderer.setSize(w,h,false);
    if(this.composer){ this.composer.setSize(w,h); this.bloom.setSize(w,h); }
    const side=this.panelSide||'left';
    const pw=side==='bottom'?Math.min(this.panelPx,h*0.72):Math.min(this.panelPx,w*0.6);
    if(pw>1&&side==='bottom'){ this.camera.aspect=w/(h+pw); this.camera.setViewOffset(w,h+pw,0,pw,w,h); }
    else if(pw>1){ this.camera.aspect=(w+pw)/h; this.camera.setViewOffset(w+pw,h,side==='right'?pw:0,0,w,h); }
    else { this.camera.aspect=w/h; this.camera.clearViewOffset(); }
    this.camera.updateProjectionMatrix();
  }

  // ---------- asteroid + Kuiper belts (GPU-driven Keplerian motion) ----------
  _buildBelts(){
    this.belts=[];
    const mk=(N,a0,a1,inc,color,alpha,size)=>{
      const A=new Float32Array(N),P=new Float32Array(N),I=new Float32Array(N),O=new Float32Array(N),Z=new Float32Array(N);
      for(let i=0;i<N;i++){ A[i]=a0+(a1-a0)*(Math.random()+Math.random()+Math.random())/3; P[i]=Math.random()*6.2832;
        I[i]=Math.random()*Math.random()*inc; O[i]=Math.random()*6.2832; Z[i]=0.5+Math.pow(Math.random(),4)*2.6; }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
      g.setAttribute('aA',new THREE.BufferAttribute(A,1)); g.setAttribute('aPh',new THREE.BufferAttribute(P,1));
      g.setAttribute('aInc',new THREE.BufferAttribute(I,1)); g.setAttribute('aNode',new THREE.BufferAttribute(O,1)); g.setAttribute('aSz',new THREE.BufferAttribute(Z,1));
      const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        uniforms:{uDays:{value:0},uTrue:{value:0},uPx:{value:1},uSize:{value:size},uAlpha:{value:alpha},uColor:{value:new THREE.Color(color)}},
        vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aA,aPh,aInc,aNode,aSz; uniform float uDays,uTrue,uPx,uSize; varying float vF;
void main(){
 float th=aPh+uDays*6.2831853/(365.25*pow(aA,1.5));
 float r=uTrue>0.5?aA*149.5978707:11.0*pow(aA,0.62);
 vec3 h=vec3(cos(th)*r,sin(th)*r,sin(th-aNode)*sin(aInc)*r);
 vec4 mv=modelViewMatrix*vec4(h.x,h.z,-h.y,1.0);
 gl_Position=projectionMatrix*mv; float d=-mv.z;
 gl_PointSize=clamp(aSz*uSize*uPx*90.0/d,0.7*uPx,3.2*uPx);
 vF=clamp(320.0/d,0.35,1.0);
#include <logdepthbuf_vertex>
}`,
        fragmentShader:`#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor; uniform float uAlpha; varying float vF;
void main(){
#include <logdepthbuf_fragment>
 vec2 c=gl_PointCoord-0.5; float r=length(c); if(r>0.5) discard;
 gl_FragColor=vec4(uColor*vF,uAlpha*(1.0-r*2.0));
}`});
      const p=new THREE.Points(g,m); p.frustumCulled=false; this.scene.add(p); this.belts.push(p);
    };
    mk(6500,2.15,3.3,0.35,'#cdbb9f',0.6,1.0);
    mk(7000,30,50,0.5,'#93a9cc',0.38,1.3);
  }
  setBelts(v){ this.showBelts=v; }

  // ---------- light-travel wave ----------
  _buildLight(){
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      uniforms:{uR:{value:1},uW:{value:0.1}},vertexShader:PV,
      fragmentShader:`#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uR,uW; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
 float d=length(vW.xz); float x=(d-uR)/uW;
 float ring=exp(-x*x*1.6), core=exp(-x*x*14.0);
 float wake=step(d,uR)*smoothstep(0.0,uR,d)*0.045;
 vec3 c=vec3(1.0,0.83,0.56)*(ring*1.2+wake)+vec3(1.0,0.96,0.88)*core*0.7;
 gl_FragColor=vec4(c,1.0);
}`});
    this.lightMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),m);
    this.lightMesh.rotation.x=-Math.PI/2; this.lightMesh.visible=false; this.lightMesh.frustumCulled=false; this.scene.add(this.lightMesh);
    this.light=null;
  }
  startLight(f){ this.light={t:0,factor:f||(this.light&&this.light.factor)||60,on:true}; this.lightMesh.visible=true; }
  stopLight(){ if(this.light) this.light.on=false; this.lightMesh.visible=false; }
  setLightFactor(f){ if(this.light) this.light.factor=f; }
  setAutoRotate(v){ this.controls.autoRotate=v; this.controls.autoRotateSpeed=0.45; }
  labelOf(id){ const it=this.items.find(i=>i.b.id===id); return it&&it.label; }

  _loop(){
    const dt=Math.min(this.clock.getDelta(),0.1), now=performance.now()/1000, xr=this.renderer.xr.isPresenting;
    const cw=this.camera.getWorldPosition(this._cw);
    const spr=xr?1/this.rig.scale.x:1; // sprites offset their corners in view space, so a scaled rig would blow them up
    if(this.playing) this.date=new Date(this.date.getTime()+dt*this.speed*86400000);
    const T=S.julianCenturies(this.date);
    const daysTotal=this.date.getTime()/86400000;

    for(const it of this.items){
      const b=it.b, rad=this.radiusFor(b);
      it.pivot.scale.setScalar(rad);
      if(it.glow) it.glow.scale.setScalar(rad*(this.mode==='true'?7:4.5)*spr);
      if(it.halo){ const near=cw.distanceTo(it.holder.position);
        it.halo.scale.setScalar(rad*3.4*spr); it.halo.material.opacity=Math.max(0,Math.min(0.4,near/(rad*260))); }
      if(b.el){
        const h=S.heliocentric(b.el,T), r=Math.hypot(h.x,h.y,h.z), k=this.distFor(r)/r;
        it.holder.position.set(h.x*k,h.z*k,-h.y*k);
        if(it.line) it.line.material.uniforms.uHead.value=(h.E/6.283185)%1;
      } else if(b.parent){
        const pit=this.items.find(i=>i.b.id===b.parent);
        const ang=daysTotal/b.orbitDays*6.283185;
        const d=this.mode==='true'? b.orbitKm/1e6 : Math.max(this.radiusFor(pit.b)*3.2,1.6);
        it.holder.position.set(pit.holder.position.x+Math.cos(ang)*d, pit.holder.position.y+Math.sin(ang)*d*0.09, pit.holder.position.z+Math.sin(ang)*d);
      }
      // การหมุนรอบตัวเอง — ผูกเพดานอัตราไว้เพื่อให้มองเห็นพื้นผิวทัน
      it.pivot.rotation.z=b.tilt*R2;
      if(b.rotHours){
        const capped=Math.sign(this.speed)*Math.min(Math.abs(this.speed),0.045);
        const rate=(this.playing?capped:0)*24/b.rotHours*6.283185;
        this.spin[b.id]=((this.spin[b.id]||0)+dt*rate)%6.283185;
        it.pivot.children[0].rotation.y=this.spin[b.id];
      }
      if(it.atmo) it.atmo.material.uniforms.uLight.value.copy(it.holder.position).multiplyScalar(-1).normalize();
      if(b.kind!=='star'){
        const U=it.mat.uniforms; U.uCenter.value.copy(it.holder.position);
        if(it.clouds){ if(this.playing) this.cloudRot=((this.cloudRot||0)+dt*0.0035*Math.sign(this.speed||1))%1;
          it.clouds.rotation.y=(this.cloudRot||0)*6.283185; U.uCloudRot.value=this.cloudRot||0; }
        if(it.ring){ it.pivot.updateMatrixWorld(true);
          const n=new THREE.Vector3(0,1,0).applyQuaternion(it.pivot.getWorldQuaternion(new THREE.Quaternion()));
          U.uRingN.value.copy(n); U.uRing.value.y=it.ringR[0]*rad; U.uRing.value.z=it.ringR[1]*rad;
          const RU=it.ring.material.uniforms; RU.uCenter.value.copy(it.holder.position); RU.uR.value=rad; RU.uN.value.copy(n); }
      }
      if(it.line){ it.line.visible=this.showOrbits && this.mode!=='compare';
        it.line.material.uniforms.uDim.value=this.focus?(this.focus===b.id?0.3:0.22):1; }
      if(b.kind==='star') it.mat.uniforms.uTime.value=now;
    }
    this.stars.material.uniforms.uT.value=now;
    this.sky.position.copy(cw); this.stars.material.uniforms.uS.value=xr?this.rig.scale.x:1;
    if(this.belts){ const days=T*36525, px=xr?1:this.renderer.getPixelRatio();
      for(const p of this.belts){ const u=p.material.uniforms; u.uDays.value=days; u.uTrue.value=this.mode==='true'?1:0; u.uPx.value=px; p.visible=this.showBelts; } }
    if(this.light&&this.light.on){
      const L=this.light; L.t+=dt*L.factor;
      const rAU=L.t*299792.458/S.AU, R=this.distFor(rAU), W=Math.max(R*0.012,this.mode==='true'?0.6:0.07);
      const u=this.lightMesh.material.uniforms; u.uR.value=R; u.uW.value=W;
      const s=(R+W*4)/1.1+0.01; this.lightMesh.scale.set(s,s,1);
      if(this.onLight) this.onLight(L.t,rAU);
    }
    if(this.haze){ const s=this.distFor(30.07)*1.35; this.haze.scale.set(s,s,1);
      const cp=cw, h=Math.abs(cp.y)/Math.max(cp.length(),1e-6);
      const tgt=this.focus?0:0.5*THREE.MathUtils.smoothstep(h,0.2,0.55);
      this.haze.material.opacity+=(tgt-this.haze.material.opacity)*Math.min(1,dt*4);
      this.haze.visible=this.haze.material.opacity>0.005; }
    this.film.uniforms.uT.value=now;
    if(xr){ if(this.onXRFrame) this.onXRFrame(dt); this.renderer.render(this.scene,this.camera); return; } // no post passes in a headset

    if(this._tw){
      const tw=this._tw; tw.t=Math.min(1,tw.t+dt/1.35);
      const e=tw.t<0.5?4*tw.t**3:1-(-2*tw.t+2)**3/2;
      this.camera.position.lerpVectors(tw.fp,tw.tp,e);
      this.controls.target.lerpVectors(tw.ft,tw.tt,e);
      if(tw.t>=1){ this._tw=null; this.distTarget=this.camera.position.distanceTo(this.controls.target); }
    } else {
      if(this.focus){
        const it=this.items.find(i=>i.b.id===this.focus);
        if(it){ const off=new THREE.Vector3().subVectors(this.camera.position,this.controls.target);
          this.controls.target.lerp(it.holder.position,0.16);
          this.camera.position.copy(this.controls.target).add(off); }
      }
      const off=new THREE.Vector3().subVectors(this.camera.position,this.controls.target);
      const d=off.length();
      if(this.distTarget==null) this.distTarget=d;
      const nd=d+(this.distTarget-d)*(1-Math.exp(-dt*6.5));
      if(Math.abs(nd-d)>1e-6) this.camera.position.copy(this.controls.target).add(off.multiplyScalar(nd/d));
    }
    this.controls.update();
    this._labels();
    this.composer.render();
  }

  _labels(){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight,v=new THREE.Vector3();
    const drawn=[];
    const tier=b=>this.focus===b.id?0:b.kind==='star'?1:b.kind==='planet'?2:3;
    const order=this.items.map(it=>({it,d:this.camera.position.distanceTo(it.holder.position)}))
      .sort((a,b)=>tier(a.it.b)-tier(b.it.b) || b.it.b.r_km-a.it.b.r_km || a.d-b.d);
    for(const {it} of order){
      const el=it.label;
      if(!this.showLabels){ el.style.display='none'; continue; }
      v.copy(it.holder.position).project(this.camera);
      const on=v.z<1 && v.x>-1.05 && v.x<1.05 && v.y>-1.05 && v.y<1.05;
      const dist=this.camera.position.distanceTo(it.holder.position);
      const tooFar=this.mode==='true' && dist>this.distFor(35)*1.2;
      const tooNear=dist<this.radiusFor(it.b)*9;
      const sx=(v.x*0.5+0.5)*w; let sy=(-v.y*0.5+0.5)*h-26;
      const hit=y=>drawn.some(p=>Math.abs(p[0]-sx)<70 && Math.abs(p[1]-y)<26);
      let crowded=hit(sy);
      if(crowded && it.b.parent){ if(!hit(sy+34)){ sy+=34; crowded=false; } }
      if(!on||tooFar||tooNear||crowded){ el.style.display='none'; continue; }
      drawn.push([sx,sy]);
      el.style.display='';
      el.style.transform=`translate(-50%,-50%) translate(${sx}px,${sy}px)`;
      el.classList.toggle('is-active', this.focus===it.b.id);
    }
  }
}
