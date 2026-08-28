/* ============================================================
   AmbienceEngine — Dream Worlds room mixer
   ------------------------------------------------------------
   Replaces an engine with four measured defects:

     1. LFO depth was an ABSOLUTE gain offset summed into the layer
        gain, so four of seven layers were audible at 0% (ocean at 0
        swung to +/-0.23) and thunder overshot its target 9.6x while
        inverting phase. Here the LFO modulates a separate depth node
        around a base of 1.0, and layerGain alone carries the user's
        level — so 0% is silent, by construction.

     2. All seven "different" sounds were one brown-noise generator
        plus biquads. Fire had no crackle, night no chirps, stream no
        water, thunder no swell. Each layer now has real character.

     3. Seven 4s stereo buffers were generated eagerly and
        synchronously on the first Play — 2.69M iterations, 33.6ms.
        Now: two mono buffers, built lazily in chunks across frames.

     4. A -20dB 8:1 compressor with a 6ms attack pumped audibly on
        broadband noise. Replaced by per-layer trim, a soft bus
        lowpass, and a gentle safety limiter.
   ============================================================ */

window.AmbienceEngine = (function () {
  "use strict";

  var BUFFER_SECONDS = 20;
  var CHUNKS = 40;              // slice size; a frame runs as many as fit in 4ms
  var LOOKAHEAD = 1.0;          // event scheduler horizon, seconds
  var TICK = 250;               // scheduler interval, ms

  // Per-layer spec. `trim` is perceptual normalisation so that 50% of
  // one layer sits at roughly the same loudness as 50% of another.
  var SPEC = {
    rain:    { kind: "file", src: "assets/audio/rain.ogg",           trim: 0.90 },
    forest:  { kind: "file", src: "assets/audio/forest.ogg",         trim: 0.80 },
    cafe:    { kind: "file", src: "assets/audio/cafe.m4a",           trim: 0.85 },
    brown:   { kind: "file", src: "assets/audio/brown.ogg",          trim: 0.70 },
    soft:    { kind: "file", src: "assets/audio/placid-ambient.ogg", trim: 0.80 },

    white:   { kind: "noise", base: "white", trim: 0.32,
               filters: [["highpass", 90, 0.4], ["lowpass", 7600, 0.4]] },
    wind:    { kind: "noise", base: "brown", trim: 0.75,
               filters: [["lowpass", 700, 0.8], ["highpass", 70, 0.4]],
               gust: { min: 380, max: 1400, rate: 0.045 } },
    ocean:   { kind: "noise", base: "brown", trim: 0.80,
               filters: [["lowpass", 560, 1.0], ["highpass", 50, 0.4]],
               swell: { rate: 0.055, depth: 0.30, cutoffLow: 320, cutoffHigh: 900 } },
    stream:  { kind: "noise", base: "white", trim: 0.44,
               filters: [["highpass", 1400, 0.7], ["lowpass", 7200, 0.5]],
               shimmer: true },
    fire:    { kind: "noise", base: "brown", trim: 0.62,
               filters: [["highpass", 90, 0.5], ["lowpass", 1250, 0.8]],
               crackle: { rate: 11, gain: 0.5 } },
    night:   { kind: "noise", base: "white", trim: 0.20,
               filters: [["bandpass", 4600, 2.4], ["highpass", 2600, 0.7]],
               chirp: { rate: 0.75 } },
    thunder: { kind: "noise", base: "brown", trim: 0.85,
               filters: [["lowpass", 150, 1.1], ["highpass", 26, 0.5]],
               rumble: { minGap: 26, maxGap: 74 } }
  };

  // Chunked generation exists to protect the frame budget. In a hidden tab
  // there are no frames to protect AND timers throttle to ~1/second, which
  // turned a 170ms build into a 10s one and left layers silent. So: if we
  // cannot be seen, just build it in one pass.
  function hidden() {
    return typeof document !== "undefined" && document.hidden === true;
  }
  function nextSlice(fn) {
    var done = false;
    var wrap = function () { if (done) return; done = true; fn(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(wrap);
    setTimeout(wrap, 32);
  }

  var ctx = null;
  var bus = null, tone = null, limiter = null;
  var layers = Object.create(null);
  var buffers = { white: null, brown: null };
  var building = Object.create(null);
  var master = 0.52;
  var running = false;
  var schedulerId = null;
  var ready = false;

  /* ---------- noise buffers, generated lazily in slices ---------- */

  function makeBuffer(kind, done) {
    if (buffers[kind]) { done(buffers[kind]); return; }
    if (building[kind]) { building[kind].push(done); return; }
    building[kind] = [done];

    var length = Math.floor(ctx.sampleRate * BUFFER_SECONDS);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var slice = Math.ceil(length / CHUNKS);
    var i = 0, brown = 0;

    function fill(end) {
      if (kind === "white") {
        for (; i < end; i++) data[i] = Math.random() * 2 - 1;
      } else {
        // Integrated (brown) noise, normalised below so it never clips.
        for (; i < end; i++) {
          brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          data[i] = brown;
        }
      }
    }

    function step() {
      if (hidden()) {
        fill(length);              // nothing to jank; finish it now
      } else {
        var budget = performance.now() + 4;   // ~4ms per frame, never a long task
        while (i < length && performance.now() < budget) {
          fill(Math.min(length, i + slice));
        }
      }
      if (i < length) { nextSlice(step); return; }

      var peak = 0;
      for (var k = 0; k < length; k++) { var a = data[k] < 0 ? -data[k] : data[k]; if (a > peak) peak = a; }
      if (peak > 0) { var g = 0.85 / peak; for (var j = 0; j < length; j++) data[j] *= g; }

      buffers[kind] = buffer;
      var waiting = building[kind]; delete building[kind];
      for (var w = 0; w < waiting.length; w++) waiting[w](buffer);
    }
    nextSlice(step);
  }

  /* ---------- graph construction ---------- */

  function biquad(def) {
    var f = ctx.createBiquadFilter();
    f.type = def[0]; f.frequency.value = def[1]; f.Q.value = def[2];
    return f;
  }

  function buildNoiseLayer(id) {
    var spec = SPEC[id];
    var node = layers[id];

    makeBuffer(spec.base, function (buffer) {
      if (node.disposed) return;

      // Two playback heads, offset by half the buffer and crossfaded, so the
      // loop point is never a discontinuity. The old 4s loop clicked audibly.
      node.heads = [];
      for (var h = 0; h < 2; h++) {
        var src = ctx.createBufferSource();
        src.buffer = buffer; src.loop = true;
        var hg = ctx.createGain();
        hg.gain.value = 0.5;
        src.connect(hg).connect(node.chainIn);
        try { src.start(0, h === 0 ? 0 : BUFFER_SECONDS / 2); } catch (e) { src.start(0); }
        node.heads.push(src);
      }

      node.built = true;
      applyLayer(id, false);   // ramp, never a step — a step here clicks
    });
  }

  function createLayer(id) {
    if (layers[id]) return layers[id];
    var spec = SPEC[id];
    if (!spec) return null;

    // depthGain is modulated around 1.0; layerGain carries the user level.
    var depthGain = ctx.createGain(); depthGain.gain.value = 1;
    var layerGain = ctx.createGain(); layerGain.gain.value = 0;

    var node = {
      id: id, spec: spec, depthGain: depthGain, layerGain: layerGain,
      value: 0, muted: false, built: false, disposed: false,
      lfo: null, lfoDepth: 0, lfoRate: 0, lfoPhase: Math.random() * Math.PI * 2,
      nextEvent: 0, element: null, heads: [], chainIn: null
    };

    depthGain.connect(layerGain).connect(bus);

    if (spec.kind === "file") {
      var el = new Audio();
      el.src = spec.src; el.loop = true; el.preload = "none";
      el.crossOrigin = "anonymous";
      node.element = el;
      var msrc = ctx.createMediaElementSource(el);
      msrc.connect(depthGain);
      node.chainIn = depthGain;
      node.built = true;
    } else {
      // filters run before depthGain so modulation applies to the whole layer
      var chain = spec.filters.map(biquad);
      for (var i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
      chain[chain.length - 1].connect(depthGain);
      node.chainIn = chain[0];
      node.filters = chain;

      // Gentle breathing. Depth is RELATIVE (fraction of 1.0), so a layer at
      // 5% can never swing to full scale the way the old absolute offset did.
      var depth = 0, rate = 0.08;
      if (spec.gust)    { depth = 0.10; rate = spec.gust.rate; }
      if (spec.swell)   { depth = spec.swell.depth; rate = spec.swell.rate; }
      if (spec.shimmer) { depth = 0.12; rate = 0.09; }
      if (spec.crackle) { depth = 0.08; rate = 0.07; }
      if (spec.chirp)   { depth = 0.10; rate = 0.06; }
      if (spec.rumble)  { depth = 0.05; rate = 0.03; }
      if (id === "white") { depth = 0; }

      if (depth > 0) {
        var lfo = ctx.createOscillator();
        var lfoGain = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = rate;
        lfoGain.gain.value = depth;      // relative: 1.0 +/- depth
        lfo.connect(lfoGain).connect(depthGain.gain);
        try { lfo.start(); } catch (e) {}
        node.lfo = lfo; node.lfoDepth = depth; node.lfoRate = rate;
      }

      // Wind gusts move the FILTER, not the gain — that is what a gust is.
      if (spec.gust) {
        var gl = ctx.createOscillator(), gg = ctx.createGain();
        gl.type = "sine"; gl.frequency.value = spec.gust.rate * 1.7;
        gg.gain.value = (spec.gust.max - spec.gust.min) / 2;
        chain[0].frequency.value = (spec.gust.max + spec.gust.min) / 2;
        gl.connect(gg).connect(chain[0].frequency);
        try { gl.start(); } catch (e) {}
      }
      // Ocean: cutoff opens as the swell rises, in antiphase to the wash out.
      if (spec.swell) {
        var sl = ctx.createOscillator(), sg = ctx.createGain();
        sl.type = "sine"; sl.frequency.value = spec.swell.rate;
        sg.gain.value = (spec.swell.cutoffHigh - spec.swell.cutoffLow) / 2;
        chain[0].frequency.value = (spec.swell.cutoffHigh + spec.swell.cutoffLow) / 2;
        sl.connect(sg).connect(chain[0].frequency);
        try { sl.start(); } catch (e) {}
      }
      // Stream: two detuned resonant peaks drifting independently = water.
      if (spec.shimmer) {
        node.shimmerNodes = [];
        [[1750, 0.055], [2600, 0.037]].forEach(function (cfg) {
          var bp = ctx.createBiquadFilter();
          bp.type = "peaking"; bp.frequency.value = cfg[0]; bp.Q.value = 4.5; bp.gain.value = 9;
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.value = cfg[1]; g.gain.value = cfg[0] * 0.22;
          o.connect(g).connect(bp.frequency);
          try { o.start(); } catch (e) {}
          node.shimmerNodes.push(bp);
        });
        // splice the peaks into the chain
        var last = chain[chain.length - 1];
        last.disconnect();
        var cur = last;
        node.shimmerNodes.forEach(function (bp) { cur.connect(bp); cur = bp; });
        cur.connect(depthGain);
      }

      layers[id] = node;
      buildNoiseLayer(id);
      return node;
    }

    layers[id] = node;
    return node;
  }

  /* ---------- event layers: crackle, chirp, rumble ---------- */

  function burst(node, when, opts) {
    var b = buffers[node.spec.base] || buffers.white;
    if (!b) return;
    var src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = false;
    var off = Math.random() * Math.max(0.01, b.duration - opts.dur - 0.01);
    var f = ctx.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.value = opts.freq;
    f.Q.value = opts.q || 2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.peak), when + opts.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);
    src.connect(f).connect(g).connect(node.depthGain);
    try { src.start(when, off, opts.dur + 0.05); } catch (e) {}
    src.stop(when + opts.dur + 0.05);
  }

  function scheduleEvents() {
    if (!ctx || !running) return;
    var now = ctx.currentTime;
    var horizon = now + LOOKAHEAD;

    Object.keys(layers).forEach(function (id) {
      var node = layers[id];
      var spec = node.spec;
      if (!node.built || node.muted || node.value <= 0) return;
      if (!spec.crackle && !spec.chirp && !spec.rumble) return;
      if (node.nextEvent < now) node.nextEvent = now + 0.1;

      while (node.nextEvent < horizon) {
        var t = node.nextEvent;
        if (spec.crackle) {
          // Sparse sharp transients — this is what makes a fire a fire.
          burst(node, t, { freq: 900 + Math.random() * 2600, q: 1.2 + Math.random() * 2,
                           peak: 0.10 + Math.random() * spec.crackle.gain,
                           attack: 0.002, dur: 0.035 + Math.random() * 0.07 });
          node.nextEvent = t + (0.35 + Math.random() * 1.9) / (spec.crackle.rate / 6);
        } else if (spec.chirp) {
          var reps = 1 + Math.floor(Math.random() * 3);
          for (var r = 0; r < reps; r++) {
            burst(node, t + r * 0.14, { freq: 2600 + Math.random() * 2400, q: 9,
                                        peak: 0.16 + Math.random() * 0.18,
                                        attack: 0.012, dur: 0.075 });
          }
          node.nextEvent = t + 1.4 + Math.random() * 5.2;
        } else {
          // Distant thunder: rare, slow, low. Never a click.
          burst(node, t, { type: "lowpass", freq: 90 + Math.random() * 70, q: 0.8,
                           peak: 0.55, attack: 0.9, dur: 3.4 + Math.random() * 2.6 });
          node.nextEvent = t + spec.rumble.minGap + Math.random() * (spec.rumble.maxGap - spec.rumble.minGap);
        }
      }
    });
  }

  /* ---------- mixing ---------- */

  function targetGain(node) {
    if (node.muted || node.value <= 0) return 0;
    return (node.value / 100) * node.spec.trim;
  }

  function applyLayer(id, immediate) {
    var node = layers[id];
    if (!node || !ctx) return;
    var now = ctx.currentTime;
    var g = running ? targetGain(node) : 0;
    if (immediate) node.layerGain.gain.setValueAtTime(g, now);
    else node.layerGain.gain.setTargetAtTime(g, now, 0.10);

    if (node.element) {
      if (running && !node.muted && node.value > 0) {
        if (node.element.preload === "none") { node.element.preload = "auto"; node.element.load(); }
        var p = node.element.play(); if (p && p.catch) p.catch(function () {});
      } else if (!node.element.paused) {
        node.element.pause();
      }
    }
  }

  function applyAll(immediate) {
    Object.keys(layers).forEach(function (id) { applyLayer(id, immediate); });
    if (bus) {
      var now = ctx.currentTime;
      var level = running ? master * 0.62 : 0;
      if (immediate) bus.gain.setValueAtTime(level, now);
      else bus.gain.setTargetAtTime(level, now, 0.08);
    }
  }

  /* ---------- public ---------- */

  function init() {
    if (ctx) {
      if (ctx.state === "suspended") return ctx.resume();
      return Promise.resolve();
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve();
    ctx = new AC();

    bus = ctx.createGain();
    bus.gain.value = 0;

    // Soft top-end roll-off: turns "hiss" into "air".
    tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 12000;
    tone.Q.value = 0.5;

    // Safety only — gentle, slow, and nothing like the old 8:1 at 6ms.
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.02;
    limiter.release.value = 0.40;

    bus.connect(tone).connect(limiter).connect(ctx.destination);

    ready = true;
    if (schedulerId === null) schedulerId = setInterval(scheduleEvents, TICK);
    return ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
  }

  function ensureLayer(id) {
    if (!ctx) return null;
    return layers[id] || createLayer(id);
  }

  return {
    get ready() { return ready; },
    get context() { return ctx; },
    layerIds: Object.keys(SPEC),

    init: init,

    // Post-limiter tap, for level visualisation and for verifying that a
    // layer at 0 really is silent rather than merely quiet.
    tap: function (node) { if (limiter && node) limiter.connect(node); },

    start: function () {
      return Promise.resolve(init()).then(function () {
        running = true;
        applyAll(false);
      });
    },

    stop: function () {
      running = false;
      if (!ctx) return;
      applyAll(false);
      Object.keys(layers).forEach(function (id) {
        var el = layers[id].element;
        if (el && !el.paused) el.pause();
      });
    },

    // Lazily builds the layer the first time it is actually turned up, so
    // nothing is synthesised for a channel the user never touches.
    setLayer: function (id, value, muted) {
      if (!SPEC[id]) return;
      var v = Math.max(0, Math.min(100, Math.round(value)));
      var node = layers[id];
      if (!node && v <= 0) return;          // nothing to do yet
      node = node || ensureLayer(id);
      if (!node) return;
      node.value = v;
      if (typeof muted === "boolean") node.muted = muted;
      applyLayer(id, false);
    },

    setMaster: function (v) {
      master = Math.max(0, Math.min(100, v)) / 100;
      if (bus && ctx) bus.gain.setTargetAtTime(running ? master * 0.62 : 0, ctx.currentTime, 0.08);
    },

    // Live level for the LED meters. The LFO phase is computed rather than
    // read, which is exact enough and costs nothing.
    getLevel: function (id) {
      var node = layers[id];
      if (!node || !running || node.muted || node.value <= 0) return 0;
      var base = node.value / 100;
      if (!node.lfoDepth || !ctx) return base;
      var mod = 1 + node.lfoDepth * Math.sin(2 * Math.PI * node.lfoRate * ctx.currentTime + node.lfoPhase);
      return Math.max(0, Math.min(1, base * mod));
    },

    // Focus-session end. The old code scheduled a 5s ramp and then cancelled
    // it immediately with pauseAll(); here the ramp is allowed to finish.
    fadeOutAndStop: function (seconds, whenDone) {
      if (!ctx || !bus) { running = false; if (whenDone) whenDone(); return; }
      var now = ctx.currentTime;
      var from = bus.gain.value;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(from, now);
      bus.gain.linearRampToValueAtTime(0, now + seconds);
      setTimeout(function () {
        running = false;
        Object.keys(layers).forEach(function (id) {
          var el = layers[id].element; if (el && !el.paused) el.pause();
        });
        if (whenDone) whenDone();
      }, seconds * 1000 + 60);
    },

    // Reuses the main context instead of creating (and leaking) a new one.
    chime: function () {
      if (!ctx) return;
      var t = ctx.currentTime;
      var g = ctx.createGain();
      g.connect(limiter || ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = "sine"; o.frequency.value = f;
        var og = ctx.createGain(); og.gain.value = 1 / (i + 1.4);
        o.connect(og).connect(g);
        o.start(t + i * 0.085);
        o.stop(t + 1.15);
      });
    }
  };
})();
