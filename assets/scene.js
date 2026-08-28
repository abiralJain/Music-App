/* ============================================================
   PixelScene — renders the live scene as pixel art
   ------------------------------------------------------------
   The scene is drawn into a small canvas (~260px wide) and
   CSS-upscaled with image-rendering:pixelated, then a per-channel
   palette ramp is applied by a GPU SVG filter.

   Measured while prototyping:
     palette in a JS per-pixel loop   9.4 ms/frame  (20.5 ms peak)
     palette in a GPU SVG filter      0.6 ms/frame
   So there is deliberately NO getImageData here — the only per-frame
   work is two drawImage calls.

   Plain pixelation alone reads as a compression artifact, and
   per-channel posterizing produces rainbow speckle. A curated
   7-step ramp is what makes it read as deliberate pixel art.
   ============================================================ */

window.PixelScene = (function () {
  "use strict";

  var GRID = 260;          // source width in scene-pixels
  var FPS = 30;            // ample for an ambient loop, and halves the cost
  var FRAME_MS = 1000 / FPS;

  var cv = null, ctx = null, small = null, sctx = null;
  var artLayers = [], artIndex = 0;     // authored pixel art, shown natively
  var from = null, to = null, mix = 1;          // mix: 0 = from, 1 = to
  var fadeStart = 0, fadeMs = 0;
  var running = false, raf = null, lastDraw = 0;
  var gridW = GRID, gridH = 146;
  var ramp = "slate";
  var keepRunning = false;
  var fadeGuard = null;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Measure the canvas's own box, not the viewport: in a hidden tab or before
  // first layout the viewport is 0x0, which would make the grid a degenerate
  // square and distort the scene. Fall back to 16:9 until a real box exists.
  function sizeGrid() {
    var w = 0, h = 0;
    if (cv) { var r = cv.getBoundingClientRect(); w = r.width; h = r.height; }
    if (!w || !h) { w = window.innerWidth; h = window.innerHeight; }
    var aspect = (w && h) ? (h / w) : (9 / 16);
    var nextW = GRID, nextH = Math.max(2, Math.round(GRID * aspect));
    if (nextW === gridW && nextH === gridH && small && small.width === nextW) return false;
    gridW = nextW; gridH = nextH;
    if (small) { small.width = gridW; small.height = gridH; }
    if (cv) { cv.width = gridW; cv.height = gridH; }
    if (sctx) sctx.imageSmoothingEnabled = false;
    if (ctx) ctx.imageSmoothingEnabled = false;
    return true;
  }

  // Crop the source to fill the grid without distorting it — the canvas
  // matches the viewport aspect, so CSS 100%/100% is then correct.
  function coverRect(sw, sh) {
    if (!sw || !sh) return null;
    var sr = sw / sh, dr = gridW / gridH, w, h, x, y;
    if (sr > dr) { h = sh; w = sh * dr; x = (sw - w) / 2; y = 0; }
    else         { w = sw; h = sw / dr; x = 0; y = (sh - h) / 2; }
    return [x, y, w, h];
  }

  function paint(el, alpha) {
    if (!el) return false;
    var sw = el.videoWidth || el.naturalWidth || 0;
    var sh = el.videoHeight || el.naturalHeight || 0;
    if (!sw || !sh) return false;
    var r = coverRect(sw, sh);
    if (!r) return false;
    sctx.globalAlpha = alpha;
    try { sctx.drawImage(el, r[0], r[1], r[2], r[3], 0, 0, gridW, gridH); }
    catch (e) { return false; }
    sctx.globalAlpha = 1;
    return true;
  }

  // A <video> at readyState 4 that has never PRESENTED a frame draws nothing
  // to a canvas — ours are opacity:0 and may never have played, so the
  // compositor has no frame to hand over. drawImage returns silently, with no
  // error. A tiny seek forces a decode and presents one. Verified: 0 pixels
  // before, 42380 after.
  var primed = (typeof WeakSet === "function") ? new WeakSet() : null;

  function prime(el, done) {
    if (!el) { if (done) done(); return; }
    if (primed && primed.has(el)) { if (done) done(); return; }
    if (el.readyState < 2) {
      el.addEventListener("loadeddata", function () { prime(el, done); }, { once: true });
      return;
    }
    if (primed) primed.add(el);
    if (!el.paused) { if (done) done(); return; }   // playing elements present frames
    var settled = false;
    var finish = function () { if (settled) return; settled = true; if (done) done(); };
    el.addEventListener("seeked", finish, { once: true });
    try { if (el.currentTime < 0.05) el.currentTime = 0.05; else finish(); }
    catch (e) { finish(); return; }
    setTimeout(finish, 900);                        // never hang on a stalled seek
  }

  function drawFrame() {
    if (!sctx) return;
    sctx.clearRect(0, 0, gridW, gridH);
    var drew = false;
    if (mix < 1 && from) drew = paint(from, 1) || drew;
    if (to) drew = paint(to, mix < 1 ? mix : 1) || drew;
    if (!drew) return;
    ctx.clearRect(0, 0, gridW, gridH);
    ctx.drawImage(small, 0, 0);
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (fadeMs > 0) {
      var t = (now - fadeStart) / fadeMs;
      mix = t >= 1 ? 1 : t;
      if (mix >= 1) {
        fadeMs = 0; from = null;
        drawFrame();
        if (!keepRunning) { running = false; if (raf) cancelAnimationFrame(raf); raf = null; return; }
      }
    }
    if (now - lastDraw < FRAME_MS) return;    // cap to FPS
    lastDraw = now;
    drawFrame();
  }

  return {
    init: function (canvas) {
      cv = canvas;
      ctx = cv.getContext("2d");
      small = document.createElement("canvas");
      sctx = small.getContext("2d");
      sizeGrid();
      // Fires on 0 -> real layout too, which a resize listener alone misses.
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(function () { if (sizeGrid()) drawFrame(); }).observe(cv);
      }
      window.addEventListener("resize", function () { if (sizeGrid()) drawFrame(); });
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { sizeGrid(); drawFrame(); if (keepRunning) startLoop(); }
      });
      reduce.addEventListener("change", function () {
        if (reduce.matches) { this_stop(); drawFrame(); } else { startLoop(); }
      });
      function this_stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
      function startLoop() {
        if (running || reduce.matches) return;
        running = true; lastDraw = 0; raf = requestAnimationFrame(tick);
      }
      this._start = startLoop;
      this._stop = this_stop;
      return this;
    },

    setRamp: function (name) {
      // null = no ramp. Authored pixel art must not be re-quantised: the
      // artist already chose those colours.
      ramp = name || null;
      if (cv) cv.style.filter = ramp ? 'url("#ramp-' + ramp + '")' : "none";
    },

    // Authored pixel art (still or animated GIF) is shown as an <img> at its
    // OWN pixel scale rather than resampled onto the 260px ramp grid, which
    // would make finished pixel art shimmer.
    useArt: function (layers) { artLayers = layers || []; },

    showArt: function (src, label, ms) {
      if (!artLayers.length) return false;
      var incoming = artLayers[(artIndex + 1) % artLayers.length];
      var outgoing = artLayers[artIndex];
      var self = this;
      var swap = function () {
        artIndex = (artIndex + 1) % artLayers.length;
        incoming.classList.add("is-live");
        outgoing.classList.remove("is-live");
        if (cv) cv.classList.remove("is-live");
        self.setPlaying(false);          // no canvas loop needed for art
      };
      if (incoming.getAttribute("src") === src) { swap(); return true; }
      incoming.alt = label || "";
      var done = false;
      var go = function () { if (done) return; done = true; swap(); };
      incoming.addEventListener("load", go, { once: true });
      incoming.addEventListener("error", go, { once: true });
      incoming.setAttribute("src", src);
      setTimeout(go, 2500);
      return true;
    },

    // Back to a video channel: the canvas takes over again.
    showVideo: function () {
      artLayers.forEach(function (l) { l.classList.remove("is-live"); });
      if (cv) cv.classList.add("is-live");
    },

    get ramp() { return ramp; },

    // Show a source immediately (no fade).
    setSource: function (el) {
      from = null; to = el; mix = 1; fadeMs = 0;
      prime(el, drawFrame);
    },

    // Crossfade in pixel space, so the transition is made of the same
    // blocks as the scene rather than blending two smooth videos.
    crossfadeTo: function (el, ms) {
      if (!el || el === to) return;
      // rAF does not fire in a hidden tab, so an animated fade would never
      // advance and the canvas would keep a stale frame. A crossfade nobody
      // can see is pointless anyway — just swap.
      if (reduce.matches || !ms || document.hidden) { this.setSource(el); return; }
      var self = this;
      // Prime the incoming element first, or the fade would blend into blank.
      prime(el, function () {
        from = to; to = el; mix = 0;
        fadeStart = performance.now(); fadeMs = ms;
        drawFrame();
        if (self._start) self._start();
      });
      // Safety net: if rAF stalls mid-fade, land on the destination anyway.
      clearTimeout(fadeGuard);
      fadeGuard = setTimeout(function () {
        if (fadeMs > 0) { mix = 1; fadeMs = 0; from = null; drawFrame(); }
      }, ms + 1200);
    },

    // playing = the scene is moving, so the loop must run continuously
    setPlaying: function (on) {
      keepRunning = !!on;
      if (on) { if (this._start) this._start(); }
      else if (fadeMs === 0 && this._stop) { this._stop(); drawFrame(); }
    },

    start: function () { if (this._start) this._start(); },
    stop:  function () { if (this._stop) this._stop(); },

    // One frame, for reduced-motion and for painting before playback starts.
    redraw: function () { drawFrame(); },

    get grid() { return { w: gridW, h: gridH, fps: FPS }; },

    // Exposed for the verification harness.
    get debug() {
      return { gridW: gridW, gridH: gridH,
               smallW: small ? small.width : null, smallH: small ? small.height : null,
               cvW: cv ? cv.width : null, cvH: cv ? cv.height : null,
               mix: mix, hasFrom: !!from, hasTo: !!to,
               toId: to ? (to.id || to.tagName) : null,
               running: running, keepRunning: keepRunning, fadeMs: fadeMs };
    }
  };
})();
