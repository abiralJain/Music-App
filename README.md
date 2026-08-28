# Dream Worlds

A tabletop ambience machine, built as one piece of 1990s audio hardware:
a machined faceplate and an amber dot-matrix readout over a full-screen scene.

Three layers stay independent — changing one never disturbs the others:

- **Scene** — the full-screen visual channel (4 channels).
- **Music** — any YouTube video or playlist you tune in.
- **Room** — a twelve-channel ambience mixer with six presets, saved mixes,
  drift, and a sleep timer.

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

## Sound

The twelve room channels are five field recordings plus seven layers
synthesised locally with the Web Audio API. The synthesised layers each have
their own character rather than sharing one noise source — fire has scheduled
crackle transients, night has sparse chirps, stream has two drifting resonant
peaks, thunder has rare slow swells, wind gusts by moving its filter, and ocean
swells its cutoff and gain in antiphase.

A channel at 0% is silent. Level modulation is relative to the channel's own
level, so nothing you have switched off can make a sound.

### Included recordings

- "Placid Ambient" by MusicLFiles, CC BY 4.0, via Wikimedia Commons.
- "Rain (1)" by ezwa, public domain, via Wikimedia Commons.
- "forest ambience" by nille, public domain, via Wikimedia Commons.
- "Cafe ambiance" by Marble Toast, CC0, via Wikimedia Commons —
  trimmed to a 90-second loop and re-encoded to AAC.
- "Brownnoise", public domain, via Wikimedia Commons.

## Accessibility

Targeted at WCAG 2.2 AA. Verified in-browser:

- Every interactive control is at least 24×24px; primary controls are 44px.
- Nothing renders below 11px.
- Text over the scene is protected by a gradient scrim sized against the
  *brightest* channel, not the darkest — the worst measured case is 11.8:1 for
  the scene title and 5.8:1 for the 11px label beside it.
- Palette: amber on chassis 9.66:1, bone 15.6:1, muted 7.2:1. The deep red is
  used only for indicator fills, never for text.
- Keyboard: `Space` play/pause, `←`/`→` track, `Q` quiet, `F` full screen,
  `Esc` closes any surface. Opening a panel moves focus into it and closing
  returns focus to the control that opened it.
- `prefers-reduced-motion` removes the scene video, weather, the power-on
  sequence and all movement, keeping opacity and colour.

Still untested: screen readers (VoiceOver, NVDA), 200% zoom, and forced-colors.

## Deploying

There is no build step, so `index.html` carries a version query on its own
assets (`styles.css?v=4`). **Bump it when you change CSS or JS**, or returning
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
