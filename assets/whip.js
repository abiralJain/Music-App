/* ============================================================
   WhipFX — a real whip, simulated
   ------------------------------------------------------------
   The volume gesture used to be three hand-drawn sprite frames,
   which read as a flag rather than a whip. This is the technique
   OpenWhip uses (github.com/GitFrog1111/OpenWhip): a Verlet rope
   under distance constraints, drawn as a Catmull-Rom spline.

   Why it looks right: a whip cracks because the handle is yanked
   BACK while the rope is still travelling forward. Momentum runs
   down the tapering links until the tip exceeds the speed of the
   rest of the rope. So the handle here follows a scripted flick-
   and-yank path and the rope is never posed — every frame of the
   lash falls out of the physics, including the crack.

   Nothing here owns app state: the volume has already changed by
   the time this draws. If rAF never runs (hidden tab), the app is
   simply not animated, which is the correct failure.
   ============================================================ */

window.WhipFX = (function () {
  "use strict";

  var SEG = 26;            // rope links
  var ITER = 16;           // constraint relaxation passes per frame
  var GRAVITY = 0.14;
  var DAMPING = 0.982;
  var STRETCH_CAP = 1.22;  // per-link, stops rubber-band spikes on the yank
  var DUR = 1150;          // ms, whole gesture — slow enough to watch
  var CRACK_SPEED = 26;    // px/frame at the tip

  /* ---------- the character ----------
     If assets/whip-hero.png exists it is drawn at the handle, wielding the
     rope. The app never ships this file: it is the user's own image, dropped
     into assets/ by hand. Missing file = rope alone, silently.
     HERO_H is the drawn height; HERO_ANCHOR is where the hand is, as
     fractions of the drawn image (tune per image). */
  var HERO_H = 210;
  var HERO_ANCHOR = { x: 0.30, y: 0.42 };
  // Which way the SOURCE image faces. The lash from the right shows the
  // character facing left into the scene, so a left-facing image is drawn
  // as-is there and mirrored on the other side.
  var HERO_FACES = "left";
  var hero = null, heroReady = false;

  function loadHero() {
    if (hero) return;
    hero = new Image();
    hero.onload = function () { heroReady = hero.naturalWidth > 0; };
    hero.onerror = function () { heroReady = false; };
    hero.src = "assets/whip-hero.png";
  }

  var cv = null, ctx = null, raf = null;
  var W = 0, H = 0, dpr = 1;
  var pts = [], lens = [], sparks = [];
  var path = null, tint = "#FFC24A", t0 = 0, cracked = false, live = false;
  var onCrack = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function ensure() {
    if (cv) return true;
    var host = document.getElementById("world");
    if (!host) return false;
    cv = document.createElement("canvas");
    cv.className = "whip-canvas";
    cv.setAttribute("aria-hidden", "true");
    host.appendChild(cv);
    loadHero();
    ctx = cv.getContext("2d");
    size();
    window.addEventListener("resize", size);
    return true;
  }

  function size() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ease(t, p) { return 1 - Math.pow(1 - t, p); }

  /* The handle's scripted path. `a` is off-screen at the side, `b` brings it
     well INSIDE the frame so the lash crosses real estate, `c` yanks it back
     out. The rope is told nothing about any of them.

     The handle deliberately does not chase the tap's x: a whip anchored a few
     pixels from the pointer is a stub. The tap sets the HEIGHT of the crack;
     the sweep is always the same generous arc in from the side. */
  function pathFor(dir, tx, ty) {
    var edge = dir > 0 ? W : 0;
    var s = dir > 0 ? 1 : -1;
    var into = Math.max(300, Math.min(W * 0.56, 560));
    return {
      s: s,
      // Every one of these stays inside the frame. An earlier version parked
      // the handle off-screen, which was honest to how a whip arrives and
      // useless to look at: the rope only reached the picture as the whole
      // thing was already fading out.
      a: { x: edge - s * 90,   y: Math.min(H - 30, ty + 120) },
      b: { x: edge - s * into, y: Math.max(30, ty - 80) },
      c: { x: edge - s * 60,   y: Math.min(H - 30, ty + 100) }
    };
  }

  function ropeLength() {
    return Math.max(320, Math.min(W * 0.50, 560));
  }

  function handleAt(t) {
    var a = path.a, b = path.b, c = path.c, e;
    if (t < 0.32) {                      // the throw
      e = ease(t / 0.32, 3);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
    if (t < 0.45) return { x: b.x, y: b.y };          // the beat before the snap
    e = Math.min(1, (t - 0.45) / 0.30);
    e = e * e;                                        // yank back, accelerating
    return { x: b.x + (c.x - b.x) * e, y: b.y + (c.y - b.y) * e };
  }

  function build(dir, tx, ty) {
    path = pathFor(dir, tx, ty);
    var h = path.a;
    var total = ropeLength();

    pts = []; lens = [];
    // Links taper toward the tip — the taper is what makes the tip outrun
    // the rope rather than the whole rope moving at one speed.
    var raw = [], sum = 0;
    for (var i = 0; i < SEG; i++) {
      var f = 1 - 0.42 * (i / (SEG - 1));
      raw.push(f); sum += f;
    }
    for (i = 0; i < SEG; i++) lens.push(total * raw[i] / sum);

    // Lay the rope out trailing off-screen behind the handle, so the first
    // frame is a whip being brought in rather than a knot appearing.
    var x = h.x, y = h.y;
    pts.push({ x: x, y: y, px: x, py: y });
    for (i = 0; i < SEG; i++) {
      x += path.s * lens[i] * 0.20;
      y -= lens[i] * 0.95;
      pts.push({ x: x, y: y, px: x, py: y });
    }
    sparks = [];
    cracked = false;
  }

  function step(hx, hy) {
    var i, p;
    for (i = 1; i < pts.length; i++) {
      p = pts[i];
      var vx = (p.x - p.px) * DAMPING;
      var vy = (p.y - p.py) * DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + GRAVITY;
    }
    pts[0].px = pts[0].x; pts[0].py = pts[0].y;
    pts[0].x = hx; pts[0].y = hy;

    for (var k = 0; k < ITER; k++) {
      pts[0].x = hx; pts[0].y = hy;              // the handle is pinned
      for (i = 0; i < lens.length; i++) {
        var A = pts[i], B = pts[i + 1], L = lens[i];
        var dx = B.x - A.x, dy = B.y - A.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        // Cap stretch before solving, or a fast yank flings the tip.
        var target = Math.min(d, L * STRETCH_CAP);
        var diff = (target - L) / d;
        var ox = dx * 0.5 * diff, oy = dy * 0.5 * diff;
        if (i === 0) { B.x -= ox * 2; B.y -= oy * 2; }
        else { A.x += ox; A.y += oy; B.x -= ox; B.y -= oy; }
      }
    }
  }

  function tipSpeed() {
    var p = pts[pts.length - 1];
    var dx = p.x - p.px, dy = p.y - p.py;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function burst(x, y) {
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 2 + Math.random() * 6;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4,
                    r: 1 + Math.random() * 2, life: 1,
                    decay: 0.02 + Math.random() * 0.03 });
    }
  }

  function drawSparks(alpha) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life) * alpha;
      ctx.fillStyle = tint;
      var s = Math.max(1, Math.round(p.r * p.life * 2));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Catmull-Rom through the points, emitted as cubic Béziers.
  function tracePath() {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i > 0 ? i - 1 : 0];
      var p1 = pts[i], p2 = pts[i + 1];
      var p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y);
    }
  }

  function drawHero(alpha) {
    if (!heroReady) return;
    var h = pts[0];
    var scale = HERO_H / hero.naturalHeight;
    var w = hero.naturalWidth * scale;
    // The rope is pinned at the hand; the image hangs off that point.
    var ax = HERO_ANCHOR.x * w, ay = HERO_ANCHOR.y * HERO_H;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(8,14,22,.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    // From the right the character must face left into the scene, and the
    // reverse on the left — mirror whenever the entrance disagrees with the
    // image's own facing.
    var mirror = (path.s > 0) === (HERO_FACES !== "left");
    if (mirror) {
      ctx.translate(h.x, h.y);
      ctx.scale(-1, 1);
      ctx.drawImage(hero, -ax, -ay, w, HERO_H);
    } else {
      ctx.drawImage(hero, h.x - ax, h.y - ay, w, HERO_H);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw(alpha, flash) {
    ctx.clearRect(0, 0, W, H);
    drawHero(alpha);

    // Halo first, then the dark core over it: the rope has to stay legible
    // over a bright painting and a night scene alike.
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = alpha * 0.34;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 13;
    tracePath(); ctx.stroke();

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 6.5;
    tracePath(); ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(10,16,26,.94)";
    ctx.lineWidth = 3.4;
    tracePath(); ctx.stroke();

    // A lit tip, so the eye follows the fast end.
    var tip = pts[pts.length - 1];
    ctx.fillStyle = "#FFFFFF";
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 3.4, 0, 6.283); ctx.fill();

    if (flash > 0) {
      ctx.globalAlpha = flash * 0.75;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 10 + (1 - flash) * 26, 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawSparks(alpha);
  }

  var crackAt = 0;

  function frame(now) {
    if (!live) return;
    var t = (now - t0) / DUR;
    if (t >= 1 && !sparks.length) { stop(); return; }
    raf = requestAnimationFrame(frame);
    if (t > 1) { draw(0, 0); return; }

    var h = handleAt(t);
    step(h.x, h.y);

    // The crack is not scheduled: it is whenever the tip actually outruns
    // the rope, which only happens on the yank-back.
    if (!cracked && t > 0.45 && tipSpeed() > CRACK_SPEED) {
      cracked = true;
      crackAt = now;
      var tip = pts[pts.length - 1];
      burst(tip.x, tip.y);
      if (window.UISound) UISound.play("crack");
      if (onCrack) { try { onCrack(); } catch (e) {} }
    }
    var flash = cracked ? Math.max(0, 1 - (now - crackAt) / 260) : 0;
    var alpha = t < 0.06 ? t / 0.06 : (t > 0.86 ? Math.max(0, (1 - t) / 0.14) : 1);
    draw(alpha, flash);
  }

  function stop() {
    live = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  return {
    /* dir: +1 lashes in from the right, -1 from the left.
       (x, y) is where the user tapped; the whip is aimed through it. */
    crack: function (dir, x, y, color, cb) {
      if (!ensure()) return;
      if (reduce.matches) return;          // no rope, no sparks — the readout still speaks
      tint = color || "#FFC24A";
      onCrack = cb || null;
      size();
      build(dir, x, y);
      stop();
      live = true;
      t0 = performance.now();
      if (window.UISound) UISound.play("lash");
      raf = requestAnimationFrame(frame);
    },
    stop: stop
  };
})();
