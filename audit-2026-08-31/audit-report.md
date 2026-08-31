# UKIYO full audit — 2026-08-31

Live-driven audit (local server + browser automation) at desktop 1440×900, tablet 768×1024,
mobile 375×812, in the day and night palettes, from a cleared localStorage state.
Static analysis of styles.css/app.js/index.html backs every measured claim.

Severity: **S1** breaks a core flow · **S2** materially hurts usability/legibility · **S3** polish.

## S1 — broken flows

1. **Mobile: the primary controls are unreachable when the dock is idle.**
   `.dock-idle .control-dock { transform: translateY(calc(100% - 18px)) }` (styles.css:613)
   leaves an 18px peek strip. On ≤640px the dock folds to two rows (~139px tall), so the
   "peek" slices through the middle of the LCD row — measured: play/scene/room/focus/more all
   sat at y 859–906 in an 812px viewport. Touch devices have no hover to summon the dock back.
   Fix: never idle-hide the dock on `(hover: none)` devices; on desktop keep the slide but with
   a clean edge (and no opacity fade — see S2.4).

2. **Day/dusk mode: every element without its own `color` declaration renders night ink.**
   `body { color: var(--bone) }` resolves at `:root` (night `#E9F2FA`); descendants inherit the
   *resolved* color, so inside day-flipped surfaces the headings and titles stay pale blue on
   cream — measured 1.16:1. Hits: every `.panel-head h2` ("SCENE SELECTOR", "MIXER"…),
   `.world-card-copy strong` (all scene titles), `#dockWorldTitle`, preset/station titles.
   Fix: re-declare `color: var(--bone)` on the mode-scoped chrome surfaces so the variable
   re-resolves inside them.

3. **Tuning a source breaks the scene lock and switches the user's scene.**
   Hand-picked Rain Window (toast confirmed, `sceneLocked=true`), then tuned "Ghibli piano for
   sleep" → scene jumped to Evening Snow and `sceneLocked` read `false` — while the tuner copy
   promises "Your scene and room stay put." The lock is being reset on tune.

## S2 — usability / legibility

1. **Room mixer layout (the user's complaint).** On a 1440px screen the panel is a 400px
   column with **two nested scroll wells**: presets scroll inside 306px, and all 12 channels +
   weather + sway scroll separately inside 282px. The mix is never visible as a whole; presets
   permanently occupy the top half. On mobile the preset list becomes a horizontal carousel of
   near-viewport-width cards — the disabled "Your saved mix" card fills the screen with empty
   plate. Weather row 2 (petals/leaves/fireflies/embers) clips: icons overlap labels at the
   desktop panel width.
   Fix: widen the desktop panel for the room (two real columns: presets rail + channel grid),
   one scroll region; compact preset cards on mobile; give weather segments room (3-col rows or
   icon-above-label).

2. **Token chips (12 sound controls on the artwork).** In day/dusk the chip plate flips to
   cream while the 12 tint colors stay pastel: value text measured 1.11–2.34:1 (worst: soft
   1.11). Idle state drops chips to `opacity:.28` (~2:1, unreadable) and the resting default
   row overlaps chip-on-chip at tablet widths. In quiet mode the ghost chips (and the shade
   grip) stay on the painting even though all other chrome hides.
   Fix: pin the chips to the dark LCD treatment in every mode (mirrors `.now-key`); idle =
   collapse to icon at full opacity instead of fading; hide tokens + shade grip in quiet mode;
   lift the two failing tints (brown, thunder) for the dark plate.

3. **Boot screen.** "PRESS ANY KEY TO START" at 45% bone measured 2.42:1 in day and it blinks
   to lower still; the "today · … — press T" line wraps its final letter onto its own line;
   `role="status"` + per-frame percent writes make it a screen-reader firehose; nothing
   focusable ("press any key" with no button); background app is tabbable behind the overlay.

4. **Dock idle fade** (`opacity:.48`) puts 11px labels at 4.2:1 (night) / 2.7:1 (day). The
   translateY already hides the dock — the fade only creates an illegible in-between state.

5. **Scrubber is nested inside the tuner button** (`index.html:368` inside `#musicButton`):
   invalid HTML, and every seek also opens the tuner panel. Un-nest.

6. **More-menu:** `kbd` hint chips clip outside the right edge of the menu; the "Art library"
   row wraps and its value ("FLOATING WORLD") collides with the label. Menu needs a wider
   min-width and a two-column row grid that truncates values instead of overlapping.

7. **Quiet mode keeps ~12 invisible tab stops** — `toggleQuiet()` never inerts the dock
   (`opacity:0; pointer-events:none` only).

8. **Contrast tokens (measured against the darkest surface each mode actually paints):**
   dusk muted 3.4–4.3:1 and dusk amber 3.5–4.4:1 fail AA everywhere; day amber/muted fail on
   the selected-state plates (4.0–4.3:1). Selected-state borders (`--amber-dim` at .28 alpha)
   measure 1.5–2.0:1 vs the 3:1 UI bar. Disabled reasons ("Save a mix to enable") at 2.2:1.
   The day/dusk `--face` literal overrides also orphan `--panel-lo`, so the stylesheet's own
   documented ratios are measured against surfaces that never render.

9. **Scene grid cards:** kind labels say "ghibli still" for Hiroshige/Hokusai woodblock
   prints; day-mode titles invisible (S1.2); several thumbs carry a baked-in grey band.

## S3 — polish / hygiene

1. `--fs-micro: 11px` used ~24 places live; 10px at `.token-copy strong` and the ≤560px
   weather grid (which renders the 8px-grid bitmap face at 10px — off-grid). Raise to 12px,
   move the small weather grid to the mono face.
2. Focus ring is single-tone amber: over bright artwork it measures down to 1.6:1. Use the
   two-tone chassis+amber ring the shade grip already has.
3. Sub-44px targets: `.mute` 32×32 (×12), `.hw-sm` 32, inline 32/36px overrides on the two
   close buttons; prev/next 36px at ≤640px. (All pass the 24px AA minimum; this is AAA polish.)
4. No `forced-colors` / `prefers-contrast` handling; the bevel-only chrome vanishes in
   Windows High Contrast.
5. Silkscreen loads from the Google Fonts CDN while every other face is self-hosted; offline
   the entire pixel chrome falls back to Courier New.
6. Dead CSS: `.crossfading .scene-video`; 11px declarations overridden by the 16px Silkscreen
   block; `.readout::before` pair (defined, then display:none'd). Stale measured-ratio comments
   at styles.css:5-10, 156-158, 161-163, 181, 234 (day amber claimed 7.2:1, actual 4.9:1 on
   real surfaces; dusk amber claimed 8.9:1, actual 4.1:1).
7. Resize/orientation re-fit only runs while weather is active (`app.js:3266-3269` gates the
   only viewport hook on `weatherActive()`), so rotating a clear-sky phone never re-evaluates
   the mounted-print fit.
8. Scrub row shows at desktop too (`#scrubWrap.hidden=false` once a source is tuned) although
   the comment says it exists for ≤540px; harmless once un-nested, but decide intentionally.
9. Skip link targets `#controlDock` without `tabindex="-1"` (focus never actually moves).
10. Tablet: dock drops the scene *name* entirely (thumb only) — acceptable, but with the
    slideshow becoming the default there is no text telling you what you're looking at.

## Works correctly (verified)

Boot → app handoff; scene crossfades (still→still, still→video) with no black frame on a warm
cache; weather auto-arriving with a print and "· from the room" mapping (the Leaves highlight
that looked wrong is consistent behavior); token drag → value/pan mapping ("64% · left 30%");
focus popover; display cycling; YouTube tuning + playback + VU meter; followMusic mood matching
(the switch itself was correct — the lock it ignored is S1.3); panel Escape handling; gallery
channel; mounted-print treatment on portrait prints at desktop.

## Fix plan

S1 and S2 items are folded into the approved implementation plan (contrast re-ink, token
pinning, dock behavior, mixer relayout, scrubber un-nest, quiet-mode inert, boot rework),
followed by the headline font change, the film-slideshow default scene, and a final
cross-viewport verification pass. See `~/.claude/plans/federated-puzzling-blossom.md`.

---

## Resolution — same day

All S1 and S2 items were fixed and re-verified live (desktop 1440×900, tablet 768×1024,
mobile 375×812):

- **S1.1 mobile dock** — idle withdrawal now gated behind `@media (hover: hover)`; on touch
  screens the dock stays put (measured: dock bottom 792px inside an 812px viewport, all keys
  reachable). The desktop slide keeps a clean edge and no longer fades.
- **S1.2 day/dusk inherited night ink** — `color: var(--bone)` re-declared inside the
  mode-scoped chrome list; panel headings, card titles and the dock scene title now render
  the mode's own ink. Root-caused a second instance of the same class of bug: `--face` (and
  `--amber-dim`) substitute their var()s at `:root`, so the literal day/dusk overrides are
  load-bearing and now documented as such.
- **S1.3 scene lock** — the world-grid click was calling `setWorld(i)` with no `announce`
  argument, so a hand-picked scene never latched `sceneLocked`. Now passes `true`. Also:
  `followMusic` can no longer pull the app out of the film slideshow.
- **S2.1 mixer** — one scroll region, compact 2-up preset grid (all six + saved visible in
  ~230px), weather grid de-cluttered (labels only). The broken preset "carousel" CSS
  (flex-direction never reset; snap targeting the wrong children) was removed.
- **S2.2 tokens** — pinned to the dark LCD treatment in all modes; idle collapses to
  icon-at-full-opacity instead of fading to 28%; quiet mode hides and inerts tokens, shade
  and dock alike; two tints lifted for the dark plate; two-tone focus ring over artwork.
- **S2.3 boot** — dialog semantics, quarter-step progressbar, single polite status line,
  inert app behind the overlay, real skip button, readable skip line (color-blink).
- **S2.5 scrubber** — un-nested from the tuner button (`.now-key` is a div; `.now-open`
  button + sibling scrub). Verified: seeking no longer opens the tuner.
- **Contrast re-ink** — day/dusk `--muted`/`--amber`/`--rec-text`/`--amber-deep` re-derived
  against the darkest painted stop (all ≥4.5:1, table in styles.css header); `--amber-dim`
  raised to .62 for the 3:1 UI bar; `--ink-off` replaces disabled opacity; `--fs-micro`
  11→12px; forced-colors + prefers-contrast blocks added; Silkscreen self-hosted.

New since the audit (same session): editorial serif headlines (Shippori Mincho, self-hosted),
readout re-cut as a gallery placard with a scene-coloured accent rule, and the **film
slideshow** — 32 clips re-encoded (rotation baked, seamless wraps, posters, per-shape fit),
one Slideshow card in the selector, default scene for fresh visits, deterministic next-clip
prefetch (verified: next file buffered on the idle element before each advance), pause on
hidden tabs, per-clip tone driving the chrome and accent.
