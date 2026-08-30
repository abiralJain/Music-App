# UKIYO — a floating world machine

**Drag sounds onto a 160-year-old painting and hear them rain.**

Hiroshige and Hokusai painted the exact weather this machine renders — sudden
rain, evening snow, morning mist, fireflies. UKIYO puts their prints behind a
tabletop deck: twelve sounds you place *on the painting* (height is volume,
left is left), live weather falling across the print, a window shade that
pulls the whole world from day to night, and your own music tuned in from
YouTube. 浮世 — "the floating world" — is the genre's own name for itself.

## What it does

- **Sound tokens.** The twelve room layers are objects on the artwork. Drag
  one: its level and stereo pan follow your hand on every frame, and it lands
  with an ink ripple and a paper thump.
- **The prints bring their own sky.** Pick *Sudden Shower* and it arrives
  raining. Weather you choose by hand stays yours.
- **A window shade.** Pull it down and the scene dims while the chrome
  crossfades washi → dusk → indigo, bound live to the drag.
- **Rooms are shareable.** Copy a room link — anyone who opens it gets your
  exact arrangement, no backend. Or save a postcard: the print, the weather
  mid-fall, a cartouche with the room's name and a vermillion seal.
- **Today's pairing.** A date-seeded print + mix everyone gets in common.
  Press T on the boot screen.
- **Rare moments.** Some things only appear at certain hours, in certain
  weather. Nothing announces them. There are three.
- **A bonsai** grows from quiet minutes spent here. It never wilts and
  nothing punishes you.
- The console is part of the toy: `UKIYO.room()`, `UKIYO.postcard()`.

## Art

Two packs:

- **The floating world** (ships): 15 woodblock prints by Hiroshige, Hokusai
  and Chōki, public domain via the Met's Open Access program — fully
  publishable. See `assets/scenes/ukiyoe/CREDITS.txt`.
- **Ghibli** (personal option, in the more menu): Studio Ghibli's freely
  offered stills, personal use only. See `assets/scenes/ghibli/CREDITS.txt`.

Landscape prints bleed full-screen; a portrait print on a landscape screen is
*mounted* — shown whole on the paper ground with a blurred echo behind it —
because cover-cropping a Hiroshige is a crime with a CSS property.

## Run locally

Serve the folder over HTTP — YouTube needs a referring page for embedded
playback, and the self-hosted fonts need real HTTP headers:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

## The music source is yours

Open the tuner and paste any YouTube video or playlist link:

- A **playlist** becomes the track list, with working previous/next.
- A **single video** becomes one track, named from the video itself.

### Why the original Ghibli source stopped working

The app used to hardcode one video, `Q0AULj4UltI`. Probing YouTube's player
directly returns **error 150** for it, with `isPlayable: false` and
`errorCode: "auth"` — the uploader has switched off embedded playback. No
change on our side can undo that; it is a setting on someone else's video.

Worth knowing: YouTube's oEmbed endpoint returns **HTTP 200 and a valid
`<iframe>`** for that video, so oEmbed is not a usable embeddability check.
Only instantiating the real player tells the truth.

### What replaced it

Rather than swap one hardcoded ID for another and wait for the same rot, the
suggested station is now a **chain of verified stations**, each probed with the
real player before shipping:

| Station | Length |
| --- | --- |
| Ghibli piano for sleep | 1 h 55 m |
| The best of Ghibli piano | 1 h 21 m |
| Ghibli summer night piano | 7 h 18 m |

If the first is blocked, the app **silently advances to the next** — a single
uploader flipping a switch no longer takes the feature down. Only when every
station fails does the user see an error.

Failure is also specific now, mapped from YouTube's error codes:

| Code | What the app says |
| --- | --- |
| 101 / 150 | "The uploader blocked embedded playback" |
| 100 | "That video is gone" |
| 2 | "That video ID is not valid" |
| 5 | "The player could not start" |

Any blocked source still offers **Open on YouTube**, so there is always a
working path to the content. Meanwhile the readout reads "Room ambience only",
the transport disables, no fake track list appears, and the mixer keeps working.

> **These stations are third-party re-uploads of copyrighted Studio Ghibli
> music.** They are embeddable today, but they get embed-restricted and taken
> down regularly — that is exactly how the original one broke. The durable
> answer for a shipping product is licensed or first-party audio; the station
> chain buys resilience, not permanence.

## Scenes

Every filmed scene is offered twice: as itself, and through the pixel grid.
The pixel pass was previously applied to every channel at once, so the filmed
scenes were still loading and playing but were never visible — the canvas
covered them.

**Video backdrops** are looping YouTube videos played muted in their own
player, independent of the tuner. Each shipped id was probed with a real
`YT.Player` and reported `isPlayable`; of sixteen candidates, six came back
`errorCode: "auth"` while still returning a valid oEmbed response. A backdrop
that stops being embeddable disables its own channel rather than showing a
dead frame.

> The backdrops are third-party uploads of copyrighted footage and can be
> withdrawn at any time, exactly as the original hardcoded Ghibli video was.
> `Studio Ghibli Nature Loop` is from an official HBO Max channel and
> `Free 4K Rain Loop` is published royalty-free; those two are the most
> durable of the set.

## Sound

The twelve room channels are five field recordings plus seven layers
synthesised locally with the Web Audio API. The synthesised layers each have
their own character rather than sharing one noise source — fire has scheduled
crackle transients, night has sparse chirps, stream has two drifting resonant
peaks, thunder has rare slow swells, wind gusts by moving its filter, and ocean
swells its cutoff and gain in antiphase.

A channel at 0% is silent. Level modulation is relative to the channel's own
level, so nothing you have switched off can make a sound.

### Channel levels are measured, not estimated

Each layer's `trim` was derived by playing it alone at 100% and reading its
post-limiter RMS from an `AnalyserNode`. The previous table was badly off for
the recordings — rain measured 0.019 against a 0.09–0.13 median, roughly 10x
below `stream`, so the channel users reach for first was inaudible under music
at any fader position. All twelve now land within about 4 dB of each other.

A `trim` above 1 means the source recording itself is quiet. Re-encoding those
files at a normalised level would let it drop back toward 1.

**Four of the five recordings are Ogg Vorbis, which Safari and iOS cannot
decode.** Those channels are silent there. A failed layer is now recorded and
its meter reads dark, but the durable fix is re-encoding to a format every
browser plays.

### Meters read the signal

The LED meters used to be computed from the fader position, so a channel
producing nothing still animated its bar. They now measure the layer's own
output, which is why a dead channel is visible as dead.

### Included recordings

- "Placid Ambient" by MusicLFiles, CC BY 4.0, via Wikimedia Commons.
- "Rain (1)" by ezwa, public domain, via Wikimedia Commons.
- "forest ambience" by nille, public domain, via Wikimedia Commons.
- "Cafe ambiance" by Marble Toast, CC0, via Wikimedia Commons —
  trimmed to a 90-second loop and re-encoded to AAC.
- "Brownnoise", public domain, via Wikimedia Commons.

### Scene art

- "Pixel Art Parallax Background" by **OlegKrylov**, **CC-BY 4.0**, via
  opengameart.org — <https://opengameart.org/content/pixel-art-parallax-background>.
  Flattened to `assets/wallpapers/meadow.png`; the source layers are kept in
  `assets/scenes/meadow/`. Attribution is required wherever this ships, and is
  also shown in the app at the foot of the scene selector.

## Accessibility

Targeted at WCAG 2.2 AA. Verified in-browser:

- Every interactive control is at least 24×24px; primary controls are 44px.
- Nothing renders below 11px.
- Text over the scene sits on its own bevelled plate rather than on a scrim.
  The scrim was calibrated against the old dark video loops and was never
  re-measured when the Ghibli paintings landed: against the brightest region of
  the readout band it had fallen to **2.17:1** for the kind label, **3.31:1**
  for the number and **3.20:1** for the title. On the plate they measure
  **8.1:1**, **11.6:1** and **16.5:1**. The lesson is in the failure mode — the
  figures were correct when written and silently wrong the moment the artwork
  changed underneath them.
- Palette: amber on chassis 9.66:1, bone 15.6:1, muted 7.2:1. The deep red is
  used only for indicator fills, never for text.
- Keyboard: `Space` play/pause, `←`/`→` track, `Q` quiet, `F` full screen,
  `Esc` closes any surface. Opening a panel moves focus into it and closing
  returns focus to the control that opened it.
- `prefers-reduced-motion` removes the scene video, weather, the power-on
  sequence and all movement, keeping opacity and colour. The dock fades rather
  than slides.
- The dock withdraws when unused and returns on hover, on focus, or on a
  pointer near the bottom edge. It is held open while a panel is open, while
  focus is inside it, and mid-drag — a control that slides away under a
  keyboard user is worse than one that never moves.
- Skip back / forward seek 30 s inside a single video and step tracks inside a
  playlist; the `aria-label` says which it is currently doing. They used to be
  disabled for every single-video source, which is all three stations.

Still untested: screen readers (VoiceOver, NVDA), 200% zoom, and forced-colors.

## Deploying

There is no build step, so `index.html` carries a version query on its own
assets (`styles.css?v=32`). **Bump it when you change CSS or JS**, or returning
visitors will run cached scripts against new markup — which is precisely how a
fix can appear not to work.

## Assets

`assets/original/` holds the untouched source media and is not needed at
runtime. Shipped media is about 20MB, down from 68MB:

| Asset | Was | Now |
| --- | --- | --- |
| `garden-loop.mp4` | 29MB (61 min, 640×360) | 0.95MB (60s segment) |
| `audio/cafe` | 19.9MB Ogg (20 min) | 1.31MB AAC (90s) |
| posters ×3 | 2.2MB PNG | 0.29MB JPEG |
| `lake-loop.mp4` | 6.4MB | unchanged |
| `rain-window.mp4` | 4.4MB | unchanged |

Two known asset limits:

- **The garden scene is natively 640×360** and looks soft upscaled. Its weight
  is fixed; its resolution needs a better source file.
- **Lake and rain were left alone deliberately.** Re-encoding them needs
  `ffmpeg`; the macOS `avconvert` presets available here either keep the
  resolution at a much larger file size or drop to 480×252, which is worse than
  shipping them as they are. With `ffmpeg` installed, 1280×720 at ~1.5MB each
  is the target.


## The 2026-08-30 pass

The app worked but felt grim, and four things that read as taste turned out to
be bugs.

### Colour was the problem, not brightness

Measured, by sampling the actual pixels: the old default scene ran at **9.5%
mean saturation**; the reference it was being compared against ran at **57.7%**.
Luminance was only a 3.5x gap. Colour is what reads as joy, so the fix was
chroma, not light level — which is also why a dark pixel desktop and "I want to
feel happy" were never actually in conflict.

The fourteen Ghibli stills were not picked by eye either. Every still across
eight films was decoded and scored on saturation with brightness as a secondary
term; the shipped set measures **0.42 saturation**, four and a half times the
old default.

### Bugs fixed

- **`--face-chan: var(--face-chan)`** was a cyclic custom property, so it
  computed to nothing and **all twelve mixer channel cards rendered with no
  background at all**.
- **Weather covered 0.21% of the screen at maximum intensity** — 4,876 pixels
  out of 2.3 million. Intensity drove particle *count* and nothing else. It now
  covers **2.4%** at maximum and drives count, speed, size, opacity and wind,
  across a 100x range instead of a 16x one.
- **The LED meters could not exceed ~43%**; a channel at full lit 13% of its
  bar. The scale factor was linear, which cannot serve ambience whose RMS
  varies threefold between layers. It is now a power curve. Worth knowing: all
  twelve channels were producing audio the whole time — the meter was lying.
- **The gallery channel could not survive a reload**, and `restore()`
  overwrote the saved index with 0 on the way past, so the setting was
  destroyed rather than merely ignored.
- **Pause stopped controlling the room** the moment you touched a fader:
  `wakeRoom()` restarted the audio while the transport still read "Play".
- **The dot-matrix mask removed ~72% of every glyph**, so the track readout
  rendered essentially blank.
- **The dock withdrew four seconds after load**, before you had touched
  anything.
- **"Drift" was an audio feature wearing a weather costume** — it nudged room
  faders by ±2 every 28 seconds, and the setter rounded, so any nudge under 0.5
  was a literal no-op. It never touched the scene.
- **Panels were centred with `translateX(-50%)`** over a fractional width, so
  on any odd viewport the whole box landed on a half pixel and every glyph in
  it was rasterised off-grid. Centring is now done with auto margins, which
  also means the reduced-motion `transform: none` override no longer shoves
  the dock half its own width to the right.

### Drift is now Sway

Each live channel gets its own slow sine with a random period (34–80s) and
phase, so the room breathes instead of stepping and no two channels line up.
The moving value goes to the engine as a float — `state.values` never moves,
so the fader, the readout and the saved mix still show what you actually set.

**Sway is deliberately exempt from `prefers-reduced-motion`.** It is an audio
feature; the motion preference governs visual motion. The meter's transition is
already removed under that preference, which takes care of the visible part.

### Three modes, each authored

Night is the default and lives in `:root`. Day and dusk are authored palettes,
not inversions: on a pale ground the amber has to lose most of its lightness or
it fails contrast outright (`#FFC24A` on cream is 1.6:1).

They are scoped to chrome surfaces and **never to `:root`** — the readout, the
scene title and the veil float over the scene photo and are measured against the
brightest frame, so they stay light-on-dark in every mode.

On **auto**, the mode follows the *scene*, not the clock: a bright scene gets a
dark faceplate and a dark scene gets a light one, so the chrome always separates
from the picture.

### Interface sound

Synthesised at play time — no asset files, and nothing to download before the
first click can make a noise. Ramps rather than value assignments (a
discontinuity in a waveform is itself a click), a few percent of pitch variation
per trigger so forty presses a minute do not turn into a smoke alarm, and a
180Hz high-pass so the sounds sit above the ambience bed and cut through quietly
rather than loudly.

The browser will not start audio without a user gesture, so a gate had to exist
regardless. The BIOS boot screen *is* that gate — same click, spent better.

### Pixel identity

Thirty-two icons redrawn on a 16x16 grid, each compiled to a single path of
rectangle subpaths (smaller than individual rects, and it removes the hairline
seams between adjacent pixels). `shape-rendering: crispEdges`, and icon sizes
moved to whole multiples of 16 — the bar used to show icons at 11, 15, 18 and
20px simultaneously, because icons in *labelled* hardware keys inherited the
11px label size.

Display type is **Silkscreen**, a true 8px-grid bitmap face, used at 16px and
32px and at no other size, because that is where it is sharp. Everything that
has to stay readable small stays in IBM Plex Mono, which is not a bitmap face
and does not care.

### Scene art

Studio Ghibli publishes these stills themselves and invites free use "within the
bounds of common sense" — a goodwill grant covering personal use, not
publication. **If this is ever put on the public internet or monetised, those
files have to come out first.** See `assets/scenes/ghibli/CREDITS.txt`, which
lists every file and its film.

### The room drives the scene

Turn the rain fader up and rain appears on the window; fire gives embers, night
garden gives fireflies, wind gives mist. The loudest weather-shaped channel above
22 chooses the effect and its fader position sets the intensity. Picking a
weather chip by hand takes the wheel back until you hand it over again.

The three layers still don't disturb each other — that part was always right.
What was missing is that nothing you did in one place was *visible* anywhere
else, and independence was reading as disconnection.

### Poking the scene

Press the picture and it answers: a burst of sparks at the point you touched,
tinted to whatever weather is running, falling under gravity with drag. It is
the one place in the app where the thing you press is the thing that moves —
everywhere else you press a control and something else changes.

Sparks keep the render loop alive on their own, so this works with weather off,
and it is disabled entirely under `prefers-reduced-motion`.

### The dock meter

Twelve bars of real analyser output, summed across the room, with a peak cap
that falls at a fixed rate rather than tracking the signal. The falling cap is
what makes a meter read as an instrument instead of a bar chart. Hidden below
1080px, where the dock has better uses for the space.

### Focus rings

`outline`, not `box-shadow`. It has followed `border-radius` since Safari 16.4,
it survives forced-colors mode where shadows are dropped, and it sits outside
the box model so nothing reflows. The offset collapses from 4px to 1px on press,
so the ring travels back to the key as it goes down.


## The interaction pass (2026-08-30, later)

Two reference clips were studied frame by frame — a calendar whose cards tilt
and carry their own drop target while dragged, and a portfolio whose airplane
window has a shade that binds the whole page's lightness to the drag, frame by
frame, springing back if released below halfway.

Neither has a modal panel. Nothing in either is a button in a box. That is the
gap this pass closes.

- **Sound tokens.** The twelve room layers are objects on the painting. Height
  sets the level, horizontal position sets the stereo pan, so you place a sound
  in the room you are looking at. Both apply on every `pointermove`, not on
  release. Each carries its own colour, because twelve identical grey slabs read
  as equipment and twelve coloured objects read as things you can pick up.
- **A window shade.** Every scene here is a window, so the light control is a
  blind you pull rather than a row in a menu. It crossfades night → dusk → day
  continuously and commits past halfway.
- **Panels became a drawer.** They used to cover 67.2% of the screen, including
  the scene the mixer drives. Now 23.1% at desktop and 35.7% at tablet, and the
  scene's name no longer disappears at the moment you are choosing a scene.
- **`grabbable.js`** carries the physics: lift, a stable tilt, rubber-banded
  edges, a flick threshold and a spring settle. Its paint is deliberately
  **synchronous** rather than batched into `requestAnimationFrame` — there is
  no layout read to thrash against, and rAF is throttled to zero in a background
  tab, which is exactly where this app is meant to live.

### A bug worth remembering

`--ease-in-out` was used by the Ken Burns drift and declared nowhere. An
unresolvable `var()` voids the whole `animation` shorthand, so it computed to
`none` and **every still had been frozen since the day it shipped**, with a
`will-change: transform` promoting a layer for nothing. Nothing warned; the
feature simply did not exist. There is now a check for variables used with no
fallback and never declared.
