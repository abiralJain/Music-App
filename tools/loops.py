#!/usr/bin/env python3
"""Background-loop pipeline: probe sources, triage by hand, encode for the app.

    python3 tools/loops.py probe    # inventory sources -> _triage/triage.json + strips
    python3 tools/loops.py encode   # triage.json -> assets/loops/*.mp4/.jpg + loops.local.js
    python3 tools/loops.py check    # manifest vs disk sanity

Sources stay outside the repo (SRC below). probe merges by content hash, so
re-running it never clobbers a hand-edited triage.json. Everything encode
writes into assets/loops/ except loops.js is gitignored — the sources are
third-party uploads whose provenance this public repo cannot assert, the same
rule as the personal scene pack.
"""
import hashlib
import json
import math
import os
import re
import subprocess
import sys

SRC = os.path.expanduser("~/Desktop/Projects/outputs/Videos")
TRIAGE_DIR = os.path.join(SRC, "_triage")
TRIAGE = os.path.join(TRIAGE_DIR, "triage.json")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "loops")

# object-position anchors. Deliberately shy of the edges: a hard 0%/100% on a
# scaled element parks the composition against the bezel.
FOCAL = {
    "center": (50, 50), "top": (50, 24), "bottom": (50, 76),
    "left": (26, 50), "right": (74, 50),
    "top-left": (28, 26), "top-right": (72, 26),
    "bottom-left": (28, 74), "bottom-right": (72, 74),
}
# Screen-shape buckets and the aspect each is fit against. Named for the
# shape, not the device — a rotated tablet is a wide screen.
BUCKETS = {"wide": 16 / 9, "tall": 1.0, "phone": 9 / 19.5}


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def ffprobe(path):
    out = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate:stream_side_data=rotation:stream_tags=rotate:format=duration",
        "-of", "json", path,
    ]).stdout
    data = json.loads(out)
    st = data["streams"][0]
    rot = 0
    for sd in st.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(sd["rotation"]) % 360
    if not rot and st.get("tags", {}).get("rotate"):
        rot = int(st["tags"]["rotate"]) % 360
    num, den = st["r_frame_rate"].split("/")
    fps = float(num) / float(den or 1)
    return {
        "w": st["width"], "h": st["height"],
        "dur": round(float(data["format"]["duration"]), 2),
        "fps": round(fps, 2), "rotation": rot,
    }


def sha1_head(path, n=4 * 1024 * 1024):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read(n))
    return h.hexdigest()


def probe():
    os.makedirs(TRIAGE_DIR, exist_ok=True)
    old = {}
    if os.path.exists(TRIAGE):
        with open(TRIAGE) as f:
            old = {c["probe"]["sha"]: c for c in json.load(f)["clips"]}

    files = sorted(
        f for f in os.listdir(SRC)
        if f.lower().endswith(".mp4") and not f.startswith(".")
    )
    seen_sha, clips = {}, []
    for i, name in enumerate(files):
        path = os.path.join(SRC, name)
        sha = sha1_head(path)
        if sha in old:  # keep every hand decision from the previous pass
            clip = old[sha]
            clip["src"] = name
            clips.append(clip)
            seen_sha.setdefault(sha, name)
            continue
        if sha in seen_sha:
            clips.append({
                "src": name, "probe": {"sha": sha}, "keep": False,
                "why": "duplicate of " + seen_sha[sha],
            })
            continue
        seen_sha[sha] = name
        meta = ffprobe(path)
        meta["sha"] = sha
        clip = {
            "src": name, "probe": meta,
            "keep": True, "slug": "clip-%02d" % (i + 1),
            "title": "", "note": "", "tone": "",
            "moods": [], "rotate": meta["rotation"], "focal": "center",
            "trim": {"in": 0.0, "out": None}, "loopFade": 0.4,
        }
        clips.append(clip)
        # Triage strip: beginning | middle | end in one image, so content,
        # focal point and "does the end meet the start" are one look each.
        strip = os.path.join(TRIAGE_DIR, "%02d-strip.jpg" % (i + 1))
        d = meta["dur"]
        pts = [min(1.5, d * 0.1), d * 0.5, max(0.0, d - 0.3)]
        parts = []
        for j, t in enumerate(pts):
            p = os.path.join(TRIAGE_DIR, ".f%d.jpg" % j)
            run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-ss", str(t),
                 "-i", path, "-frames:v", "1", "-vf", "scale=400:-2",
                 "-q:v", "5", p])
            parts.append(p)
        run(["ffmpeg", "-nostdin", "-y", "-v", "error",
             "-i", parts[0], "-i", parts[1], "-i", parts[2],
             "-filter_complex", "[0][1][2]hstack=3", "-q:v", "5", strip])
        for p in parts:
            os.remove(p)

    with open(TRIAGE, "w") as f:
        json.dump({"version": 1, "clips": clips}, f, indent=2)
    print("probed %d files -> %s" % (len(files), TRIAGE))


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s) or "clip"


def fit_for(w, h, focal):
    """zoom + object-position per screen bucket, from aspect mismatch alone."""
    out = {}
    clip_a = w / h
    for bucket, screen_a in BUCKETS.items():
        need = screen_a / clip_a
        ratio = max(need, 1 / need)
        zoom = 1.01
        if ratio > 1.9:
            zoom = min(1.45, round(1.01 * (1 + 0.18 * (ratio - 1.9)), 3))
        fx, fy = FOCAL.get(focal, FOCAL["center"])
        # Only the cropped axis has anywhere to travel.
        if need > 1:
            fy = 50
        else:
            fx = 50
        out[bucket] = [zoom, "%d%% %d%%" % (fx, fy)]
    return out


def avg_color(jpg):
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", jpg,
         "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    r, g, b = raw[0], raw[1], raw[2]
    return "#%02X%02X%02X" % (r, g, b), 0.2126 * r + 0.7152 * g + 0.0722 * b


def encode():
    os.makedirs(OUT, exist_ok=True)
    with open(TRIAGE) as f:
        clips = json.load(f)["clips"]
    manifest = []
    for c in clips:
        if not c.get("keep"):
            continue
        src = os.path.join(SRC, c["src"])
        slug = slugify(c["slug"])
        dst = os.path.join(OUT, slug + ".mp4")
        poster = os.path.join(OUT, slug + ".jpg")
        p = c["probe"]
        t_in = float(c.get("trim", {}).get("in") or 0)
        t_out = c.get("trim", {}).get("out")
        dur = (float(t_out) if t_out else p["dur"]) - t_in
        fade = min(float(c.get("loopFade") or 0), dur * 0.12)

        rot = int(c.get("rotate") or 0) % 360
        rotf = {0: "", 90: "transpose=1,", 180: "transpose=1,transpose=1,", 270: "transpose=2,"}[rot]
        # A 1280 box on BOTH axes: capping height at 720 halved every portrait
        # clip's resolution, and portrait is exactly where the phone needs it.
        scale = ("scale=w='min(1280,iw)':h='min(1280,ih)':"
                 "force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos")
        # Light denoise before a mild sharpen: the sources are 720p-class web
        # encodes, so sharpening alone amplifies their compression noise. This
        # pair recovers perceived detail without inventing halos.
        base = rotf + scale + ",fps=24,hqdn3d=1.2:1.2:4:4,unsharp=5:5:0.4:3:3:0.0"

        vcodec = ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
                  "-preset", "slow", "-crf", "19",
                  # Fixed 2s GOP: the loop attribute restarts by seeking to 0,
                  # and an open GOP makes that seek expensive.
                  "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
                  "-metadata:s:v:0", "rotate=0", "-movflags", "+faststart"]
        if fade > 0.05 and dur > 3:
            main = dur - fade
            fc = ("[0:v]%s,split=2[a][b];"
                  "[a]trim=start=0:end=%f,setpts=PTS-STARTPTS[m];"
                  "[b]trim=start=%f:end=%f,setpts=PTS-STARTPTS[t];"
                  "[t][m]xfade=transition=fade:duration=%f:offset=0[v]"
                  % (base, main, main, dur, fade))
            run(["ffmpeg", "-nostdin", "-y", "-v", "error",
                 "-ss", str(t_in), "-t", str(dur), "-i", src,
                 "-filter_complex", fc, "-map", "[v]", "-an"] + vcodec + [dst])
            out_dur = main
        else:
            run(["ffmpeg", "-nostdin", "-y", "-v", "error",
                 "-ss", str(t_in), "-t", str(dur), "-i", src,
                 "-vf", base, "-an"] + vcodec + [dst])
            out_dur = dur

        # Poster from the OUTPUT, so it matches post-rotation/post-trim exactly.
        run(["ffmpeg", "-nostdin", "-y", "-v", "error",
             "-ss", str(max(0.0, out_dur * 0.4)), "-i", dst,
             "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "3", poster])

        om = ffprobe(dst)
        accent, luma = avg_color(poster)
        tone = c.get("tone") or ("light" if luma > 118 else "dark")
        manifest.append({
            "id": slug,
            "title": c.get("title") or slug.replace("-", " ").title(),
            "note": c.get("note") or "",
            "file": slug + ".mp4", "poster": slug + ".jpg",
            "w": om["w"], "h": om["h"], "dur": round(out_dur, 1),
            "bytes": os.path.getsize(dst),
            "tone": tone, "accent": accent,
            "moods": c.get("moods") or [],
            "fit": fit_for(om["w"], om["h"], c.get("focal") or "center"),
        })
        print("%-24s %dx%-5d %5.1fs %6.1fKB %s" % (
            slug, om["w"], om["h"], out_dur,
            os.path.getsize(dst) / 1024, tone))

    js = ("/* Generated by tools/loops.py — do not hand-edit; re-run `encode`.\n"
          "   Loaded before app.js so worlds[] is still composed at parse time. */\n"
          "window.DW_LOOPS = " +
          json.dumps({"version": 1, "base": "assets/loops/",
                      "credit": "", "clips": manifest},
                     indent=2, ensure_ascii=True) + ";\n")
    with open(os.path.join(OUT, "loops.local.js"), "w") as f:
        f.write(js)
    total = sum(m["bytes"] for m in manifest)
    print("wrote %d clips, %.1f MB total -> %s" % (len(manifest), total / 1e6, OUT))


def check():
    with open(os.path.join(OUT, "loops.local.js")) as f:
        body = f.read()
    data = json.loads(body[body.index("{"):body.rindex("}") + 1])
    bad = 0
    for m in data["clips"]:
        for key in ("file", "poster"):
            p = os.path.join(OUT, m[key])
            if not os.path.exists(p) or os.path.getsize(p) < 1024:
                print("MISSING", m[key])
                bad += 1
    print("checked %d clips, %d problems" % (len(data["clips"]), bad))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "probe":
        probe()
    elif cmd == "encode":
        encode()
    elif cmd == "check":
        check()
    else:
        print(__doc__)
        sys.exit(2)
