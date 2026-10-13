/* ============================================================================
   Cosmic Audio — a generative, scene-reactive ambient engine (Web Audio API)
   ----------------------------------------------------------------------------
   No samples. Everything is synthesised live and modulated as the journey moves
   from scene to scene, so the score never repeats and always glides — never cuts.

   Signal graph
   ------------
        pad voices (5) ─┐
        sub oscillator ─┤
        texture noise  ─┼──► dryBus ───────────────┐
        arp / sfx (transient) ─► (dry + send)        ├──► limiter ──► master ──► out
                          └──► reverbSend ─► convolver ─► wetBus ─┘

   Public API (window.CosmicAudio)
   -------------------------------
     init()            create + resume the context (call inside a user gesture)
     setScene(id)      glide the whole bed to a scene's musical palette
     trigger(type)     fire a one-shot ('bang','chime','impact','swell','riser','sparkle')
     setPlaying(bool)  duck to a quiet drone when paused, swell back when playing
     setEnabled(bool)  master mute / un-mute (persisted by the host)
     toggle()          flip enabled, returns new state
     isEnabled()       current mute state
     isReady()         context exists
     setDuck(bool)     dip the whole score under narration
============================================================================ */
window.CosmicAudio = (function () {
  "use strict";

  // ---- per-scene palettes -------------------------------------------------
  // root  : MIDI note for the chord root (low register)
  // pad   : semitone offsets stacked into the sustained chord
  // scale : semitone offsets the arpeggio/shimmer draws from
  // padLvl: pad bed level            cut : pad low-pass cutoff (Hz, brightness)
  // arp   : seconds between arp notes (0 = no arpeggio)   arpLvl : arp level
  // tex   : noise-bed character      texLvl : its level
  // wave  : arp timbre               enter  : SFX fired when the scene begins
  const P = {
    bigbang:     { root:33, pad:[0,7,12],        scale:[0,7,12,19,24],     padLvl:0.20, cut:360,  arp:0,    arpLvl:0,    tex:'space',  texLvl:0.30, wave:'sine',     enter:'bang'   },
    stars:       { root:36, pad:[0,7,16,19],     scale:[0,4,7,11,16,19],   padLvl:0.22, cut:760,  arp:1.40, arpLvl:0.12, tex:'space',  texLvl:0.18, wave:'triangle', enter:'chime'  },
    supernova:   { root:31, pad:[0,3,7,10],      scale:[0,3,7,10,14],      padLvl:0.24, cut:900,  arp:0.80, arpLvl:0.13, tex:'rumble', texLvl:0.24, wave:'triangle', enter:'impact' },
    galaxy:      { root:36, pad:[0,7,12,16,19],  scale:[0,2,7,9,12,14],    padLvl:0.26, cut:820,  arp:1.10, arpLvl:0.12, tex:'space',  texLvl:0.20, wave:'sine',     enter:'swell'  },
    sun:         { root:38, pad:[0,4,7,11,18],   scale:[0,2,4,7,11,18],    padLvl:0.26, cut:1240, arp:0.90, arpLvl:0.14, tex:'space',  texLvl:0.13, wave:'triangle', enter:'riser'  },
    coalesce:    { root:38, pad:[0,7,12,16],     scale:[0,2,4,7,9,12],     padLvl:0.20, cut:1120, arp:0.42, arpLvl:0.13, tex:'space',  texLvl:0.12, wave:'sine',     enter:'sparkle'},
    solar:       { root:41, pad:[0,4,7,11],      scale:[0,4,7,11,14,16],   padLvl:0.24, cut:1200, arp:0.55, arpLvl:0.13, tex:'space',  texLvl:0.12, wave:'triangle', enter:'chime'  },
    earth:       { root:36, pad:[0,4,7,11,14],   scale:[0,2,4,7,9,11],     padLvl:0.27, cut:1020, arp:1.00, arpLvl:0.12, tex:'sea',    texLvl:0.17, wave:'sine',     enter:'swell'  },
    theia:       { root:34, pad:[0,3,6,10],      scale:[0,3,6,10,12],      padLvl:0.26, cut:940,  arp:0.70, arpLvl:0.13, tex:'rumble', texLvl:0.28, wave:'triangle', enter:'impact' },
    bombardment: { root:31, pad:[0,1,7,8],       scale:[0,1,3,7,8],        padLvl:0.26, cut:680,  arp:0.50, arpLvl:0.11, tex:'rumble', texLvl:0.34, wave:'sawtooth', enter:'impact' },
    firstlife:   { root:36, pad:[0,7,12,16],     scale:[0,2,4,7,9,12],     padLvl:0.22, cut:1000, arp:0.90, arpLvl:0.13, tex:'sea',    texLvl:0.19, wave:'sine',     enter:'chime'  },
    cambrian:    { root:38, pad:[0,4,7,9,14],    scale:[0,2,4,7,9,11,14],  padLvl:0.22, cut:1320, arp:0.34, arpLvl:0.14, tex:'wind',   texLvl:0.14, wave:'triangle', enter:'sparkle'},
    humans:      { root:41, pad:[0,4,7,11,14],   scale:[0,2,4,7,11,14],    padLvl:0.27, cut:1300, arp:0.80, arpLvl:0.15, tex:'wind',   texLvl:0.12, wave:'sine',     enter:'swell'  },
    spaceage:    { root:43, pad:[0,4,7,11,18],   scale:[0,2,4,7,9,11,18],  padLvl:0.24, cut:1640, arp:0.42, arpLvl:0.15, tex:'space',  texLvl:0.10, wave:'triangle', enter:'sparkle'},
    moon:        { root:38, pad:[0,5,7,12,16],   scale:[0,2,5,7,9,12],     padLvl:0.27, cut:1520, arp:0.60, arpLvl:0.15, tex:'space',  texLvl:0.10, wave:'sine',     enter:'riser'  },
    orbital:     { root:43, pad:[0,7,12,16,19],  scale:[0,2,4,7,9,12,14],  padLvl:0.24, cut:1720, arp:0.30, arpLvl:0.14, tex:'space',  texLvl:0.10, wave:'triangle', enter:'sparkle'},
    paleblue:    { root:33, pad:[0,7,12,19],     scale:[0,7,12,19,24],     padLvl:0.30, cut:920,  arp:1.80, arpLvl:0.11, tex:'space',  texLvl:0.22, wave:'sine',     enter:'swell'  }
  };

  // texture filter character per ambience type: [filterType, baseFreq, Q, lfoDepth, lfoRate]
  const TEX = {
    space:  ['lowpass',  220, 0.7, 60,  0.05],
    rumble: ['lowpass',  120, 1.2, 30,  0.07],
    sea:    ['lowpass',  420, 0.8, 180, 0.13],
    wind:   ['bandpass', 620, 0.9, 260, 0.20]
  };

  const VOICES = 5;          // pad voice count
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  let ctx, master, duck, limiter, dryBus, wetBus, reverb, reverbSend;
  let padFilter, voices = [], sub, subFilter;
  let noiseSrc, texFilter, texGain, texLFO, texLFOGain;
  let started = false, enabled = true, playing = false;
  let pal = null, sched = null, nextArp = 0;
  const VOL = 0.85;          // overall ceiling

  const now = () => ctx.currentTime;
  const ramp = (param, v, tc = 0.5) => param.setTargetAtTime(v, now(), tc);

  // ---- buffer factories ---------------------------------------------------
  function noiseBuffer(seconds) {
    const len = (ctx.sampleRate * seconds) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function impulseBuffer(seconds, decay) {
    const len = (ctx.sampleRate * seconds) | 0;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // ---- build the persistent graph ----------------------------------------
  function init() {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;

    master = ctx.createGain();   master.gain.value = 0.0001;       // fades up on first scene
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 12;
    limiter.attack.value = 0.004;  limiter.release.value = 0.25;
    duck = ctx.createGain(); duck.gain.value = 1;
    master.connect(duck); duck.connect(limiter); limiter.connect(ctx.destination);

    dryBus = ctx.createGain(); dryBus.gain.value = 1.0; dryBus.connect(master);
    wetBus = ctx.createGain(); wetBus.gain.value = 0.9; wetBus.connect(master);
    reverb = ctx.createConvolver(); reverb.buffer = impulseBuffer(3.6, 3.0);
    reverb.connect(wetBus);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.34; reverbSend.connect(reverb);

    // --- pad ---
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 500; padFilter.Q.value = 0.6;
    padFilter.connect(dryBus); padFilter.connect(reverbSend);
    for (let i = 0; i < VOICES; i++) {
      const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(padFilter);
      const oscs = [];
      for (let u = 0; u < 2; u++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 110;
        o.detune.value = u ? 7 : -7;             // soft unison shimmer
        o.connect(g); o.start();
        oscs.push(o);
      }
      voices.push({ g: g, oscs: oscs });
    }

    // --- sub bass ---
    subFilter = ctx.createBiquadFilter(); subFilter.type = 'lowpass'; subFilter.frequency.value = 140;
    subFilter.connect(dryBus);
    sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 55;
    const subG = ctx.createGain(); subG.gain.value = 0.12; sub.connect(subG); subG.connect(subFilter);
    sub.start();

    // --- texture noise bed ---
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noiseBuffer(4); noiseSrc.loop = true;
    texFilter = ctx.createBiquadFilter(); texFilter.type = 'lowpass'; texFilter.frequency.value = 220; texFilter.Q.value = 0.7;
    texGain = ctx.createGain(); texGain.gain.value = 0.0001;
    noiseSrc.connect(texFilter); texFilter.connect(texGain);
    texGain.connect(dryBus); texGain.connect(reverbSend);
    noiseSrc.start();
    // slow LFO wobbling the texture filter for "movement"
    texLFO = ctx.createOscillator(); texLFO.type = 'sine'; texLFO.frequency.value = 0.07;
    texLFOGain = ctx.createGain(); texLFOGain.gain.value = 60;
    texLFO.connect(texLFOGain); texLFOGain.connect(texFilter.frequency); texLFO.start();

    // start the arpeggio scheduler
    nextArp = now() + 0.1;
    sched = setInterval(scheduler, 25);

    ramp(master.gain, enabled ? VOL : 0.0001, 1.2);
  }

  // ---- glide the bed to a scene ------------------------------------------
  function setScene(id) {
    if (!started || !P[id]) return;
    pal = P[id];
    const root = pal.root;

    // chord voices glide (portamento) to the new chord
    for (let i = 0; i < VOICES; i++) {
      const v = voices[i];
      if (i < pal.pad.length) {
        const f = mtof(root + pal.pad[i]);
        v.oscs.forEach(o => o.frequency.setTargetAtTime(f, now(), 0.7));
        ramp(v.g.gain, (pal.padLvl / pal.pad.length) * 1.4, 0.8);
      } else {
        ramp(v.g.gain, 0.0001, 0.8);
      }
    }
    ramp(padFilter.frequency, pal.cut, 0.9);
    sub.frequency.setTargetAtTime(mtof(root - 12), now(), 0.9);

    // texture character
    const tx = TEX[pal.tex] || TEX.space;
    texFilter.type = tx[0];
    ramp(texFilter.frequency, tx[1], 1.0);
    texFilter.Q.value = tx[2];
    ramp(texLFOGain.gain, tx[3], 1.0);
    texLFO.frequency.setTargetAtTime(tx[4], now(), 1.0);
    ramp(texGain.gain, pal.texLvl, 1.2);
  }

  // ---- arpeggio scheduler (look-ahead clock) ------------------------------
  function scheduler() {
    if (!started) return;
    const horizon = now() + 0.12;
    while (nextArp < horizon) {
      if (pal && pal.arp > 0 && enabled && playing) arpNote(nextArp);
      const step = (pal && pal.arp > 0) ? pal.arp : 0.4;
      nextArp += step * (0.85 + Math.random() * 0.3);
    }
  }
  function arpNote(time) {
    const root = pal.root, sc = pal.scale;
    const semi = sc[(Math.random() * sc.length) | 0];
    const oct = 24 + (Math.random() < 0.35 ? 12 : 0);
    const f = mtof(root + semi + oct);
    const o = ctx.createOscillator(); o.type = pal.wave; o.frequency.value = f;
    const g = ctx.createGain();
    const dur = Math.min(3, Math.max(0.6, pal.arp * 2.4));
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(pal.arpLvl, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(g);
    if (pan) { pan.pan.value = Math.random() * 1.2 - 0.6; g.connect(pan); pan.connect(dryBus); pan.connect(reverbSend); }
    else { g.connect(dryBus); g.connect(reverbSend); }
    o.start(time); o.stop(time + dur + 0.05);
  }

  // ---- one-shot SFX -------------------------------------------------------
  function trigger(type) {
    if (!started || !enabled) return;
    const t = now();
    switch (type) {
      case 'bang': {
        // a sub that drops out of nothing + a vast filtered noise bloom
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.6);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(og); og.connect(dryBus); og.connect(reverbSend); o.start(t); o.stop(t + 2.3);

        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(2.4);
        const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.Q.value = 1.2;
        nf.frequency.setValueAtTime(80, t);
        nf.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
        nf.frequency.exponentialRampToValueAtTime(120, t + 2.2);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
        n.connect(nf); nf.connect(ng); ng.connect(dryBus); ng.connect(reverbSend);
        n.start(t); n.stop(t + 2.4);
        break;
      }
      case 'impact': {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(dryBus); g.connect(reverbSend); o.start(t); o.stop(t + 1.0);

        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.5);
        const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 700;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        n.connect(nf); nf.connect(ng); ng.connect(dryBus); ng.connect(reverbSend); n.start(t); n.stop(t + 0.5);
        break;
      }
      case 'chime': bells(t, pal ? pal.root + 24 : 60, pal ? pal.scale : [0,4,7,12], 3, 0.16, 2.6); break;
      case 'sparkle': bells(t, pal ? pal.root + 36 : 72, pal ? pal.scale : [0,2,4,7], 5, 0.10, 0.9); break;
      case 'swell': {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(2.5);
        const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 1.0;
        bf.frequency.setValueAtTime(200, t); bf.frequency.exponentialRampToValueAtTime(1600, t + 1.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        n.connect(bf); bf.connect(g); g.connect(dryBus); g.connect(reverbSend); n.start(t); n.stop(t + 2.5);
        break;
      }
      case 'riser': {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        const base = pal ? mtof(pal.root + 12) : 110;
        o.frequency.setValueAtTime(base * 0.5, t); o.frequency.exponentialRampToValueAtTime(base * 2, t + 2.0);
        const lf = ctx.createBiquadFilter(); lf.type = 'lowpass';
        lf.frequency.setValueAtTime(300, t); lf.frequency.exponentialRampToValueAtTime(2600, t + 2.0);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
        o.connect(lf); lf.connect(g); g.connect(dryBus); g.connect(reverbSend); o.start(t); o.stop(t + 2.3);
        break;
      }
    }
  }
  function bells(t, rootMidi, scale, count, lvl, decay) {
    for (let i = 0; i < count; i++) {
      const semi = scale[(Math.random() * scale.length) | 0];
      const f = mtof(rootMidi + semi);
      const st = t + i * (decay > 1.5 ? 0.12 : 0.06);
      [1, 2.01, 3.0].forEach((mult, k) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
        const g = ctx.createGain();
        const peak = lvl * (k === 0 ? 1 : k === 1 ? 0.4 : 0.18);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(peak, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + decay);
        o.connect(g); g.connect(dryBus); g.connect(reverbSend); o.start(st); o.stop(st + decay + 0.05);
      });
    }
  }

  // ---- transport / mute ---------------------------------------------------
  function setPlaying(p) {
    playing = p;
    if (!started) return;
    // paused → quiet drifting drone; playing → full bed
    ramp(master.gain, enabled ? (p ? VOL : VOL * 0.22) : 0.0001, p ? 0.6 : 1.0);
  }
  function setEnabled(e) {
    enabled = e;
    if (!started) return;
    ramp(master.gain, e ? (playing ? VOL : VOL * 0.22) : 0.0001, 0.4);
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function setDuck(on) { if (started) duck.gain.setTargetAtTime(on ? 0.42 : 1, ctx.currentTime, on ? 0.15 : 0.8); }

  // set the bed AND fire the scene's entrance SFX (used on real scene transitions)
  function enterScene(id) {
    if (!started || !P[id]) return;
    setScene(id);
    trigger(P[id].enter);
  }

  return {
    init: init,
    setScene: setScene,
    enterScene: enterScene,
    trigger: trigger,
    setPlaying: setPlaying,
    setEnabled: setEnabled,
    setDuck: setDuck,
    toggle: toggle,
    isEnabled: function () { return enabled; },
    isReady: function () { return started; }
  };
})();
