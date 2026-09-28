// Cosmic Calendar v19 — Earth & human-era scenes (Moon is born → Pale Blue Dot)
import { THREE, GU, NOISE, SURF_VS, points, sprite, SPR, tex, makeEarth, makeMoon, makeRock, camPath, clamp, lerp, smooth, ease, easeOut, easeIn, ramp, env, rng, gauss, latLon } from './cc19-core.js';
const V3=THREE.Vector3;
const faceSpin=(lat,lon)=>{ const q=latLon(lat,lon); return Math.atan2(-q.x,q.z); };

export function makeEarthScenes(stage){
  const S={_all:[]}; const add=g=>{ stage.scene.add(g); S._all.push(g); return g; };
  const E=makeEarth(); add(E.group);
  const MOON=makeMoon(); add(MOON);
  const light=stage.sun;
  function sunDir(x,y,z){ const d=new V3(x,y,z).normalize(); E.sunAt(d.clone().multiplyScalar(2000)); light.position.copy(d); MOON.userData.mat.uniforms.uSun.value.copy(d.clone().multiplyScalar(2000)); return d; }
  function earthOn(x=0,y=0,z=0,s=1){ E.group.visible=true; E.group.position.set(x,y,z); E.group.scale.setScalar(s); }
  function moonOn(p,s,heat=0){ MOON.visible=true; MOON.position.copy(p); MOON.scale.setScalar(s); MOON.userData.mat.uniforms.uHeat.value=heat; MOON.rotation.set(0,0.6,0); }

  // ============================================================ THEIA → THE MOON IS BORN
  { const g=add(new THREE.Group()); const theia=makeRock(8,0.25,'#7a5a48'); theia.scale.setScalar(0.52); g.add(theia);
    const tGlow=sprite(SPR.glow,0xff7a30,0); g.add(tGlow);
    const IMP=new V3(-0.62,0.25,0.74).normalize(), TH0=new V3(-8.5,1.4,-2.5);
    const N=30000, r=rng(71), A=new Float32Array(N*4), B=new Float32Array(N*3);
    for(let i=0;i<N;i++){ A.set([r()*6.2832,2.0+Math.pow(r(),0.7)*2.6,gauss(r)*0.08,r()],i*4); const o=new V3(gauss(r),gauss(r),gauss(r)).normalize().multiplyScalar(0.6).add(IMP).normalize(); B.set([o.x,o.y,o.z],i*3); }
    const deb=points(N,{aA:A,aO:B},`attribute vec4 aA; attribute vec3 aO; uniform float uX,uK; uniform vec3 uImp,uMoon; varying vec3 vC; varying float vA;
      void main(){ float a=aA.x+uX*1.25/pow(aA.y,1.5)*1.6; vec3 ring=vec3(cos(a)*aA.y,aA.z+sin(a)*aA.y*0.16,sin(a)*aA.y);
        vec3 burst=uImp*1.02+aO*aA.y*easeOutf(uX);
        vec3 p=mix(burst,ring,smoothstep(0.5,2.4,uX)); float k=smoothstep(3.8,9.5,uX+aA.w*1.5); p=mix(p,uMoon+(p-uMoon)*0.06,k);
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*0.018/-mv.z,1.0,12.0*uPx);
        float heat=exp(-uX*0.35); vC=mix(vec3(0.75,0.22,0.08),vec3(1.0,0.8,0.5),heat)*(0.6+0.8*aA.w); vA=uK*(0.4+0.6*aA.w)*(1.0-k*0.9); }`.replace('void main','float easeOutf(float x){ x=clamp(x/1.4,0.0,1.0); return 1.0-pow(1.0-x,3.0); }\nvoid main'),{uX:{value:0},uK:{value:0},uImp:{value:IMP},uMoon:{value:new V3()}});
    g.add(deb);
    const X=4.3;
    const moonAt=x=>{ const a=0.4+x*1.25/Math.pow(3.6,1.5)*1.6; return new V3(Math.cos(a)*3.6,Math.sin(a)*3.6*0.16,Math.sin(a)*3.6); };
    S.theia={group:g, bright:true, cam:camPath([[0,[1.2,1.3,6.4],[-0.8,0.2,0],44],[X,[0.6,0.9,4.4],[-0.4,0.2,0],46],[X+2.2,[1.5,3.2,8.5],[0,0,0],48],[11,[3.5,2.4,9.8],[1.2,0.3,1.2],46]]),
      update(lt,dt,c){ g.visible=true; earthOn(); sunDir(1,0.25,0.55);
        const x=Math.max(0,lt-X); E.era({molten:1,young:1,oxy:0,green:0,cloudK:0,atmoK:0.25,atmoC:'#ff8a4a'}); E.spin(lt*0.1);
        const pre=lt<X; theia.visible=pre; const tt=easeIn(ramp(lt,0,X)); theia.position.lerpVectors(TH0,IMP.clone().multiplyScalar(1.4),tt); theia.rotation.set(lt*0.3,lt*0.5,0);
        tGlow.position.copy(theia.position); tGlow.scale.setScalar(1.2+tt*1.5); tGlow.material.opacity=pre?0.25+tt*0.5:0;
        deb.material.uniforms.uX.value=x; deb.material.uniforms.uK.value=pre?0:smooth(x/0.15); const mp=moonAt(x); deb.material.uniforms.uMoon.value.copy(mp);
        if(x>5){ moonOn(mp,0.27*ease(ramp(x,5,7)),1-0.5*ramp(x,5,7)); }
        c.flash=pre?0:1.4*Math.exp(-x*5); c.streak=pre?0.2*tt*tt:0.3*Math.exp(-x*2); c.shake=pre?0:0.05*Math.exp(-x*2); c.sky.set(0.3,0.5); c.bars=1; }};
  }

  // ============================================================ GREAT BOMBARDMENT
  { const g=add(new THREE.Group()); const N=90, r=rng(81), D=new Float32Array(N*3), F=new Float32Array(N*3), T=new Float32Array(N);
    for(let i=0;i<N;i++){ const d=new V3(gauss(r),gauss(r)*0.6,gauss(r)+1.2).normalize(); D.set([d.x,d.y,d.z],i*3); const f=new V3(gauss(r),gauss(r),gauss(r)).normalize().add(d).normalize(); F.set([f.x,f.y,f.z],i*3); T[i]=r()*7.2; }
    const met=points(N,{aD:D,aF:F,aT:T},`attribute vec3 aD,aF; attribute float aT; uniform float uT; varying vec3 vC; varying float vA;
      void main(){ float s=(uT-aT)/0.9; vec3 p; float sz; if(s<1.0){ p=aD*1.0+aF*(1.0-s)*5.0; sz=0.05; vC=vec3(1.0,0.8,0.55); vA=step(0.0,s)*smoothstep(0.0,0.3,s); }
        else { float x=s-1.0; p=aD*1.01; sz=0.12+x*0.25; vC=vec3(1.0,0.75,0.4)*2.0*exp(-x*2.8); vA=exp(-x*2.2); }
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*sz/-mv.z,1.0,90.0*uPx); }`,{uT:{value:0}});
    g.add(met);
    S.bombardment={group:g, cam:camPath([[0,[3.6,1.0,4.6],[0,0,0],44],[8,[-0.4,1.5,3.9],[0,0,0],44]]),
      update(lt,dt,c){ g.visible=true; earthOn(); sunDir(1,0.3,0.6); E.era({molten:0.75-0.35*ramp(lt,0,8),young:1,oxy:0,green:0,cloudK:0.12,atmoK:0.4,atmoC:'#ff9a5a'}); E.spin(1+lt*0.08);
        met.material.uniforms.uT.value=lt; moonOn(new V3(-4.5,1.2,-6),0.27,0.25); c.sky.set(0.3,0.5); c.bars=1; }};
  }

  // ============================================================ FIRST LIFE (Earth cools → dive into the primordial ocean)
  { const cells=add(new THREE.Group());
    const bgM=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:SURF_VS,uniforms:{uTime:GU.uTime},fragmentShader:NOISE+`uniform float uTime; varying vec3 vPO;
      void main(){ vec3 d=normalize(vPO); float up=d.y*0.5+0.5; vec3 c=mix(vec3(0.0,0.02,0.04),vec3(0.02,0.18,0.24),pow(up,2.2)); c+=vec3(0.05,0.2,0.22)*pow(up,12.0)*(0.6+0.4*fbm3(vec3(d.xz*6.0,uTime*0.2))); gl_FragColor=vec4(c,1.0); }`});
    cells.add(new THREE.Mesh(new THREE.SphereGeometry(60,48,32),bgM));
    const rayTex=(()=>{ const cv=document.createElement('canvas'); cv.width=64; cv.height=256; const x=cv.getContext('2d'); const gr=x.createLinearGradient(0,0,0,256); gr.addColorStop(0,'rgba(160,255,240,0.55)'); gr.addColorStop(1,'rgba(160,255,240,0)'); x.fillStyle=gr; x.fillRect(0,0,64,256);
      const h=x.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,1)'); h.addColorStop(0.5,'rgba(0,0,0,0)'); h.addColorStop(1,'rgba(0,0,0,1)'); x.globalCompositeOperation='destination-out'; x.fillStyle=h; x.fillRect(0,0,64,256); return new THREE.CanvasTexture(cv); })();
    const rays=[]; for(let i=0;i<7;i++){ const m=new THREE.Mesh(new THREE.PlaneGeometry(1.6+i*0.3,26),new THREE.MeshBasicMaterial({map:rayTex,transparent:true,opacity:0.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
      m.position.set((i-3)*2.2,6,-6-i*1.5); m.rotation.z=(i-3)*0.08; cells.add(m); rays.push(m); }
    const cm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:GU.uTime},
      vertexShader:`attribute float aH; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO; varying float vH; void main(){ vH=aH; vPO=position; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.0); vPW=w.xyz; vNW=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader:NOISE+`uniform float uTime; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO; varying float vH;
      void main(){ vec3 N=normalize(vNW),V=normalize(cameraPosition-vPW); float mu=min(abs(dot(N,V)),1.0); float rim=pow(1.0-mu,2.5);
        float n=fbm3(vPO*3.0+vec3(uTime*0.2+vH*10.0)); vec3 base=mix(vec3(0.25,0.95,0.75),vec3(0.55,0.85,1.0),vH);
        float nuc=smoothstep(0.55,0.2,length(vPO-vec3(0.15,0.1,0.0)*sin(vH*6.0)))*mu;
        vec3 c=base*(rim*1.4+0.12+n*0.25)+vec3(0.9,1.0,0.6)*nuc*0.35; gl_FragColor=vec4(c,clamp(rim*0.85+0.18+nuc*0.3,0.0,1.0)); }`});
    const CN=64, cellMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,40,28),cm,CN); const H=new Float32Array(CN), r=rng(91), base=[];
    for(let i=0;i<CN;i++){ H[i]=r(); base.push([new V3((r()-0.5)*14,(r()-0.5)*8,-r()*16+2),0.18+Math.pow(r(),2)*0.5,r()*6.28,i<8]); }
    cellMesh.geometry.setAttribute('aH',new THREE.InstancedBufferAttribute(H,1)); cellMesh.frustumCulled=false; cells.add(cellMesh);
    const SN=7000, sp=new Float32Array(SN*3); for(let i=0;i<SN;i++) sp.set([(r()-0.5)*30,(r()-0.5)*18,-r()*30+6],i*3);
    const snow=points(SN,{position:sp},`varying vec3 vC; varying float vA; void main(){ vec3 p=position; p.y=mod(p.y-uTime*0.12+9.0,18.0)-9.0; p.x+=sin(uTime*0.3+p.z)*0.2;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*0.012/-mv.z,1.0,6.0*uPx); vC=vec3(0.6,0.95,0.9); vA=0.35; }`);
    cells.add(snow);
    const M4=new THREE.Matrix4(), Q=new THREE.Quaternion(), SC=new V3();
    const earthCam=camPath([[0,[0.6,1.2,3.8],[0,0,0],44],[3.2,[0.2,0.5,2.2],[0,0.1,0],44],[4.6,[0.08,0.25,1.2],[0,0.15,0.6],50]]);
    const cellCam=camPath([[4.6,[0,0.4,6],[0,0,-6],55],[11,[0.8,-0.2,1.2],[0,0,-8],55]]);
    S.firstlife={group:null, cuts:[4.7], cam:lt=>lt<4.7?earthCam(lt):cellCam(lt),
      update(lt,dt,c){ const inside=lt>=4.7; c.sky.set(inside?0:0.3,inside?0:0.5);
        if(!inside){ earthOn(); sunDir(1,0.35,0.7); E.era({molten:0.12*(1-ramp(lt,0,3)),young:1,oxy:0,green:0,cloudK:1.1,atmoK:0.7,atmoC:'#ff9d5c'}); E.spin(2+lt*0.05); }
        else { cells.visible=true;
          for(let i=0;i<CN;i++){ const [p,s,ph,div]=base[i]; let pos=p.clone(); pos.y+=Math.sin(lt*0.4+ph)*0.3; pos.x+=Math.cos(lt*0.3+ph)*0.2;
            let sy=s*(1+0.04*Math.sin(lt*2+ph)); if(div){ const k=smooth(ramp(lt,6+i*0.4,8.5+i*0.4)); pos.x+=(i%2?1:-1)*k*s*1.05; sy=s*(1-0.25*Math.sin(k*3.14)); }
            Q.setFromEuler(new THREE.Euler(ph,lt*0.2+ph,0)); SC.set(s,sy,s); M4.compose(pos,Q,SC); cellMesh.setMatrixAt(i,M4); }
          cellMesh.instanceMatrix.needsUpdate=true; rays.forEach((m,i)=>{ m.rotation.z=(i-3)*0.08+Math.sin(lt*0.3+i)*0.03; m.material.opacity=0.12+0.06*Math.sin(lt*0.7+i*1.3); }); }
        c.bars=1; }};
  }

  // ============================================================ GREAT OXIDATION
  S.oxygen={group:null, cam:camPath([[0,[-2.8,0.9,2.2],[0,0,0],44],[9,[-1.2,0.5,3.4],[0,0,0],44]]),
    update(lt,dt,c){ earthOn(); sunDir(0.3,0.25,1); const k=ease(ramp(lt,0.8,8)); E.era({young:1-0.7*k,oxy:k,green:0.08*k,cloudK:0.85,atmoK:0.7+0.3*k,atmoC:k>0.5?'#5aa0ff':'#ffae70'});
      E.AU.uC.value.set('#ffae70').lerp(new THREE.Color('#5aa0ff'),k); E.spin(3.4+lt*0.04); c.sky.set(0.35,0.55); c.bars=1; }};

  // ============================================================ SNOWBALL EARTH
  S.snowball={group:null, cam:camPath([[0,[0.4,2.6,2.3],[0,0,0],44],[8,[2.2,1.6,2.6],[0,0,0],44]]),
    update(lt,dt,c){ earthOn(); sunDir(1,0.4,0.8); const ice=ease(ramp(lt,0,3.2))*(1-ease(ramp(lt,5.4,8))); E.era({young:0.3,oxy:1,green:0.25,ice,cloudK:0.55,atmoK:0.85}); E.spin(0.6+lt*0.05); c.sky.set(0.35,0.55); c.bars=1; }};

  // ============================================================ LIFE EXPLODES (Cambrian → land plants)
  S.cambrian={group:null, cam:camPath([[0,[3.2,0.6,1.2],[0,0,0],44],[9,[1.6,0.9,2.8],[0,0,0],40]]),
    update(lt,dt,c){ earthOn(); sunDir(1,0.3,0.4); const k=ease(ramp(lt,0.5,8)); E.era({young:0.3*(1-k),oxy:1,green:0.25+0.75*k,cloudK:0.8,atmoK:1}); E.spin(1.2+lt*0.06); c.sky.set(0.35,0.55); c.bars=1; }};

  // ============================================================ AGE OF DINOSAURS → the day the sky fell
  { const g=add(new THREE.Group()); const rock=makeRock(5,0.4,'#57504a'); rock.scale.setScalar(0.035); g.add(rock);
    const fire=sprite(SPR.glow,0xffa060,0); g.add(fire); const trail=sprite(SPR.soft,0xffb070,0); g.add(trail);
    const X=5.2, SPIN=faceSpin(21.3,-89.5)+0.45; const TGT=new V3();
    S.dinosaurs={group:g, cam:camPath([[0,[0.9,0.9,3.5],[0,0.1,0],44],[X-0.3,[0.5,0.55,2.4],[0,0.3,0],42],[X+1.5,[0.8,0.9,3.2],[0,0.2,0],44],[11,[1.4,1.0,3.9],[0,0,0],44]]),
      update(lt,dt,c){ g.visible=true; earthOn(); sunDir(0.9,0.35,0.9); E.spin(SPIN);
        E.mesh.updateMatrixWorld(true); TGT.copy(latLon(21.3,-89.5)).multiplyScalar(1.0).applyMatrix4(E.mesh.matrixWorld);
        const x=lt-X; const dust=ease(ramp(lt,X+1.5,X+5)); E.era({green:1,oxy:1,impT:x>0?x:-1,dust,cloudK:0.8+dust*0.3,atmoK:1});
        const pre=x<0; const from=TGT.clone().add(new V3(-2.2,2.8,1.4)); const tt=easeIn(ramp(lt,0.8,X)); rock.visible=pre&&lt>0.8; rock.position.lerpVectors(from,TGT,tt); rock.rotation.set(lt,lt*1.3,0);
        const hot=pre?smooth(ramp(tt,0.72,1)):0; fire.position.copy(rock.position); fire.scale.setScalar(0.05+hot*0.35); fire.material.opacity=pre&&lt>0.8?0.2+hot*0.9:0;
        trail.position.copy(rock.position).add(from.clone().sub(TGT).normalize().multiplyScalar(0.25*hot)); trail.scale.set(0.06,0.55*hot,1); trail.material.opacity=hot*0.8; trail.material.rotation=Math.atan2(-(from.x-TGT.x),(from.y-TGT.y));
        c.flash=pre?0:1.5*Math.exp(-x*4.5); c.shake=pre?0:0.06*Math.exp(-x*1.6); c.sky.set(0.35,0.55); c.bars=1; }};
  }

  // ============================================================ HUMANS (campfires spread out of Africa)
  const AF=faceSpin(5,25), AS=faceSpin(25,85), AM=faceSpin(15,-75);
  S.humans={group:null, cam:camPath([[0,[0.2,0.5,3.1],[0,0.1,0],40],[9,[-0.3,0.7,2.8],[0,0.15,0],40]]),
    update(lt,dt,c){ earthOn(); sunDir(-0.55,0.15,-1); const k=ramp(lt,0.3,9); E.era({green:1,oxy:1,fires:ease(k),cloudK:0.55,atmoK:0.9}); E.spin(lerp(AF,AS,ease(ramp(lt,2,9)))); c.sky.set(0.4,0.6); c.bars=1; }};
  S.civilization={group:null, cam:camPath([[0,[-0.3,0.7,2.8],[0,0.15,0],40],[10,[0.6,0.4,2.4],[0,0.1,0],38]]),
    update(lt,dt,c){ earthOn(); sunDir(-0.55,0.15,-1); const k=ramp(lt,0,9.6); E.era({green:1,oxy:1,fires:1-0.6*k,lights:ease(k),cloudK:0.5,atmoK:0.9}); E.spin(lerp(AS,AS-3.4,ease(k))); c.sky.set(0.4,0.6); c.bars=1; }};

  // ============================================================ SPACE AGE (satellites wrap the world)
  { const g=add(new THREE.Group()); const N=2600, r=rng(101), A=new Float32Array(N*4), B=new Float32Array(N);
    for(let i=0;i<N;i++){ const geo=r()<0.12; A.set([geo?1.9+r()*0.08:1.06+Math.pow(r(),2)*0.3,geo?gauss(r)*0.02:r()*1.7,r()*6.2832,r()*6.2832],i*4); B[i]=i===0?0:Math.pow(r(),0.6); }
    const sats=points(N,{aA:A,aB:B},`attribute vec4 aA; attribute float aB; uniform float uN,uT; varying vec3 vC; varying float vA;
      void main(){ float R=aA.x; float w=0.9/pow(R,1.5); float a=aA.w+uT*w; vec3 p=vec3(cos(a)*R,0.0,sin(a)*R); float ci=cos(aA.y),si=sin(aA.y); p=vec3(p.x,p.z*si,p.z*ci);
        float cn=cos(aA.z),sn=sin(aA.z); p=vec3(p.x*cn+p.z*sn,p.y,-p.x*sn+p.z*cn); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
        float on=smoothstep(aB,aB+0.02,uN); gl_PointSize=(aB==0.0?4.0:1.7)*uPx; vC=aB==0.0?vec3(1.0,0.9,0.6):vec3(0.75,0.88,1.0); vA=on*(aB==0.0?1.0:0.85); }`,{uN:{value:0},uT:{value:0}});
    g.add(sats);
    S.spaceage={group:g, cam:camPath([[0,[2.6,1.3,2.2],[0,0,0],42],[8,[-0.4,2.1,3.3],[0,0,0],44]]),
      update(lt,dt,c){ g.visible=true; earthOn(); sunDir(1,0.4,0.5); E.era({green:1,oxy:1,lights:1,cloudK:0.8,atmoK:1}); E.spin(0.8+lt*0.05);
        sats.material.uniforms.uN.value=0.02+ease(ramp(lt,1.2,7.5))*0.98; sats.material.uniforms.uT.value=lt; c.sky.set(0.4,0.6); c.bars=1; }};
  }

  // ============================================================ EARTHRISE (we reach the Moon)
  S.moon={group:null, still:true, cam:camPath([[0,[0,1.018,0.02],[0,0.16,-10],26],[9,[0.004,1.016,0.0],[0,0.2,-10],23]]),
    update(lt,dt,c){ const d=sunDir(1,0.42,-0.3); moonOn(new V3(0,0,0),1,0); MOON.rotation.set(Math.PI/2,0,0.35);
      const rise=easeOut(ramp(lt,0,8.5)); earthOn(0,lerp(-7.2,1.6,rise),-40,1.1); E.era({green:1,oxy:1,lights:1,cloudK:0.9,atmoK:1}); E.spin(-0.9+lt*0.02);
      c.sky.set(0.45,0.7); c.bars=1; }};

  // ============================================================ A PALE BLUE DOT
  { const g=add(new THREE.Group()); const dot=sprite(SPR.soft,0x9fc8ff,0); g.add(dot);
    S.paleblue={group:g, beams:true, cam:lt=>{ const d=2.6*Math.exp(Math.min(lt,11.8)*0.58); const a=0.5+lt*0.02; return {p:new V3(Math.sin(a)*d*0.35,d*0.12,Math.cos(a)*d),l:new V3(0,0,0),f:lerp(42,24,smooth(ramp(lt,6,16)))}; },
      update(lt,dt,c){ g.visible=true; earthOn(); sunDir(0.6,0.2,-1); E.era({green:1,oxy:1,lights:1,cloudK:0.85,atmoK:1}); E.spin(1.4+lt*0.03);
        moonOn(new V3(22,3,-48),0.27,0); const cd=c.cam.position.length(); dot.scale.setScalar(Math.max(0.02,cd*0.011)); dot.material.opacity=smooth(ramp(cd,120,420))*0.95;
        c.beams=smooth(ramp(lt,10,15)); c.sky.set(0.45,0.7); c.bars=1; }};
  }

  S.E=E; S.MOON=MOON;
  return S;
}
