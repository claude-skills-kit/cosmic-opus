// Cosmic Calendar v19 — cosmic-scale scenes (Big Bang → Solar System)
import { THREE, GU, NOISE, SURF_VS, points, sprite, SPR, tex, makeSun, makePlanet, litPlanet, camPath, clamp, lerp, smooth, ease, easeOut, ramp, env, rng, gauss } from './cc19-core.js';
const V3=THREE.Vector3;

export function makeCosmos(stage){
  const S={_all:[]}; const add=g=>{ stage.scene.add(g); S._all.push(g); return g; };

  // ============================================================ 1 · BIG BANG
  { const g=add(new THREE.Group()); const N=42000, r=rng(11), D=new Float32Array(N*3), SP=new Float32Array(N), SD=new Float32Array(N);
    for(let i=0;i<N;i++){ const v=new V3(gauss(r),gauss(r),gauss(r)).normalize(); D.set([v.x,v.y,v.z],i*3); SP[i]=0.25+Math.pow(r(),0.7)*1.1; SD[i]=r()*100; }
    const pts=points(N,{aDir:D,aSp:SP,aSeed:SD},`attribute vec3 aDir; attribute float aSp,aSeed; uniform float uT,uK; varying vec3 vC; varying float vA;
      void main(){ float e=1.0-exp(-uT*0.7*aSp); vec3 d=normalize(aDir+0.32*vec3(snoise(aDir*2.6+1.0),snoise(aDir*2.6+7.0),snoise(aDir*2.6+13.0)));
        vec3 pos=d*(0.04+e*10.0*aSp); vec4 mv=modelViewMatrix*vec4(pos,1.0); gl_Position=projectionMatrix*mv;
        float temp=exp(-uT*0.42); vec3 c=mix(mix(vec3(0.9,0.22,0.08),vec3(1.0,0.6,0.22),smoothstep(0.08,0.4,temp)),vec3(1.0,0.97,0.92),smoothstep(0.4,0.85,temp));
        vC=c*(0.55+0.9*fract(aSeed*13.1)); gl_PointSize=clamp(uPH*0.02*(0.4+aSp)/-mv.z,1.0,24.0*uPx); vA=uK*(0.3+0.7*fract(aSeed*7.3)); }`,{uT:{value:0},uK:{value:1}});
    g.add(pts);
    const pm=new THREE.ShaderMaterial({uniforms:{uT:{value:0},uK:{value:1},uTime:GU.uTime},vertexShader:SURF_VS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      fragmentShader:NOISE+`uniform float uT,uK,uTime; varying vec3 vNW; varying vec3 vPW; varying vec3 vPO;
      void main(){ vec3 N=normalize(vNW),V=normalize(cameraPosition-vPW); float mu=clamp(abs(dot(N,V)),0.0,1.0); vec3 p=normalize(vPO);
        float n=fbm(p*3.0+vec3(uT*0.25)); float n2=fbm3(p*9.0-vec3(uT*0.4)); float temp=exp(-uT*0.42);
        vec3 c=mix(mix(vec3(0.7,0.12,0.05),vec3(1.0,0.5,0.16),smoothstep(0.05,0.4,temp)),vec3(1.0,0.95,0.88),smoothstep(0.45,0.9,temp));
        float shock=pow(1.0-mu,3.2); float core=pow(mu,6.0)*0.25; float a=(shock*1.1+core)*(0.25+1.3*n*n2)*uK; vec3 hot=mix(c,vec3(0.75,0.85,1.0),temp*0.5); gl_FragColor=vec4(hot*a*0.8,1.0); }`});
    const plasma=new THREE.Mesh(new THREE.SphereGeometry(1,96,64),pm); g.add(plasma);
    const core=sprite(SPR.glow,0xfff4e6,1); g.add(core); const seed=sprite(SPR.star,0xffffff,0); g.add(seed);
    const fogM=new THREE.ShaderMaterial({uniforms:{uK:{value:0},uTime:GU.uTime},vertexShader:SURF_VS,side:THREE.BackSide,depthWrite:false,transparent:true,blending:THREE.AdditiveBlending,
      fragmentShader:NOISE+`uniform float uK,uTime; varying vec3 vPO; void main(){ vec3 d=normalize(vPO); float n=fbm3(d*2.4+vec3(0.0,uTime*0.05,0.0)); gl_FragColor=vec4(vec3(1.0,0.55,0.22)*1.25*(0.8+0.35*n)*uK,1.0); }`});
    const fog=new THREE.Mesh(new THREE.SphereGeometry(50,48,32),fogM); fog.renderOrder=-5; g.add(fog);
    const X=1.3;
    S.bigbang={group:g, cam:camPath([[0,[0,0.03,1.8],[0,0,0],58],[X,[0,0.03,2.0],[0,0,0],60],[X+2.5,[0.8,0.4,7.5],[0,0,0],54],[X+7,[2.4,1.3,14],[0,0,0],49],[X+9.2,[2.9,1.5,16.5],[0,0,0],47]]),
      update(lt,dt,c){ g.visible=true; const pre=lt<X, x=Math.max(0,lt-X); const u=pts.material.uniforms; u.uT.value=x; u.uK.value=pre?0:smooth(x/0.3)*(1-ramp(x,7.2,9.2)*0.5);
        pm.uniforms.uT.value=x; const R=0.1+4.2*easeOut(x/5)+1.6*Math.pow(Math.max(0,x-4.5),1.5); plasma.scale.setScalar(R); plasma.visible=!pre; pm.uniforms.uK.value=pre?0:smooth(x/0.25)*Math.max(Math.exp(-x*0.42),0.12);
        seed.material.opacity=pre?0.9*smooth(ramp(lt,0.15,X)):Math.exp(-x*7); seed.scale.setScalar(pre?0.05+0.12*smooth(ramp(lt,0.15,X)):0.17+x*2);
        core.scale.setScalar(pre?0.5+0.3*ramp(lt,0.5,X):0.8+x*5); core.material.opacity=pre?0.3*smooth(ramp(lt,0.5,X)):Math.exp(-x*0.9);
        const inside=smooth(ramp(R-c.cam.position.length(),-1.5,5)); fogM.uniforms.uK.value=inside*0.9; fog.visible=inside>0.002; fog.position.copy(c.cam.position);
        c.flash=pre?0:0.8*Math.exp(-x*4)*smooth(x/0.07); c.sky.set(0,0); c.streak=pre?0:0.25*Math.exp(-x*0.8); c.shake=pre?0:0.02*Math.exp(-x*2); c.bars=1; }};
  }

  // ============================================================ 2 · FIRST LIGHT (CMB)
  { const g=add(new THREE.Group());
    const m=new THREE.ShaderMaterial({uniforms:{uFog:{value:1},uK:{value:1},uTime:GU.uTime},vertexShader:SURF_VS,side:THREE.BackSide,depthWrite:false,
      fragmentShader:NOISE+`uniform float uFog,uK,uTime; varying vec3 vPO;
      vec3 planck(float x){ vec3 a=vec3(0.02,0.1,0.45), b=vec3(0.1,0.6,0.9), c=vec3(0.95,0.9,0.75), d=vec3(1.0,0.55,0.15), e=vec3(0.7,0.12,0.06);
        return x<0.25?mix(a,b,x*4.0):x<0.5?mix(b,c,(x-0.25)*4.0):x<0.75?mix(c,d,(x-0.5)*4.0):mix(d,e,(x-0.75)*4.0); }
      void main(){ vec3 p=normalize(vPO); float n=fbm(p*6.0)*0.6+fbm3(p*22.0)*0.3+snoise(p*60.0)*0.06+0.05;
        vec3 c=planck(clamp((n-0.28)*1.9,0.0,1.0))*0.55; vec3 fog=vec3(1.0,0.55,0.22)*1.25*0.9*(0.8+0.35*fbm3(p*2.4+vec3(0.0,uTime*0.05,0.0)));
        gl_FragColor=vec4(mix(c,fog,uFog)*uK,1.0); }`});
    const shell=new THREE.Mesh(new THREE.SphereGeometry(60,96,64),m); g.add(shell);
    S.cmb={group:g, cam:camPath([[0,[0,0,0.05],[0,0,-10],58],[8,[0,0,0],[-6,1.5,-10],62]]),
      update(lt,dt,c){ g.visible=true; m.uniforms.uFog.value=1-smooth(ramp(lt,0.8,3.6)); m.uniforms.uK.value=1-0.96*smooth(ramp(lt,4.8,7.8)); shell.rotation.y=lt*0.03; c.sky.set(0,0); c.bars=1; }};
  }

  // ============================================================ 3 · FIRST STARS (cosmic web)
  { const g=add(new THREE.Group()); const r=rng(21); const nodes=[]; for(let i=0;i<46;i++) nodes.push(new V3((r()-0.5)*70,(r()-0.5)*36,(r()-0.5)*80));
    const edges=[]; nodes.forEach((a,i)=>{ nodes.map((b,j)=>[j,a.distanceTo(b)]).filter(x=>x[0]!==i).sort((x,y)=>x[1]-y[1]).slice(0,3).forEach(([j])=>{ if(i<j) edges.push([a,nodes[j]]); }); });
    const N=70000, P=new Float32Array(N*3), C=new Float32Array(N); let k=0;
    for(let i=0;i<N;i++){ let p; if(r()<0.25){ const n=nodes[(r()*nodes.length)|0]; p=n.clone().add(new V3(gauss(r),gauss(r),gauss(r)).multiplyScalar(1.6)); }
      else { const [a,b]=edges[(r()*edges.length)|0]; p=a.clone().lerp(b,r()).add(new V3(gauss(r),gauss(r),gauss(r)).multiplyScalar(0.55+r()*0.5)); }
      P.set([p.x,p.y,p.z],i*3); C[i]=r(); }
    const web=points(N,{position:P,aR:C},`attribute float aR; uniform float uK; varying vec3 vC; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*0.09/-mv.z,1.0,14.0*uPx);
        vC=mix(vec3(0.35,0.3,0.85),vec3(0.75,0.45,0.9),aR)*0.5; vA=uK*0.35*(0.5+aR); }`,{uK:{value:0}});
    g.add(web);
    const M=380, SP=new Float32Array(M*3), TI=new Float32Array(M), MS=new Float32Array(M);
    for(let i=0;i<M;i++){ const [a,b]=edges[(r()*edges.length)|0]; const p=r()<0.5?nodes[(r()*nodes.length)|0].clone().add(new V3(gauss(r),gauss(r),gauss(r)).multiplyScalar(1.2)):a.clone().lerp(b,r());
      SP.set([p.x,p.y,p.z],i*3); TI[i]=0.6+r()*5.6; MS[i]=0.6+Math.pow(r(),3)*2.4; }
    const stars=points(M,{position:SP,aTi:TI,aM:MS},`attribute float aTi,aM; uniform float uT; varying vec3 vC; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; float x=uT-aTi; float on=step(0.0,x);
        float fl=on*(exp(-x*2.5)*3.0+0.7+0.15*sin(uTime*3.0+aTi*20.0)); gl_PointSize=clamp(uPH*0.5*aM*(0.6+0.4*fl)/-mv.z,1.5,70.0*uPx);
        vC=mix(vec3(0.65,0.78,1.0),vec3(1.0),0.3)*fl; vA=on*smoothstep(0.0,0.08,x); }`,{uT:{value:0}},{fs:`varying vec3 vC; varying float vA; uniform sampler2D uMap;
      void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; float core=exp(-r*r*40.0), halo=exp(-r*5.0)*0.35, sp=(exp(-abs(d.x)*90.0)+exp(-abs(d.y)*90.0))*exp(-r*2.5)*0.5;
        float a=(core+halo+sp)*vA; if(a<0.003) discard; gl_FragColor=vec4(vC,a); }`});
    g.add(stars);
    S.stars={group:g, cam:camPath([[0,[0,4,62],[0,0,0],52],[4,[6,3,26],[0,0,-10],52],[8,[12,5,4],[-4,0,-30],54]]),
      update(lt,dt,c){ g.visible=true; web.material.uniforms.uK.value=smooth(lt/1.5); stars.material.uniforms.uT.value=lt; c.sky.set(0,0); c.bars=1; }};
  }

  // ============================================================ 4 · STARS LIVE & DIE (supernova)
  { const g=add(new THREE.Group()); const SN=makeSun(1); const sm=SN.userData.mat; g.add(SN);
    const N=52000, r=rng(31), D=new Float32Array(N*3), SP=new Float32Array(N), SD=new Float32Array(N);
    for(let i=0;i<N;i++){ const v=new V3(gauss(r),gauss(r),gauss(r)).normalize(); D.set([v.x,v.y,v.z],i*3); SP[i]=0.55+r()*0.6; SD[i]=r(); }
    const ej=points(N,{aDir:D,aSp:SP,aSeed:SD},`attribute vec3 aDir; attribute float aSp,aSeed; uniform float uX,uK; varying vec3 vC; varying float vA;
      void main(){ float fil=fbm3(aDir*4.0+3.0); vec3 d=normalize(aDir+0.18*vec3(snoise(aDir*5.0),snoise(aDir*5.0+4.0),snoise(aDir*5.0+9.0)));
        float rad=uX*(0.7+1.1*aSp)*(0.7+0.6*fil); vec4 mv=modelViewMatrix*vec4(d*rad,1.0); gl_Position=projectionMatrix*mv;
        vec3 ha=vec3(1.0,0.28,0.35), o3=vec3(0.25,0.85,0.8), hot=vec3(0.8,0.9,1.0); vC=mix(mix(o3,ha,smoothstep(0.35,0.65,fil)),hot,exp(-uX*0.9)*0.8)*(0.6+0.8*aSeed);
        gl_PointSize=clamp(uPH*0.028/-mv.z,1.0,14.0*uPx); vA=uK*smoothstep(0.3,0.7,fil+aSeed*0.3)*(0.4+0.6*aSeed); }`,{uX:{value:0},uK:{value:0}});
    g.add(ej);
    const ring=sprite(SPR.glow,0xbfe6ff,0); g.add(ring);
    const beamG=new THREE.ConeGeometry(0.18,7,24,1,true); beamG.translate(0,-3.5,0);
    const bm=new THREE.MeshBasicMaterial({color:0x9fd4ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const pulsar=new THREE.Group(); const b1=new THREE.Mesh(beamG,bm), b2=new THREE.Mesh(beamG,bm); b2.rotation.x=Math.PI; pulsar.add(b1,b2); pulsar.add(sprite(SPR.star,0xdff0ff,1)); pulsar.children[2].scale.setScalar(1.2); g.add(pulsar);
    S.supernova={group:g, bright:true, cam:camPath([[0,[0,0.6,12],[0,0,0],46],[3.2,[0.4,0.2,6.5],[0,0,0],44],[4,[0.6,0.7,9.5],[0,0,0],48],[8,[4,2.5,17],[0,0,0],50]]),
      update(lt,dt,c){ g.visible=true; const X=3.6; const pre=lt<X;
        const sw=pre?1+0.6*smooth(lt/3.2)+0.04*Math.sin(lt*9):0.01; SN.scale.setScalar(pre?sw*(1-0.85*smooth(ramp(lt,3.25,3.6))):0.001); SN.visible=pre;
        sm.uniforms.uHot.value=0; SN.userData.set(pre?0.55-0.2*smooth(lt/3)+0.9*smooth(ramp(lt,3.2,3.6)):0);
        const x=Math.max(0,lt-X); ej.material.uniforms.uX.value=easeOut(x/4.4)*4.4; ej.material.uniforms.uK.value=pre?0:smooth(x/0.2)*(1-0.3*ramp(x,3,4.4));
        ring.scale.setScalar(0.5+x*6); ring.material.opacity=pre?0:0.8*Math.exp(-x*1.2);
        pulsar.visible=!pre; pulsar.rotation.z=0.45; pulsar.rotation.y=lt*5.2; bm.opacity=pre?0:0.28*smooth(ramp(x,0.8,1.8));
        c.flash=pre?0:1.0*Math.exp(-x*3.5)*smooth(x/0.06); c.streak=pre?0:0.35*Math.exp(-x*1.8); c.sky.set(0,0.45); c.bars=1; }};
  }

  // ============================================================ 5 · MILKY WAY FORMS (particle galaxy)
  { const g=add(new THREE.Group()); const N=170000, r=rng(41), P=new Float32Array(N*3), C0=new Float32Array(N*3), CO=new Float32Array(N*3), SZ=new Float32Array(N);
    for(let i=0;i<N;i++){ let x,y,z,col,s=1; const t=r();
      if(t<0.16){ const rr=Math.abs(gauss(r))*0.9; const v=new V3(gauss(r),gauss(r)*0.55,gauss(r)).normalize().multiplyScalar(rr); x=v.x;y=v.y;z=v.z; col=[1,0.82,0.6]; s=1.1; }
      else { const rr=Math.min(11,0.6-Math.log(1-r()*0.995)*2.3); const arm=(r()*2)|0; const th=arm*Math.PI+Math.log(rr+0.4)*2.35+gauss(r)*0.36/Math.pow(rr,0.25)+(r()<0.25?gauss(r)*1.2:0);
        x=Math.cos(th)*rr; z=Math.sin(th)*rr; y=gauss(r)*0.09*(1+rr*0.05); const q=r();
        col=q<0.55?[0.62,0.74,1]:q<0.9?[1,0.88,0.7]:q<0.965?[1,0.45,0.6]:[0.9,0.95,1]; if(q>=0.9&&q<0.965) s=2.3; }
      P.set([x,y,z],i*3); C0.set(col,i*3); const u=new V3(gauss(r),gauss(r),gauss(r)).multiplyScalar(4.5); CO.set([u.x+(r()<0.3?8:0),u.y,u.z],i*3); SZ[i]=s*(0.6+r()*0.8); }
    const gal=points(N,{position:P,aC:C0,aO:CO,aS:SZ},`attribute vec3 aC,aO; attribute float aS; uniform float uF,uT,uK; varying vec3 vC; varying float vA;
      void main(){ vec3 p=position; float rr=length(p.xz); float w=0.22/(rr+0.35); float a=uT*w; float cs=cos(a),sn=sin(a); p.xz=mat2(cs,-sn,sn,cs)*p.xz;
        vec3 q=mix(aO,p,smoothstep(0.0,1.0,uF)); vec4 mv=modelViewMatrix*vec4(q,1.0); gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(uPH*0.016*aS/-mv.z,0.9*uPx,14.0*uPx); vC=aC; vA=uK*(0.26+0.4*uF)*(rr<1.2?0.7:1.0); }`,{uF:{value:0},uT:{value:0},uK:{value:0}});
    g.add(gal);
    const bulge=sprite(SPR.glow,0xffd9a8,0.8); bulge.scale.setScalar(5); g.add(bulge);
    const halo=sprite(SPR.glow,0x8fa8ff,0.12); halo.scale.set(26,26,1); g.add(halo);
    const r2=rng(42), far=new THREE.Group(); for(let i=0;i<40;i++){ const s=sprite(SPR.soft,new THREE.Color().setHSL(0.08+r2()*0.55,0.4,0.7),0.25); const v=new V3(gauss(r2),gauss(r2),gauss(r2)).normalize().multiplyScalar(220+r2()*120); s.position.copy(v); s.scale.set(3+r2()*6,1+r2()*3,1); s.material.rotation=r2()*3; far.add(s); } g.add(far);
    S.galaxy={group:g, gal, cam:camPath([[0,[0,22,26],[0,0,0],50],[4,[6,15,19],[0,0,0],48],[7.5,[12,5.5,12],[0,0,0],46],[10,[5.5,1.2,4.8],[0,0,0],50]]),
      update(lt,dt,c){ g.visible=true; const u=gal.material.uniforms; u.uF.value=ease(ramp(lt,0.2,5.5)); u.uT.value=lt*1.6+4; u.uK.value=smooth(lt/1.2);
        bulge.material.opacity=0.42*ease(ramp(lt,1,5)); g.rotation.x=0.12; c.sky.set(0,0.25); c.streak=0.35*smooth(ramp(lt,8.2,10)); c.flash=0.18*smooth(ramp(lt,9.2,10)); c.bars=1; }};
  }

  // ============================================================ 6 · SAGITTARIUS A* (ray-marched black hole)
  { const g=add(new THREE.Group());
    const m=new THREE.ShaderMaterial({uniforms:{uTime:GU.uTime,uSky:{value:tex('milkyway.jpg')},uK:{value:1}},vertexShader:SURF_VS,side:THREE.BackSide,depthWrite:false,
      fragmentShader:NOISE+`uniform float uTime,uK; uniform sampler2D uSky; varying vec3 vPW;
      vec3 skyc(vec3 d){ vec2 uv=vec2(atan(d.z,d.x)/6.2831853+0.5,asin(clamp(d.y,-1.0,1.0))/3.14159265+0.5); vec3 s=texture2D(uSky,uv).rgb*0.6;
        vec2 g=uv*vec2(900.0,450.0); vec2 id=floor(g); float h=hash12(id); vec2 f=fract(g)-0.5; s+=vec3(1.0,0.95,0.9)*step(0.985,h)*exp(-dot(f,f)*60.0)*1.4; return s; }
      vec3 temp(float x){ return mix(mix(vec3(0.9,0.25,0.05),vec3(1.0,0.62,0.25),smoothstep(0.0,0.45,x)),vec3(1.0,0.95,0.9),smoothstep(0.5,1.0,x)); }
      void main(){ vec3 ro=cameraPosition, rd=normalize(vPW-cameraPosition);
        vec3 pos=ro, vel=rd; float h2=dot(cross(pos,vel),cross(pos,vel)); vec3 col=vec3(0.0); float al=0.0; bool hole=false;
        for(int i=0;i<170;i++){ float r=length(pos); if(r<1.0){ hole=true; break; } if(r>70.0&&dot(pos,vel)>0.0) break;
          float dt=clamp(0.045*r*r/(1.0+r*0.2),0.02,1.6); vec3 acc=-1.5*h2*pos/pow(r,5.0); vec3 np=pos+vel*dt; vel=normalize(vel+acc*dt);
          if(pos.y*np.y<0.0){ vec3 hp=mix(pos,np,pos.y/(pos.y-np.y)); float hr=length(hp.xz);
            if(hr>2.6&&hr<13.0){ float ang=atan(hp.z,hp.x); float om=1.6/pow(hr,1.5); float sw=ang+uTime*om;
              float n=fbm3(vec3(cos(sw)*hr*0.9,sin(sw)*hr*0.9,hr*0.35))*0.8+fbm3(vec3(hr*2.2,sw*3.0,uTime*0.05))*0.35;
              float t=pow(2.6/hr,0.9); vec3 vd=normalize(vec3(-hp.z,0.0,hp.x)); float v=sqrt(0.5/hr); float dop=pow(clamp(1.0-dot(vd,rd)*v*1.5,0.25,2.5),-2.6);
              float dens=smoothstep(2.6,3.4,hr)*smoothstep(13.0,8.0,hr)*(0.35+0.9*n); vec3 dc=temp(clamp(t*dop*0.9,0.0,1.0))*dens*(1.6+2.4*t)*dop;
              float da=clamp(dens*0.95,0.0,1.0); col+=(1.0-al)*dc*da; al+=(1.0-al)*da; if(al>0.98) break; } }
          pos=np; }
        if(!hole) col+=(1.0-al)*skyc(vel);
        gl_FragColor=vec4(col*uK,1.0); }`});
    const bh=new THREE.Mesh(new THREE.SphereGeometry(90,64,32),m); g.add(bh);
    S.blackhole={group:g, lowres:true, bright:true, cam:camPath([[0,[3,4,36],[0,0,0],44],[4.5,[14,2.2,19],[0,0,0],44],[9,[18,1.1,5],[0,0,0],42]]),
      update(lt,dt,c){ g.visible=true; m.uniforms.uK.value=1; c.flash=0; c.sky.set(0,0); c.bars=1; }};
  }

  // ============================================================ shared solar-system rig (disk + planets + sun)
  const sys=add(new THREE.Group());
  const SUN=makeSun(1); sys.add(SUN);
  const ORB={mercury:[2.2,.12,4.1],venus:[3.0,.22,1.6],earth:[3.9,.23,1.0],mars:[4.9,.16,.53],jupiter:[8.8,.75,.084],saturn:[11.5,.64,.034],uranus:[14,.38,.012],neptune:[16.3,.37,.006]};
  const PL={}; for(const id in ORB){ const p=id==='earth'?(()=>{ const e=makePlanet('mars'); e.userData.mat.uniforms.uMap.value=tex('earth_day.jpg'); e.userData.mat.uniforms.uAtmo.value.set('#5aa0ff'); e.userData.mat.uniforms.uAtmoK.value=0.9; return e; })():makePlanet(id);
    p.scale.setScalar(ORB[id][1]); p.userData.ph=Math.random()*6.28; sys.add(p); PL[id]=p; }
  PL.saturn.rotation.z=0.47; PL.uranus.rotation.z=1.7;
  const orbitLines=new THREE.Group(); for(const id in ORB){ const R=ORB[id][0]; const pts=[]; for(let i=0;i<=256;i++){ const a=i/256*6.2832; pts.push(new V3(Math.cos(a)*R,0,Math.sin(a)*R)); }
    orbitLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x8aa0c8,transparent:true,opacity:0.18,depthWrite:false}))); } sys.add(orbitLines);
  // accretion disk + asteroid belt
  const DN=90000, dr=rng(51), DP=new Float32Array(DN*3), DC=new Float32Array(DN);
  for(let i=0;i<DN;i++){ const R=1.3+Math.pow(dr(),0.8)*17; DP.set([R,gauss(dr)*0.045*Math.pow(R,1.2),dr()*6.2832],i*3); DC[i]=dr(); }
  const gaps=Object.values(ORB).map(o=>o[0]);
  const disk=points(DN,{position:DP,aR:DC},`attribute float aR; uniform float uT,uClear,uK,uGap[8]; varying vec3 vC; varying float vA;
    void main(){ float R=position.x; float a=position.z+uT*1.1/pow(R,1.5); vec3 p=vec3(cos(a)*R,position.y*(1.0-uClear*0.6),sin(a)*R);
      float gap=1.0; for(int i=0;i<8;i++){ float w=0.12+uGap[i]*0.02; gap*=1.0-uClear*exp(-pow((R-uGap[i])/w,2.0)); }
      float belt=smoothstep(5.9,6.3,R)*smoothstep(7.6,7.1,R); float keep=mix(1.0,max(belt,0.0),smoothstep(0.55,1.0,uClear));
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*0.03/-mv.z,0.8*uPx,10.0*uPx);
      vec3 warm=vec3(1.0,0.62,0.32), ice=vec3(0.55,0.7,1.0); vC=mix(warm,ice,smoothstep(3.0,11.0,R))*(0.5+aR)*(0.9+1.6*exp(-R*0.5));
      vA=uK*gap*keep*(0.28+0.4*aR)*mix(1.0,0.8,belt); }`,{uT:{value:0},uClear:{value:0},uK:{value:1},uGap:{value:gaps}});
  sys.add(disk);
  function sysTick(lt,rate,sunI){ const sunW=new V3(); SUN.getWorldPosition(sunW); SUN.userData.set(sunI);
    for(const id in ORB){ const [R,,w]=ORB[id], p=PL[id]; const a=p.userData.ph+lt*w*0.35*rate; p.position.set(Math.cos(a)*R,0,-Math.sin(a)*R); p.children[0].rotation.y=lt*0.4; litPlanet(p,sunW); } }
  S.system={group:sys,SUN,PL,ORB,disk,orbitLines,tick:sysTick};

  // ============================================================ 7 · THE SUN IS BORN (nebula collapse → ignition)
  { const g=add(new THREE.Group()); const N=60000, r=rng(61), A=new Float32Array(N*3), B=new Float32Array(N*3), C=new Float32Array(N);
    for(let i=0;i<N;i++){ const v=new V3(gauss(r),gauss(r)*0.7,gauss(r)).multiplyScalar(6); A.set([v.x,v.y,v.z],i*3); const R=0.9+Math.pow(r(),1.5)*9, a=r()*6.2832; B.set([Math.cos(a)*R,gauss(r)*0.06*R,Math.sin(a)*R],i*3); C[i]=r(); }
    const neb=points(N,{position:A,aB:B,aR:C},`attribute vec3 aB; attribute float aR; uniform float uC,uK; varying vec3 vC; varying float vA;
      void main(){ vec3 p=mix(position,aB,smoothstep(0.0,1.0,uC)); float R=length(p.xz); float a=uC*uC*2.4/(R*0.25+0.3); float cs=cos(a),sn=sin(a); p.xz=mat2(cs,-sn,sn,cs)*p.xz;
        p+=vec3(snoise(position*0.25+uTime*0.05),snoise(position*0.25+4.0),snoise(position*0.25+8.0))*0.6*(1.0-uC);
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(uPH*0.035*(0.5+aR)/-mv.z,1.0,14.0*uPx);
        vec3 ha=vec3(1.0,0.35,0.42), dust=vec3(1.0,0.66,0.4), blu=vec3(0.45,0.6,1.0); vC=mix(mix(ha,dust,aR),blu,step(0.86,aR))*(0.35+1.2*exp(-length(p)*0.35)*uC);
        vA=uK*(0.022+0.05*aR)*smoothstep(1.5,5.0,-mv.z); }`,{uC:{value:0},uK:{value:1}});
    g.add(neb);
    const proto=sprite(SPR.glow,0xffc27a,0); g.add(proto);
    const jet=new THREE.Group(); for(const s of [1,-1]){ const j=sprite(SPR.soft,0x9fc4ff,0); j.scale.set(0.5,6,1); j.position.y=3.2*s; jet.add(j); } g.add(jet);
    S.sunbirth={group:g, bright:true, cam:camPath([[0,[0,5,30],[0,0,0],50],[4,[3,3,17],[0,0,0],48],[8,[1.5,1.6,9.5],[0,0,0],46]]),
      update(lt,dt,c){ g.visible=true; const cc=ease(ramp(lt,0,5.8)); neb.material.uniforms.uC.value=cc; neb.material.uniforms.uK.value=1-0.65*smooth(ramp(lt,5,7.5));
        proto.material.opacity=(0.12+0.5*cc)*(1-0.75*smooth(ramp(lt,5.8,7))); proto.scale.setScalar(1+cc*2.2+(lt>5.8?1.2*Math.exp(-(lt-5.8)*2.5):0));
        jet.children.forEach(j=>j.material.opacity=0.35*env(lt,3.5,6.4,0.8,0.5));
        sys.visible=lt>5.7; if(sys.visible){ SUN.scale.setScalar(smooth(ramp(lt,5.7,6.4))); disk.visible=false; orbitLines.visible=false; for(const id in PL) PL[id].visible=false; sysTick(lt,1,0.55+0.45*smooth(ramp(lt,6.4,8))); }
        c.flash=lt>5.8?0.35*Math.exp(-(lt-5.8)*3):0; c.sky.set(0.12,0.35); c.bars=1; }};
  }

  // ============================================================ 8 · PLANETS COALESCE
  S.disk={group:null, bright:true, cam:camPath([[0,[1.5,1.6,9.5],[-1.6,-0.6,0],46],[3.5,[4,3.2,17],[0,0,0],50],[7,[-6,5,21],[0,0,0],50],[10,[-3,10.5,24],[0,0,0],50]]),
    update(lt,dt,c){ sys.visible=true; SUN.scale.setScalar(1); disk.visible=true; orbitLines.visible=false;
      const cl=ease(ramp(lt,1.5,9.5)); disk.material.uniforms.uClear.value=cl; disk.material.uniforms.uT.value=lt+20; disk.material.uniforms.uK.value=1;
      for(const id in PL){ const p=PL[id]; p.visible=true; p.scale.setScalar(ORB[id][1]*ease(ramp(lt,2+ORB[id][0]*0.18,6+ORB[id][0]*0.2))); p.userData.mat.uniforms.uHeat.value=1-0.75*ramp(lt,5,10); }
      sysTick(lt+20,1,1); c.sky.set(0.35,0.5); c.bars=1; }};

  // ============================================================ 9 · OUR SOLAR SYSTEM
  const NAMES={mercury:['ดาวพุธ','Mercury'],venus:['ดาวศุกร์','Venus'],earth:['โลก','Earth'],mars:['ดาวอังคาร','Mars'],jupiter:['ดาวพฤหัสบดี','Jupiter'],saturn:['ดาวเสาร์','Saturn'],uranus:['ดาวยูเรนัส','Uranus'],neptune:['ดาวเนปจูน','Neptune']};
  S.solar={group:null, bright:true, cam:(()=>{ const p=camPath([[0,[-3,10.5,24],[0,0,0],50],[3.5,[10,4,15],[2,0,0],46],[6.5,[9,1.1,-2],[0,0,-2],46],[9,[5.4,0.6,-3.2],[3.4,0,-1.6],40]]); return lt=>{ const k=p(lt); const e=PL.earth.position; if(lt>6) { k.l.lerp(e,smooth(ramp(lt,6,8.2))); } return k; }; })(),
    update(lt,dt,c){ sys.visible=true; SUN.scale.setScalar(1); disk.visible=true; disk.material.uniforms.uClear.value=1; disk.material.uniforms.uT.value=lt+30; disk.material.uniforms.uK.value=0.9;
      orbitLines.visible=true; orbitLines.children.forEach(l=>l.material.opacity=0.2*smooth(lt/1.5)*(1-ramp(lt,6.5,8.5)));
      for(const id in PL){ const p=PL[id]; p.visible=true; p.scale.setScalar(ORB[id][1]); p.userData.mat.uniforms.uHeat.value=0; }
      sysTick(lt+30,1,1); const a=env(lt,0.8,6.6,0.8,0.8); if(a>0.01) for(const id in PL) c.labels.push({p:PL[id].position,th:NAMES[id][0],en:NAMES[id][1],a,off:ORB[id][1]});
      c.sky.set(0.55,0.6); c.bars=1; }};

  return S;
}
