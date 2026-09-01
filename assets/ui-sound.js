/* Dream Worlds — interface sound.

   Every sound here is synthesised at play time. Nothing is fetched, nothing is
   decoded, and the whole file is smaller than the shortest click you could ship
   as an asset. That matters twice over: an interface sound has to land inside
   the same frame as the press, and a download that has not finished cannot.

   Three rules the recipes below are built around:

   1. Ramp, never set. Assigning gain.value produces a discontinuity, and a
      discontinuity in a waveform is itself a click — you get a pop stapled to
      the front of every sound. Everything uses ramps against ctx.currentTime.
   2. Vary the pitch. A control you press forty times a minute with a fixed
      pitch turns into a smoke alarm. Every voice detunes by a few percent.
   3. Stay out of the way of the music. UI sound sits in a narrow band well
      above the ambience bed and lasts under 150ms, so it reads as a click
      rather than as a note, and never has to be loud to be heard.

   The AudioContext is shared with AmbienceEngine when there is one, so the two
   never fight over the single context a browser will give a page.          */

window.UISound = (function () {
  "use strict";

  var ctx = null, bus = null, noiseBuf = null, shaper = null;
  var enabled = true, unlocked = false;
  var lastAt = 0;

  // A soft saturation curve. Square waves through a little drive is most of
  // what makes a sound read as "small machine" rather than "sine beep".
  function crushCurve(amount) {
    var n = 1024, curve = new Float32Array(n), k = amount;
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // Reuse the ambience context if it has one, so the page only ever holds one.
    // AmbienceEngine.context is a getter, not a call. A page gets a limited
    // number of AudioContexts, so share whichever one already exists.
    ctx = (window.AmbienceEngine && window.AmbienceEngine.context) || new AC();

    shaper = ctx.createWaveShaper();
    shaper.curve = crushCurve(2.4);
    shaper.oversample = "2x";

    bus = ctx.createGain();
    bus.gain.value = 0.42;

    // Nothing below 180Hz: that is where the ambience bed and any music live,
    // and a UI click has no business there. Carving it out is what lets these
    // sit quietly and still cut through.
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;

    shaper.connect(bus);
    bus.connect(hp);
    hp.connect(ctx.destination);
    return ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var n = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // One oscillator voice with an exponential decay. `slide` sweeps the pitch,
  // which is the difference between a blip and a chirp.
  function tone(o) {
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || "square";

    var detune = 1 + (Math.random() * 2 - 1) * (o.vary === undefined ? 0.03 : o.vary);
    var f0 = o.freq * detune;
    osc.frequency.setValueAtTime(f0, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.slide * detune), t0 + o.dur);

    var peak = Math.max(0.0001, o.gain === undefined ? 0.22 : o.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(g);
    g.connect(o.clean ? bus : shaper);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  // Filtered noise burst — the body of every click, thunk and whoosh.
  function hiss(o) {
    var t0 = ctx.currentTime + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noise();
    src.playbackRate.value = o.rate || 1;

    var f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.slide), t0 + o.dur);
    f.Q.value = o.q || 1.1;

    var g = ctx.createGain();
    var peak = Math.max(0.0001, o.gain === undefined ? 0.14 : o.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  /* The cookbook. Each entry is deliberately under ~180ms — anything longer
     stops being feedback and starts being a jingle you have to sit through. */
  var SFX = {
    // A wooden key. Hyoshigi register: a bright, hard contact and a short
    // hollow body — wood on wood, not metal on metal.
    // Softened 2026-09: the old voicing read as a clack forty times a minute.
    // Lower band, lower gain — a felt pad, not a switch.
    press:    function () { hiss({ freq: 1500, slide: 1050, dur: 0.028, q: 2.2, gain: 0.09 });
                            tone({ freq: 560, slide: 430, dur: 0.04, gain: 0.05, type: "triangle" }); },
    // Hover is the quietest thing here on purpose; it fires constantly.
    hover:    function () { hiss({ freq: 5200, dur: 0.022, q: 2.2, gain: 0.035 }); },
    // Rising minor third: something switched on.
    on:       function () { tone({ freq: 520, dur: 0.07, gain: 0.13 });
                            tone({ freq: 780, dur: 0.1,  gain: 0.13, delay: 0.055 }); },
    // The same interval falling.
    off:      function () { tone({ freq: 700, dur: 0.07, gain: 0.12 });
                            tone({ freq: 440, dur: 0.1,  gain: 0.12, delay: 0.055 }); },
    // Window opening: a short upward sweep with air behind it.
    open:     function () { hiss({ freq: 700, slide: 3200, dur: 0.14, q: 0.7, gain: 0.09 });
                            tone({ freq: 380, slide: 720, dur: 0.12, gain: 0.09 }); },
    close:    function () { hiss({ freq: 3000, slide: 500, dur: 0.11, q: 0.7, gain: 0.08 });
                            tone({ freq: 660, slide: 300, dur: 0.1,  gain: 0.09 }); },
    // Fires on every fader step, so it is nearly nothing — a detent, not a note.
    tick:     function () { hiss({ freq: 3400, dur: 0.013, q: 3.2, gain: 0.03 }); },
    // A physical clunk: low, short, no pitch to speak of.
    mute:     function () { hiss({ freq: 420, filter: "lowpass", dur: 0.07, q: 0.6, gain: 0.2 }); },
    // Paper landing on paper — the token drop. A soft low push of air with a
    // dry tap on top, and no ring at all.
    thump:    function () { hiss({ freq: 240, filter: "lowpass", dur: 0.09, q: 0.5, gain: 0.24, attack: 0.004 });
                            hiss({ freq: 1500, dur: 0.018, q: 2.0, gain: 0.06 });
                            tone({ freq: 95, slide: 60, dur: 0.08, gain: 0.1, type: "sine", clean: true }); },
    // Scene change gets the one flourish in the set, and it is still 200ms.
    scene:    function () { tone({ freq: 620, dur: 0.09, gain: 0.1, type: "triangle" });
                            tone({ freq: 930, dur: 0.09, gain: 0.09, type: "triangle", delay: 0.06 });
                            tone({ freq: 1240, dur: 0.14, gain: 0.08, type: "triangle", delay: 0.12 }); },
    // Two flat notes. Errors should sound like a shrug, not an alarm.
    error:    function () { tone({ freq: 200, dur: 0.1,  gain: 0.16 });
                            tone({ freq: 150, dur: 0.16, gain: 0.16, delay: 0.09 }); },
    // The slot machine's own voices — it must not reuse the fader sounds.
    // reel: a low wooden ratchet, one click per notch.
    reel:     function () { hiss({ freq: 700, dur: 0.02, q: 2.0, gain: 0.045 });
                            tone({ freq: 300, slide: 240, dur: 0.02, gain: 0.03, type: "triangle" }); },
    // stop: a reel landing — brighter and shorter than the token thump.
    stop:     function () { hiss({ freq: 320, filter: "lowpass", dur: 0.06, q: 0.6, gain: 0.2, attack: 0.003 });
                            hiss({ freq: 2100, dur: 0.014, q: 2.2, gain: 0.06 }); },
    // win: the landing moment. Three rising pentatonic notes — the one
    // little jingle in the app, and it is earned.
    win:      function () { [523.25, 659.25, 783.99].forEach(function (f, i) {
                              tone({ freq: f, dur: 0.16 + i * 0.06, gain: 0.09,
                                     type: "triangle", clean: true, vary: 0.004,
                                     delay: i * 0.09, attack: 0.008 });
                            }); },
    // The whip. lash is air being moved; crack is the one loud sound in the
    // whole interface — a snap, a low body, and a short breath of tail.
    lash:     function () { hiss({ freq: 350, slide: 2400, dur: 0.3, q: 0.8, gain: 0.1, attack: 0.03 }); },
    crack:    function () { hiss({ freq: 2600, filter: "highpass", dur: 0.035, q: 0.7, gain: 0.5, attack: 0.001 });
                            tone({ freq: 110, slide: 55, dur: 0.12, gain: 0.22, type: "sine", clean: true, attack: 0.002 });
                            hiss({ freq: 1400, dur: 0.16, q: 0.6, gain: 0.08, delay: 0.03 }); },
    // The boot chime. The only sound allowed to be a chord.
    boot:     function () { [392, 523.25, 659.25, 784].forEach(function (f, i) {
                              tone({ freq: f, dur: 0.5 + i * 0.1, gain: 0.075,
                                     type: "triangle", clean: true, vary: 0.002,
                                     delay: i * 0.075, attack: 0.02 });
                            });
                            hiss({ freq: 900, slide: 4000, dur: 0.35, q: 0.6, gain: 0.05 }); }
  };

  return {
    // Must be called from inside a real user gesture or the context stays
    // suspended and every later sound is silently dropped.
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      unlocked = true;
    },
    setEnabled: function (on) { enabled = Boolean(on); },
    enabled: function () { return enabled; },
    play: function (name) {
      if (!enabled || !unlocked) return;
      if (!ensure() || ctx.state !== "running") return;
      var fn = SFX[name];
      if (!fn) return;
      // Two identical sounds inside 30ms sum into one louder sound rather than
      // reading as two events, so the second is dropped.
      var now = ctx.currentTime;
      if (name !== "boot" && now - lastAt < 0.03) return;
      lastAt = now;
      try { fn(); } catch (e) {}
    }
  };
})();
