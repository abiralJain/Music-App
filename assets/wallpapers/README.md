# Gallery wallpapers

Drop pixel-art images or animated GIFs in this folder and list them in
`manifest.json`. They appear as the **Gallery** channel (CH 05); if the list is
empty the channel stays disabled, exactly like an untuned source.

```json
{
  "scenes": [
    { "file": "pond-totoro.gif", "label": "By the pond",  "timeOfDay": "day" },
    { "file": "night-bus.gif",   "label": "Night bus",    "timeOfDay": "night" },
    { "file": "morning.png",     "label": "First light",  "timeOfDay": "dawn" }
  ]
}
```

- `file` — required, relative to this folder.
- `label` — shown in the readout. Defaults to the filename.
- `timeOfDay` — `dawn` | `day` | `dusk` | `night` | `any`. Used only when
  rotation is set to **time of day**.

## How these are rendered

Authored pixel art is shown **at its own pixel scale** with
`image-rendering: pixelated`, and the per-channel palette ramp is switched
**off** for it. That is deliberate: resampling finished pixel art onto the
260px ramp grid makes it shimmer, and re-quantising colours that an artist
already chose would throw their work away. Only the video channels get the
ramp treatment, because they are photographic and need it.

## Rotation

Set in Settings — **time of day** (default), **every N minutes**, or **off**.
Changes crossfade like any other channel change.

## Licensing — please read

Nothing ships in this folder. Pixel art of Studio Ghibli characters found on
Pinterest and similar sites is fan art: the drawing belongs to the artist and
the characters belong to Studio Ghibli. Using it in something you publish needs
permission from both. Only add art you created, commissioned, or hold a licence
for.
