/* Dream Worlds — the physical-object layer.

   Everything draggable in this app goes through here, so that a token, a shade
   and anything added later all behave like the same material.

   The numbers come from studying two references frame by frame rather than from
   taste:

   - Cards in the Juli.so clip sit at a *stable* angle through the whole drag —
     a fan at roughly -8, -5, +2 degrees — not a wobble derived from velocity.
     So tilt is assigned once per object and held.
   - The airplane-window clip binds the page's whole lightness to the shade's
     position, updating every frame of the gesture. That is the important one:
     the world responds *during* the drag, never on release. `onMove` is called
     on every pointermove for exactly that reason.
   - Released below threshold, that shade springs back rather than snapping.

   Transform only, one rAF per frame, pointer capture so the gesture survives
   leaving the element. Under reduced motion the lift and the tilt go away and
   the spring becomes an instant set — but the continuous binding stays, because
   the gesture is the control, not decoration.                                */

window.Grabbable = (function () {
  "use strict";

  // A slight overshoot on settle. This is the curve Vercel ships as
  // --ds-motion-timing-swift and Benji Taylor ships as --ease-snappy; two teams
  // landing on the same bezier independently is a good sign it is right.
  var SETTLE = "cubic-bezier(.175, .885, .32, 1.1)";
  var SETTLE_MS = 450;
  var LIFT_MS = 140;
  var FLICK_PX_PER_MS = 0.11;   // Sonner's threshold, arrived at by trial and error
  var RUBBER = 0.55;            // UIScrollView's rubber-band constant

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Resistance past an edge: the further you push, the less it gives.
  function rubber(over, dimension) {
    if (over <= 0 || dimension <= 0) return 0;
    return (1 - 1 / ((over * RUBBER / dimension) + 1)) * dimension;
  }

  function clampWithGive(v, min, max, give) {
    if (v < min) return min - rubber(min - v, give);
    if (v > max) return max + rubber(v - max, give);
    return v;
  }

  /* opts:
       el        the element to move
       tilt      degrees held for the whole drag (assigned by the caller)
       bounds()  -> {minX,maxX,minY,maxY} in page coordinates
       onGrab(s) onMove(s) onDrop(s, flicked)   s = {x,y,px,py,vx,vy,dx,dy}
       lift      false to skip the scale/shadow (for things already raised)   */
  function make(el, opts) {
    opts = opts || {};
    var st = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dx: 0, dy: 0, dragging: false };
    var startX = 0, startY = 0, originX = 0, originY = 0;
    var lastT = 0, frame = null, pending = false;
    var tilt = opts.tilt || 0;

    function paint() {
      pending = false;
      var lifted = st.dragging && !reduce.matches;
      el.style.transform =
        "translate3d(" + st.x + "px," + st.y + "px,0)" +
        (lifted ? " rotate(" + tilt + "deg) scale(1.045)" : "");
    }
    function schedule() {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(paint);
    }

    function down(e) {
      if (e.button !== undefined && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      st.dragging = true;
      startX = e.clientX; startY = e.clientY;
      originX = st.x; originY = st.y;
      st.px = e.clientX; st.py = e.clientY;
      st.vx = st.vy = st.dx = st.dy = 0;
      lastT = e.timeStamp;
      // No transition while the finger is down: the element must track the
      // pointer exactly, or it feels like it is on a rubber band to the cursor.
      el.style.transition = "none";
      el.classList.add("is-grabbed");
      if (opts.onGrab) opts.onGrab(st);
      schedule();
      e.preventDefault();
    }

    function move(e) {
      if (!st.dragging) return;
      var dt = Math.max(1, e.timeStamp - lastT);
      st.vx = (e.clientX - st.px) / dt;
      st.vy = (e.clientY - st.py) / dt;
      st.px = e.clientX; st.py = e.clientY;
      lastT = e.timeStamp;

      var nx = originX + (e.clientX - startX);
      var ny = originY + (e.clientY - startY);
      if (opts.bounds) {
        var b = opts.bounds();
        nx = clampWithGive(nx, b.minX, b.maxX, 90);
        ny = clampWithGive(ny, b.minY, b.maxY, 90);
      }
      st.dx = nx - originX; st.dy = ny - originY;
      st.x = nx; st.y = ny;
      // Every frame, not on release. This is what makes the world feel attached
      // to your hand rather than to a button you pressed.
      if (opts.onMove) opts.onMove(st);
      // Written synchronously, not batched into rAF. We only ever WRITE a
      // transform here — there is no layout read to thrash against, so batching
      // buys nothing and costs correctness: pointermove already arrives at
      // display rate, and rAF is throttled to zero in a background tab, which is
      // exactly where this app is designed to live. Deferring meant the token
      // stopped following the pointer while the audio kept responding.
      paint();
    }

    function up(e) {
      if (!st.dragging) return;
      st.dragging = false;
      el.classList.remove("is-grabbed");
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      var speed = Math.max(Math.abs(st.vx), Math.abs(st.vy));
      var flicked = speed > FLICK_PX_PER_MS;
      if (opts.onDrop) opts.onDrop(st, flicked);
      settle();
    }

    // Spring the element to wherever st.x/st.y now say it should be. The caller
    // is free to have moved them in onDrop (to snap, or to send it home).
    function settle() {
      if (reduce.matches) { el.style.transition = "none"; paint(); return; }
      el.style.transition = "transform " + SETTLE_MS + "ms " + SETTLE;
      paint();
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.style.touchAction = "none";

    return {
      state: st,
      setTilt: function (d) { tilt = d; },
      // Move it without a gesture — used by the keyboard path, which must reach
      // every position a pointer can.
      moveTo: function (x, y, animate) {
        st.x = x; st.y = y;
        if (animate === false || reduce.matches) { el.style.transition = "none"; paint(); }
        else settle();
        if (opts.onMove) opts.onMove(st);
      },
      destroy: function () {
        cancelAnimationFrame(frame);
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      }
    };
  }

  return {
    make: make,
    LIFT_MS: LIFT_MS,
    SETTLE_MS: SETTLE_MS,
    SETTLE: SETTLE,
    // Stable per-object angles. Assigned from an index rather than randomly so a
    // token sits at the same angle every session — the reference's fan is a
    // fixed arrangement, not noise.
    tiltFor: function (i) {
      var FAN = [-7, -4, 2, -5, 3, -2, -6, 1, -3, 5, -1, 4];
      return FAN[i % FAN.length];
    }
  };
})();
