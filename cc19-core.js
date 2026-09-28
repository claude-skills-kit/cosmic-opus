// Cosmic Calendar v19 — core: renderer, post FX, shaders, shared rigs
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { THREE };
const V3 = THREE.Vector3;

// ---------------------------------------------------------------- math
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=t=>{ t=clamp(t); return t*t*(3-2*t); };
export const ease=t=>{ t=clamp(t); return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; };
export const easeOut=t=>1-Math.pow(1-clamp(t),3);
export const easeIn=t=>Math.pow(clamp(t),3);
export const ramp=(t,a,b)=>clamp((t-a)/(b-a));
export const env=(t,a,b,fi=.8,fo=.8)=>smooth(Math.min((t-a)/fi,(b-t)/fo));
export function rng(a){ return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; }
export function gauss(r){ return Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(6.2831853*r()); }
export function latLon(lat,lon){ const a=lat*Math.PI/180, b=lon*Math.PI/180; return new V3(Math.cos(a)*Math.cos(b), Math.sin(a), -Math.cos(a)*Math.sin(b)); }

// ---------------------------------------------------------------- GLSL chunks
export const NOISE=`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_); vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=nm.x; p1*=nm.y; p2*=nm.z; p3*=nm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s*0.5+0.5; }
float fbm3(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s*0.5+0.5; }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
`;
export const SURF_VS=`varying vec2 vUv; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO;
void main(){ vUv=uv; vPO=position; vec4 w=modelMatrix*vec4(position,1.0); vPW=w.xyz; vNW=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
const PERTURB=`vec3 perturb(vec3 p,vec3 n,vec3 m,vec2 uv){ vec3 q0=dFdx(p),q1=dFdy(p); vec2 s0=dFdx(uv),s1=dFdy(uv);
 vec3 q1p=cross(q1,n),q0p=cross(n,q0); vec3 T=q1p*s0.x+q0p*s1.x,B=q1p*s0.y+q0p*s1.y; float det=max(dot(T,T),dot(B,B));
 float sc=det==0.0?0.0:inversesqrt(det); return normalize(T*(m.x*sc)+B*(m.y*sc)+n*m.z); }`;
export const SAFE=`bool badv(vec3 c){
#if __VERSION__ >= 300
  return any(isnan(c))||any(isinf(c));
#else
  return !(c.x==c.x&&c.y==c.y&&c.z==c.z)||max(max(abs(c.x),abs(c.y)),abs(c.z))>6.0e4;
#endif
}
`;
export const POINT_FS=`varying vec3 vC; varying float vA;
void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d)*4.0; if(r>1.0) discard; float a=pow(1.0-r,2.4)*vA; gl_FragColor=vec4(vC,a); }`;

// shared per-frame uniforms (by reference)
export const GU={ uTime:{value:0}, uPH:{value:500}, uPx:{value:1} };

// ---------------------------------------------------------------- renderer + post
export function createStage(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio)); renderer.setClearColor(0x000000,1);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(50,1,0.01,6000);
  const gl2=renderer.capabilities.isWebGL2;
  const crt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:gl2?4:0});
  const composer=new EffectComposer(renderer,crt);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.55,0.55,0.82); composer.addPass(bloom);
  bloom.materialHighPassFilter.fragmentShader='uniform sampler2D tDiffuse; uniform float luminosityThreshold,smoothWidth; varying vec2 vUv;\n'+SAFE+'\nvoid main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; if(badv(c)) c=vec3(0.0); c=clamp(c,0.0,60.0); float v=dot(c,vec3(0.299,0.587,0.114)); gl_FragColor=vec4(c*smoothstep(luminosityThreshold,luminosityThreshold+smoothWidth,v),1.0); }';
  bloom.materialHighPassFilter.needsUpdate=true;
  const finish=new ShaderPass({
    uniforms:{tDiffuse:{value:null},uTime:{value:0},uFade:{value:1},uFlash:{value:0},uTint:{value:new V3(1,1,1)},uCA:{value:0.0022},uVig:{value:1.0},uGrain:{value:0.016},uStreak:{value:0},uBars:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime,uFade,uFlash,uCA,uVig,uGrain,uStreak,uBars; uniform vec3 uTint; varying vec2 vUv;
    ${SAFE}
    vec3 tx(vec2 uv){ vec3 c=texture2D(tDiffuse,uv).rgb; return badv(c)?vec3(0.0):clamp(c,0.0,4000.0); }
    float rnd(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec2 d=vUv-0.5; float r2=dot(d,d); vec2 uvB=vUv+d*r2*0.012; vec2 off=d*r2*uCA*9.0;
      vec3 col=vec3(tx(uvB+off).r,tx(uvB).g,tx(uvB-off).b);
      vec3 st=vec3(0.0); for(float i=-6.0;i<=6.0;i+=1.5){ float w=1.0-abs(i)/7.0; st+=max(tx(uvB+vec2(i*0.011,0.0))-0.9,0.0)*w*w; }
      col+=st*vec3(0.95,0.85,1.0)*0.09;
      if(uStreak>0.001){ vec3 a=vec3(0.0); float w=0.0; for(int i=1;i<=8;i++){ float s=float(i)/8.0; float k=1.0-s; a+=tx(vUv-d*s*uStreak*0.55)*k; w+=k; } col=mix(col,a/w,clamp(uStreak*1.5,0.0,0.85)); }
      col*=uTint;
      float lum=dot(col,vec3(0.299,0.587,0.114));
      col=mix(col*vec3(0.94,0.98,1.08),col,smoothstep(0.0,0.25,lum));
      col=mix(col,col*vec3(1.04,1.0,0.93),smoothstep(0.4,1.0,lum)*0.4);
      col*=1.0-smoothstep(0.25*uVig,1.05,r2*1.25);
      col=col*uFade+vec3(uFlash);
      col+=(rnd(floor(gl_FragCoord.xy)+vec2(mod(floor(uTime*24.0),61.0)*41.0,mod(floor(uTime*24.0),47.0)*17.0))-0.5)*uGrain*smoothstep(0.012,0.3,lum);
      col=max(col,vec3(0.0));
      float bar=step(abs(d.y),0.5-uBars*0.06); col*=bar;
      gl_FragColor=vec4(col,1.0);
    }`});
  composer.addPass(finish); composer.addPass(new OutputPass());
  const dis=new ShaderPass({uniforms:{tDiffuse:{value:null},tPrev:{value:null},uK:{value:0},uZ:{value:1}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform sampler2D tDiffuse,tPrev; uniform float uK,uZ; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; if(uK>0.001){ vec2 q=0.5+(vUv-0.5)/uZ; vec3 p=texture2D(tPrev,q).rgb; c=mix(c,p,uK); } gl_FragColor=vec4(c,1.0); }`});
  composer.addPass(dis);
  let fbt=null;
  function capture(){ const v=new THREE.Vector2(); renderer.getDrawingBufferSize(v); if(!fbt||fbt.image.width!==v.x||fbt.image.height!==v.y){ fbt?.dispose(); fbt=new THREE.FramebufferTexture(v.x,v.y); }
    renderer.setRenderTarget(null); renderer.copyFramebufferToTexture(new THREE.Vector2(0,0),fbt); dis.uniforms.tPrev.value=fbt; }
  const sun=new THREE.DirectionalLight(0xfff1e0,2.4); sun.position.set(5,1,3); scene.add(sun);
  const amb=new THREE.AmbientLight(0x2a3450,0.25); scene.add(amb);
  function resize(){
    const w=innerWidth,h=innerHeight; renderer.setSize(w,h); composer.setSize(w,h); bloom.setSize(w,h);
    camera.aspect=w/h; camera.updateProjectionMatrix();
    GU.uPx.value=renderer.getPixelRatio();
  }
  addEventListener('resize',resize); resize();
  return {renderer,scene,camera,composer,bloom,finish,sun,amb,resize,dis,capture};
}

// ---------------------------------------------------------------- textures
const loader=new THREE.TextureLoader(); const cache={};
export function tex(file,srgb=true){
  const k=file+(srgb?'s':'l'); if(cache[k]) return cache[k];
  const t=loader.load('textures/'+file); t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace; t.anisotropy=8; t.wrapS=THREE.RepeatWrapping;
  return cache[k]=t;
}
function canvasTex(size,draw){ const c=document.createElement('canvas'); c.width=c.height=size; draw(c.getContext('2d'),size); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export const SPR={
  glow:canvasTex(256,(g,s)=>{ const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(.12,'rgba(255,255,255,.55)'); r.addColorStop(.35,'rgba(255,255,255,.14)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,s,s); }),
  soft:canvasTex(128,(g,s)=>{ const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,s,s); }),
  star:canvasTex(256,(g,s)=>{ const c=s/2; const r=g.createRadialGradient(c,c,0,c,c,c); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(.05,'rgba(255,255,255,.9)'); r.addColorStop(.2,'rgba(255,255,255,.12)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,s,s);
    g.globalCompositeOperation='lighter'; for(const [w,h] of [[s,3],[3,s]]){ const l=g.createLinearGradient(c-w/2,c-h/2,c+w/2,c+h/2); l.addColorStop(0,'rgba(255,255,255,0)'); l.addColorStop(.5,'rgba(255,255,255,.55)'); l.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=l; g.fillRect(c-w/2,c-h/2,w,h); } })
};
export function sprite(map,color,opacity=1,blend=THREE.AdditiveBlending){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map,color:new THREE.Color(color),transparent:true,opacity,depthWrite:false,blending:blend})); return s;
}
export function points(n,attrs,vs,uniforms={},opts={}){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(attrs.position||new Float32Array(n*3),3));
  for(const k in attrs) if(k!=='position') g.setAttribute(k,new THREE.BufferAttribute(attrs[k],attrs[k].length/n));
  const m=new THREE.ShaderMaterial({uniforms:{...uniforms,uTime:GU.uTime,uPH:GU.uPH,uPx:GU.uPx},vertexShader:'uniform float uTime,uPH,uPx;\n'+NOISE+vs.replace(/}\s*$/,' if(!(gl_PointSize>0.0)) gl_PointSize=1.0; float mnP=max(2.0,1.5*uPx); if(gl_PointSize<mnP){ vA*=gl_PointSize*gl_PointSize/(mnP*mnP); gl_PointSize=mnP; } }'),fragmentShader:opts.fs||POINT_FS,
    transparent:true,depthWrite:false,blending:opts.blending??THREE.AdditiveBlending});
  const p=new THREE.Points(g,m); p.frustumCulled=false; return p;
}

// ---------------------------------------------------------------- sky: real Milky Way + star points
export function makeSky(scene){
  const g=new THREE.Group(); scene.add(g);
  const mm=new THREE.MeshBasicMaterial({map:tex('milkyway.jpg'),side:THREE.BackSide,depthWrite:false,transparent:true,opacity:0,color:new THREE.Color(0.55,0.55,0.6)});
  const milky=new THREE.Mesh(new THREE.SphereGeometry(3000,64,32),mm); milky.rotation.set(1.1,0.2,0.45); milky.renderOrder=-10; g.add(milky);
  const N=5000, r=rng(7), P=new Float32Array(N*3), C=new Float32Array(N*3), S=new Float32Array(N);
  const tints=[[1,.94,.86],[1,.82,.66],[.78,.86,1],[1,1,1],[.92,.95,1]];
  for(let i=0;i<N;i++){ const u=r()*2-1,th=r()*6.2832,s=Math.sqrt(1-u*u); P[i*3]=2800*s*Math.cos(th); P[i*3+1]=2800*u; P[i*3+2]=2800*s*Math.sin(th);
    const t=tints[(r()*5)|0], b=.35+Math.pow(r(),3)*1.3; C[i*3]=t[0]*b; C[i*3+1]=t[1]*b; C[i*3+2]=t[2]*b; S[i]=0.8+Math.pow(r(),6)*3.5; }
  const stars=points(N,{position:P,aC:C,aS:S},`attribute vec3 aC; attribute float aS; uniform float uK; varying vec3 vC; varying float vA;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aS*uPx*1.6;
      vC=aC; vA=uK*(0.75+0.25*sin(uTime*2.0+position.x*0.013+position.z*0.007)); }`,{uK:{value:0}});
  stars.renderOrder=-9; g.add(stars);
  return { group:g, set(milk,st){ mm.opacity=milk; milky.visible=milk>0.002; stars.material.uniforms.uK.value=st; stars.visible=st>0.002; }, follow(cam){ g.position.copy(cam.position); } };
}

// ---------------------------------------------------------------- the Sun
export function makeSun(R=1){
  const g=new THREE.Group();
  const mat=new THREE.ShaderMaterial({uniforms:{uTime:GU.uTime,uI:{value:1},uHot:{value:0}},vertexShader:SURF_VS,
    fragmentShader:NOISE+`uniform float uTime,uI,uHot; varying vec2 vUv; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO;
    void main(){ vec3 N=normalize(vNW),V=normalize(cameraPosition-vPW); float mu=clamp(dot(N,V),0.0,1.0); vec3 p=normalize(vPO);
      float big=fbm(p*3.2+vec3(0.0,uTime*0.03,0.0)); float gr=snoise(p*42.0+vec3(uTime*0.35))*0.5+0.5; float gr2=snoise(p*95.0-vec3(uTime*0.6))*0.5+0.5;
      float spots=smoothstep(0.74,0.8,fbm3(p*2.4+vec3(4.0,uTime*0.008,1.0)));
      float heat=clamp(0.42+big*0.42+gr*0.22+gr2*0.1-spots*0.55,0.0,1.4);
      vec3 c=mix(vec3(0.95,0.28,0.03),vec3(1.0,0.72,0.34),smoothstep(0.2,0.8,heat)); c=mix(c,vec3(1.0,0.95,0.82),smoothstep(0.75,1.2,heat));
      c=mix(c,vec3(0.85,0.93,1.0),uHot*0.6);
      c*=0.34+0.66*pow(mu,0.5); c+=vec3(1.0,0.4,0.1)*pow(1.0-mu,4.0)*0.7;
      gl_FragColor=vec4(c*uI*2.4,1.0); }`});
  const body=new THREE.Mesh(new THREE.SphereGeometry(R,96,64),mat); g.add(body);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(R*1.18,64,32),new THREE.ShaderMaterial({uniforms:{uI:mat.uniforms.uI},vertexShader:SURF_VS,
    fragmentShader:`uniform float uI; varying vec3 vNW; varying vec3 vPW; void main(){ vec3 N=normalize(vNW),V=normalize(cameraPosition-vPW); float f=pow(clamp(1.0-abs(dot(N,V)),0.0,1.0),2.5); gl_FragColor=vec4(vec3(1.0,0.55,0.2)*f*uI*1.4,1.0); }`,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide}));
  g.add(shell);
  const c1=sprite(SPR.glow,0xffb766,0.9); c1.scale.setScalar(R*5.5); g.add(c1);
  const c2=sprite(SPR.glow,0xff8a3d,0.35); c2.scale.setScalar(R*16); g.add(c2);
  g.userData={mat,body,set(i){ mat.uniforms.uI.value=i; c1.material.opacity=0.9*Math.min(1,i); c2.material.opacity=0.35*Math.min(1,i); }};
  return g;
}

// ---------------------------------------------------------------- generic planet (rocky / gas / moon)
export function planetMat({map,normal,atmo='#000000',atmoK=0,gas=0,normK=1,tint='#ffffff'}){
  const u={uMap:{value:map},uNorm:{value:normal||null},uHasN:{value:normal?1:0},uNormK:{value:normK},uSun:{value:new V3(0,0,0)},uAtmo:{value:new THREE.Color(atmo)},uAtmoK:{value:atmoK},
    uGas:{value:gas},uTint:{value:new THREE.Color(tint)},uRing:{value:new THREE.Vector4()},uRingN:{value:new V3(0,1,0)},uCenter:{value:new V3()},uRingTex:{value:null},uHeat:{value:0},uTime:GU.uTime,uAmb:{value:0.012},uDetail:{value:0}};
  return new THREE.ShaderMaterial({uniforms:u,vertexShader:SURF_VS,fragmentShader:NOISE+PERTURB+`
  uniform sampler2D uMap,uNorm,uRingTex; uniform float uHasN,uNormK,uAtmoK,uGas,uHeat,uTime,uAmb,uDetail; uniform vec3 uSun,uAtmo,uTint,uRingN,uCenter; uniform vec4 uRing;
  varying vec2 vUv; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO;
  void main(){ vec3 Ng=normalize(vNW),N=Ng; vec3 L=normalize(uSun-vPW), V=normalize(cameraPosition-vPW);
    if(uHasN>0.5){ vec3 m=texture2D(uNorm,vUv).xyz*2.0-1.0; m.xy*=uNormK; N=perturb(vPW,Ng,normalize(m),vUv); }
    vec3 al=texture2D(uMap,vUv).rgb*uTint; float ng=dot(Ng,L), mu=clamp(dot(Ng,V),0.0,1.0);
    if(uDetail>0.0){ vec3 q=normalize(vPO); float fd=smoothstep(0.6,0.02,length(cameraPosition-vPW)); float d1=fbm3(q*240.0), d2=snoise(q*900.0)*0.5+0.5; al*=1.0+uDetail*fd*((d1-0.5)*0.8+(d2-0.5)*0.35);
      vec3 gx=vec3(snoise(q*300.0+1.7),snoise(q*300.0+5.3),snoise(q*300.0+9.1)); N=normalize(N+gx*0.18*uDetail*fd); }
    float diff=clamp(dot(N,L),0.0,1.0)*smoothstep(-0.1,0.08,ng); if(uGas>0.5) diff*=0.62+0.38*pow(mu,0.4);
    float sh=1.0;
    if(uRing.x>0.5){ float dn=dot(L,uRingN); if(abs(dn)>1e-4){ float t=dot(uCenter-vPW,uRingN)/dn; if(t>0.0){ float r=length(vPW+L*t-uCenter); float ru=(r-uRing.y)/(uRing.z-uRing.y); if(ru>0.0&&ru<1.0) sh=1.0-texture2D(uRingTex,vec2(ru,0.5)).a*0.8; } } }
    vec3 col=al*diff*sh*1.05+al*uAmb;
    if(uAtmoK>0.0){ float rim=pow(1.0-mu,2.4); float lit=smoothstep(-0.2,0.45,ng); col+=uAtmo*rim*lit*uAtmoK; }
    if(uHeat>0.0){ float c=fbm(normalize(vPO)*6.0+uTime*0.02); float cr=1.0-abs(snoise(normalize(vPO)*9.0+uTime*0.02)*0.65+snoise(normalize(vPO)*24.0)*0.35);
      vec3 lava=vec3(1.0,0.3,0.04)*(0.04+1.8*smoothstep(0.9,0.985,cr))+vec3(1.0,0.75,0.35)*pow(smoothstep(0.94,1.0,cr),3.0)*1.5;
      col=mix(col,vec3(0.08,0.06,0.05)*diff*(0.6+c)+lava,uHeat); }
    gl_FragColor=vec4(col,1.0); }`});
}
export function ringMat(){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:SURF_VS,
    uniforms:{uTex:{value:tex('saturn_ring.png')},uSun:{value:new V3()},uCenter:{value:new V3()},uR:{value:1},uN:{value:new V3(0,1,0)},uOp:{value:1}},
    fragmentShader:`uniform sampler2D uTex; uniform vec3 uSun,uCenter,uN; uniform float uR,uOp; varying vec2 vUv; varying vec3 vPW;
    void main(){ vec4 t=texture2D(uTex,vec2(vUv.x,0.5)); if(t.a<0.01) discard; vec3 d=normalize(uSun-vPW); vec3 oc=vPW-uCenter; float b=dot(oc,d);
      float dist=length(oc-d*b); float sh=b<0.0?smoothstep(uR*0.98,uR*1.03,dist):1.0; float side=sign(dot(cameraPosition-vPW,uN))*sign(dot(uSun-vPW,uN));
      float face=side>0.0?1.0:0.3+0.5*(1.0-t.a); gl_FragColor=vec4(t.rgb*sh*face*1.05+t.rgb*0.01,t.a*0.95*uOp); }`});
}
export function makeRingGeo(RI,RO){ const g=new THREE.RingGeometry(RI,RO,256,1); const uv=g.attributes.uv,p=g.attributes.position; for(let i=0;i<uv.count;i++){ const r=Math.hypot(p.getX(i),p.getY(i)); uv.setXY(i,(r-RI)/(RO-RI),0.5); } return g; }
export function makePlanet(id){
  const T={mercury:['mercury.jpg'],venus:['venus_atmo.jpg','#f4cf92',0.5],mars:['mars.jpg','#e0a47c',0.3],jupiter:['jupiter.jpg',0,0,1],saturn:['saturn.jpg',0,0,1],uranus:['uranus.jpg','#a8e6ee',0.35,1],neptune:['neptune.jpg','#6f8cff',0.4,1]}[id];
  const mat=planetMat({map:tex(T[0]),atmo:T[1]||'#000',atmoK:T[2]||0,gas:T[3]||0});
  const g=new THREE.Group(); const m=new THREE.Mesh(new THREE.SphereGeometry(1,72,48),mat); g.add(m); g.userData={mat,mesh:m};
  if(id==='saturn'){ const rm=ringMat(); const ring=new THREE.Mesh(makeRingGeo(1.11,2.33),rm); ring.rotation.x=Math.PI/2; g.add(ring); g.userData.ring=ring;
    mat.uniforms.uRingTex.value=rm.uniforms.uTex.value; mat.uniforms.uRing.value.set(1,1.11,2.33,0); }
  return g;
}
// keeps sun position + ring shadow uniforms current for a planet group
export function litPlanet(g,sunW){ const u=g.userData.mat.uniforms; u.uSun.value.copy(sunW); g.getWorldPosition(u.uCenter.value);
  if(g.userData.ring){ const s=g.getWorldScale(new V3()).x, q=g.userData.ring.getWorldQuaternion(new THREE.Quaternion()); const n=new V3(0,0,1).applyQuaternion(q);
    u.uRingN.value.copy(n); u.uRing.value.y=1.11*s; u.uRing.value.z=2.33*s; const r=g.userData.ring.material.uniforms; r.uSun.value.copy(sunW); r.uCenter.value.copy(u.uCenter.value); r.uR.value=s; r.uN.value.copy(n); } }
export function makeMoon(){ const mat=planetMat({map:tex('moon_color_4k.jpg'),normal:tex('moon_normal_4k.jpg',false),normK:1.1}); mat.uniforms.uDetail.value=1; const m=new THREE.Mesh(new THREE.SphereGeometry(1,192,144),mat); m.userData={mat}; return m; }

// ---------------------------------------------------------------- Earth rig (all eras in one shader)
const EARTH_FS=NOISE+PERTURB+`
uniform sampler2D uDay,uNight,uSpec,uNorm,uClouds; uniform vec3 uSun,uImpP,uAtmo; uniform float uMolten,uYoung,uOxy,uIce,uGreen,uLights,uFires,uDust,uImpT,uCloudRot,uTime,uAtmoK;
varying vec2 vUv; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO;
float cradle(vec3 p){ float d=9.0;
  d=min(d,distance(p,vec3(0.603,0.545,-0.583))); d=min(d,distance(p,vec3(0.763,0.454,-0.459)));
  d=min(d,distance(p,vec3(0.334,0.454,-0.826))); d=min(d,distance(p,vec3(-0.334,0.574,-0.748)));
  d=min(d,distance(p,vec3(-0.147,0.326,0.934))); d=min(d,distance(p,vec3(0.301,-0.225,0.926)));
  d=min(d,distance(p,vec3(0.726,0.656,-0.195))); return d; }
void main(){
  vec3 Ng=normalize(vNW); vec3 L=normalize(uSun-vPW), V=normalize(cameraPosition-vPW); vec3 p=normalize(vPO);
  vec3 m=texture2D(uNorm,vUv).xyz*2.0-1.0; m.xy*=0.7*(1.0-uMolten); vec3 N=perturb(vPW,Ng,normalize(m),vUv);
  float ocean=texture2D(uSpec,vUv).r; vec3 day=texture2D(uDay,vUv).rgb;
  float n1=fbm(p*5.0), n2=fbm3(p*18.0);
  vec3 barren=mix(vec3(0.16,0.13,0.11),vec3(0.46,0.30,0.20),smoothstep(0.3,0.8,n1))*(0.8+0.3*n2);
  vec3 youngSea=mix(vec3(0.02,0.07,0.06),vec3(0.04,0.13,0.11),n1);
  vec3 land=mix(barren,day,uGreen), sea=mix(youngSea,day,uOxy); vec3 al=mix(land,sea,ocean);
  float lat=abs(p.y); float iceLine=1.02-uIce*1.08; float ice=smoothstep(iceLine-0.05,iceLine+0.03,lat+(n1-0.5)*0.16+ocean*0.03);
  al=mix(al,vec3(0.7,0.77,0.84)*(0.88+0.14*n2),ice);
  float ng=dot(Ng,L); float diff=clamp(dot(N,L),0.0,1.0)*smoothstep(-0.12,0.06,ng); float dim=1.0-uDust*0.88;
  vec3 col=al*diff*dim*1.08;
  vec3 H=normalize(L+V); col+=vec3(1.0,0.9,0.75)*(pow(max(dot(N,H),0.0),120.0)*0.5+pow(max(dot(N,H),0.0),16.0)*0.015)*ocean*(1.0-ice)*smoothstep(0.0,0.1,ng)*(1.0-uMolten)*dim;
  if(uMolten>0.001){ float c=fbm(p*4.0+vec3(0.0,uTime*0.02,0.0)); float cr=1.0-abs(snoise(p*8.0+vec3(uTime*0.02))*0.65+snoise(p*21.0-vec3(uTime*0.03))*0.35);
    float k=smoothstep(0.9,0.985,cr); vec3 lava=vec3(1.0,0.28,0.03)*(k*1.8+0.03+0.1*smoothstep(0.55,0.9,c))+vec3(1.0,0.72,0.3)*pow(k,4.0)*1.6;
    col=mix(col,vec3(0.09,0.07,0.06)*diff*(0.55+c)+lava,uMolten); }
  float night=smoothstep(0.1,-0.18,ng);
  if(uLights>0.001){ vec3 nl=pow(texture2D(uNight,vUv).rgb,vec3(1.3)); float e=clamp(cradle(p)*0.62+n1*0.12-0.02,0.0,1.0);
    float on=smoothstep(e-0.12,e,uLights*1.12-0.06); col+=nl*vec3(1.0,0.72,0.4)*2.6*on*night*(1.0-ice); }
  if(uFires>0.001){ vec2 g=vUv*vec2(420.0,210.0); vec2 id=floor(g), f=fract(g)-0.5; vec2 o=hash22(id)-0.5; float h=hash12(id+7.1);
    float af=distance(p,vec3(0.778,0.156,-0.608)); float e=af*0.55; float on=smoothstep(e-0.06,e,uFires)*step(0.94,h)*(1.0-ocean)*(1.0-ice);
    float d0=0.0; float d=length(f-o*0.6); float fl=0.7+0.3*sin(uTime*9.0+h*40.0); col+=vec3(1.0,0.55,0.18)*exp(-d*d*14.0)*on*night*1.6*fl; }
  if(uImpT>0.0){ float a=acos(clamp(dot(p,uImpP),-1.0,1.0)); float R=min(uImpT*0.55,2.6);
    col+=vec3(1.0,0.9,0.7)*exp(-a*a*900.0)*exp(-uImpT*1.4)*40.0;
    col+=vec3(1.0,0.45,0.1)*exp(-pow((a-R)/0.035,2.0))*exp(-uImpT*0.35)*1.8*step(uImpT,8.0);
    float burn=smoothstep(R,R*0.4,a)*exp(-uImpT*0.22)*(0.6+0.8*n2); col+=vec3(1.0,0.32,0.06)*burn*0.8*(0.3+0.7*night); }
  vec3 atm=mix(vec3(1.0,0.6,0.28),uAtmo,uOxy); atm=mix(atm,vec3(0.45,0.36,0.3),uDust);
  float mu=clamp(dot(Ng,V),0.0,1.0); float rim=pow(1.0-mu,2.3); float lit=smoothstep(-0.25,0.5,ng);
  col+=atm*rim*lit*uAtmoK*0.85; col=mix(col,atm*lit*0.8,pow(1.0-mu,6.0)*0.5*uAtmoK);
  col=mix(col,col*vec3(1.0,0.75,0.55)+vec3(0.05,0.03,0.02)*lit,uYoung*(1.0-uOxy)*0.35);
  gl_FragColor=vec4(col,1.0);
}`;
export function makeEarth(){
  const g=new THREE.Group(); const tilt=new THREE.Group(); tilt.rotation.z=23.4*Math.PI/180; g.add(tilt);
  const U={uDay:{value:tex('earth_day.jpg')},uNight:{value:tex('earth_night.jpg')},uSpec:{value:tex('earth_spec.jpg',false)},uNorm:{value:tex('earth_normal.jpg',false)},uClouds:{value:tex('earth_clouds.jpg',false)},
    uSun:{value:new V3(100,0,0)},uImpP:{value:latLon(21.3,-89.5)},uAtmo:{value:new THREE.Color('#4f93ff')},uMolten:{value:0},uYoung:{value:0},uOxy:{value:1},uIce:{value:0},uGreen:{value:1},
    uLights:{value:0},uFires:{value:0},uDust:{value:0},uImpT:{value:-1},uCloudRot:{value:0},uTime:GU.uTime,uAtmoK:{value:1}};
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,160,120),new THREE.ShaderMaterial({uniforms:U,vertexShader:SURF_VS,fragmentShader:EARTH_FS})); tilt.add(mesh);
  const CU={uTex:U.uClouds,uSun:U.uSun,uK:{value:0.9},uTint:{value:new THREE.Color(1,1,1)},uDust:U.uDust,uIce:U.uIce};
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.008,128,96),new THREE.ShaderMaterial({uniforms:CU,vertexShader:SURF_VS,transparent:true,depthWrite:false,
    fragmentShader:`uniform sampler2D uTex; uniform vec3 uSun,uTint; uniform float uK,uDust; varying vec2 vUv; varying vec3 vNW; varying vec3 vPW;
    void main(){ vec3 N=normalize(vNW),L=normalize(uSun-vPW); float ng=dot(N,L); float c=texture2D(uTex,vUv).r; float mu=clamp(dot(N,normalize(cameraPosition-vPW)),0.0,1.0);
      float lit=smoothstep(-0.12,0.3,ng); vec3 col=uTint*lit*mix(vec3(1.0),vec3(1.25,0.72,0.45),smoothstep(-0.05,0.12,ng)*(1.0-smoothstep(0.12,0.4,ng)));
      col=mix(col,vec3(0.35,0.3,0.27)*lit,uDust); gl_FragColor=vec4(col*(1.0-uDust*0.5),clamp(c*uK*(0.35+0.65*smoothstep(0.0,0.3,mu))+uDust*0.55*lit,0.0,1.0)); }`}));
  mesh.add(clouds);
  const AU={uSun:U.uSun,uC:{value:new THREE.Color('#5aa0ff')},uK:{value:1}};
  const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.035,96,64),new THREE.ShaderMaterial({uniforms:AU,vertexShader:SURF_VS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,
    fragmentShader:`uniform vec3 uSun,uC; uniform float uK; varying vec3 vNW; varying vec3 vPW; void main(){ vec3 N=normalize(vNW); vec3 V=normalize(cameraPosition-vPW);
      float f=pow(clamp(1.0-abs(dot(N,V)),0.0,1.0),3.0); float lit=smoothstep(-0.35,0.35,dot(N,normalize(uSun-vPW))); gl_FragColor=vec4(uC*f*lit*uK*1.6,1.0); }`}));
  tilt.add(atmo);
  const api={group:g,tilt,mesh,clouds,U,CU,AU,
    set(o){ for(const k in o){ if(k==='cloudK') CU.uK.value=o[k]; else if(k==='atmoK'){ U.uAtmoK.value=o[k]; AU.uK.value=o[k]; } else if(k==='atmoC'){ AU.uC.value.set(o[k]); } else if(U['u'+k[0].toUpperCase()+k.slice(1)]) U['u'+k[0].toUpperCase()+k.slice(1)].value=o[k]; } },
    era(o){ const d={molten:0,young:0,oxy:1,ice:0,green:1,lights:0,fires:0,dust:0,impT:-1,cloudK:0.9,atmoK:1,atmoC:'#5aa0ff'}; this.set({...d,...o}); },
    spin(a){ mesh.rotation.y=a; clouds.rotation.y=a*0.08; }, sunAt(v){ U.uSun.value.copy(v); }};
  return api;
}

// ---------------------------------------------------------------- rocky impactor (displaced icosahedron)
export function makeRock(seed=3,rough=0.35,color='#6b625a'){
  const geo=new THREE.IcosahedronGeometry(1,5); const p=geo.attributes.position, r=rng(seed), v=new V3();
  const bumps=Array.from({length:14},()=>[new V3(gauss(r),gauss(r),gauss(r)).normalize(),0.1+r()*0.35,(r()-0.6)*rough]);
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).normalize(); let k=1+Math.sin(v.x*5.1+seed)*0.05+Math.sin(v.y*7.3)*0.04+Math.sin(v.z*9.7+1.3)*0.03;
    for(const [c,w,a] of bumps){ const d=v.distanceTo(c); if(d<w) k+=a*(1-d/w)*(1-d/w); } v.multiplyScalar(k); p.setXYZ(i,v.x,v.y,v.z); }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:0.95,metalness:0,flatShading:false}));
}

// ---------------------------------------------------------------- camera paths (Catmull-Rom through keys)
export function camPath(keys){
  const K=keys.map(k=>({t:k[0],p:new V3(...k[1]),l:new V3(...k[2]),f:k[3]??45}));
  const cr=(a,b,c,d,u,out)=>{ const u2=u*u,u3=u2*u; return out.set(
    0.5*((2*b.x)+(-a.x+c.x)*u+(2*a.x-5*b.x+4*c.x-d.x)*u2+(-a.x+3*b.x-3*c.x+d.x)*u3),
    0.5*((2*b.y)+(-a.y+c.y)*u+(2*a.y-5*b.y+4*c.y-d.y)*u2+(-a.y+3*b.y-3*c.y+d.y)*u3),
    0.5*((2*b.z)+(-a.z+c.z)*u+(2*a.z-5*b.z+4*c.z-d.z)*u2+(-a.z+3*b.z-3*c.z+d.z)*u3)); };
  return lt=>{
    const n=K.length; if(lt<=K[0].t||n===1) return {p:K[0].p.clone(),l:K[0].l.clone(),f:K[0].f};
    if(lt>=K[n-1].t) return {p:K[n-1].p.clone(),l:K[n-1].l.clone(),f:K[n-1].f};
    let i=0; while(i<n-2&&lt>K[i+1].t) i++;
    let u=(lt-K[i].t)/(K[i+1].t-K[i].t);
    if(n===2) u=smooth(u); else if(i===0) u=u*u*(2-u); else if(i===n-2) u=1-(1-u)*(1-u)*(1+u);
    const a=K[Math.max(i-1,0)],b=K[i],c=K[i+1],d=K[Math.min(i+2,n-1)];
    return {p:cr(a.p,b.p,c.p,d.p,u,new V3()),l:cr(a.l,b.l,c.l,d.l,u,new V3()),f:lerp(b.f,c.f,smooth(u))};
  };
}
