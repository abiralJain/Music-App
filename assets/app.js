/* ============================================================
   Dream Worlds — application
   ============================================================ */
(function () {
  "use strict";

  window.__dw = { errors: [] };
  document.documentElement.dataset.runtimeErrors = "0";
  function noteError(message) {
    window.__dw.errors.push(message);
    document.documentElement.dataset.runtimeErrors = String(window.__dw.errors.length);
  }
  window.addEventListener("error", function (e) { noteError(e.message || "runtime error"); });
  window.addEventListener("unhandledrejection", function (e) {
    noteError((e.reason && e.reason.message) || String(e.reason || "promise rejection"));
  });

  /* ---------- data ---------- */

  // Verified embeddable on 2026-08-28 by probing the player directly (oEmbed
  // lies — it returns 200 for videos that are embed-blocked). Probed in order;
  // the first that actually plays wins, so one uploader flipping a switch no
  // longer takes the feature down. These are third-party re-uploads and can
  // be withdrawn at any time — see README.
  var STATIONS = [
    { id: "-sanFLupL-E", label: "Ghibli piano for sleep",      note: "1 h 55 m" },
    { id: "-pbjXqByPLA", label: "The best of Ghibli piano",     note: "1 h 21 m" },
    { id: "7voSN82FGF0", label: "Ghibli summer night piano",    note: "7 h 18 m" }
  ];

  // What YouTube's numeric onError codes actually mean, so the app can say
  // whose problem it is instead of a single vague sentence.
  function sourceMessage(code) {
    if (code === 101 || code === 150) return {
      title: "The uploader blocked embedded playback",
      body: "This video plays only on YouTube itself. Nothing is wrong with your link — the owner turned embedding off." };
    if (code === 100) return {
      title: "That video is gone",
      body: "It was removed, made private, or never existed." };
    if (code === 2) return {
      title: "That video ID is not valid",
      body: "Check the link and try again." };
    if (code === 5) return {
      title: "The player could not start",
      body: "The HTML5 player failed here. Reloading usually clears it." };
    return {
      title: "This source will not play here",
      body: "Your room and scene are untouched. Try another link below." };
  }

  // Looping video backdrops, played muted in their own player so they are
  // independent of whatever the tuner is playing.
  //
  // Every id here was probed with a real YT.Player and reported isPlayable on
  // 2026-08-29. That check is not optional: of sixteen candidates, SIX came
  // back errorCode:"auth" (embedding switched off by the uploader) while still
  // returning a perfectly valid oEmbed response — which is exactly why the
  // README says oEmbed cannot be used to test embeddability.
  //
  // These are third-party uploads of copyrighted footage and can be withdrawn
  // at any time, the same way the original hardcoded Ghibli video was. The
  // channel disables itself if that happens rather than showing a dead frame.
  // `z9Ug-3qhrwY` is from an official HBO Max channel and `b-cI-vK2Dzo` is
  // published royalty-free, so those two are the most durable of the set.
  var BACKDROPS = [
    { id: "ghibli-nature",  title: "Ghibli nature",   videoId: "z9Ug-3qhrwY",
      note: "Studio Ghibli scenery · official upload" },
    { id: "howls-hills",    title: "Howl's hills",    videoId: "ipQJR0rcvzw",
      note: "Moving Castle scenery · 10 h, no music" },
    { id: "ghibli-meadow",  title: "Ghibli meadow",   videoId: "KAqUpjcs_xc",
      note: "Ghibli-inspired meadow · 6 h" },
    { id: "cyber-loft",     title: "Cyberpunk loft",  videoId: "pCo1g5NQAqc",
      note: "Rain over a neon city · 10 h" },
    { id: "jungle-room",    title: "Jungle bedroom",  videoId: "b-cI-vK2Dzo",
      note: "Rain loop · royalty-free" },
    { id: "quiet-meadow",   title: "Quiet meadow",    videoId: "fQf8KdPjO_Y",
      note: "Open field · 10 min loop" }
  ];

  // The filmed scenes. Each appears twice below: once as itself, once through
  // the pixel grid.
  var FILMED = [
    { id: "rain-window", title: "Rain window", note: "A quiet city seen through rain",
      video: "assets/rain-window.mp4", poster: "assets/rain-window-poster.jpg", ramp: "slate" },
    { id: "pond-garden", title: "Pond garden", note: "Leaves, water, a patient afternoon",
      video: "assets/garden-loop.mp4", poster: "assets/garden-loop-poster.jpg", ramp: "moss" },
    { id: "wide-awake", title: "Wide awake", note: "Open lake light for clear work",
      video: "assets/lake-loop.mp4", poster: "assets/lake-loop-poster.jpg", ramp: "cool" }
  ];

  // The pixel pass used to be applied to every channel unconditionally, so the
  // filmed scenes were still loading and playing but never shown — the canvas
  // covered them. `pixel` is now per channel, and each filmed scene is offered
  // both ways rather than one look replacing the other.
  var worlds = [];
  FILMED.forEach(function (s) {
    worlds.push({ id: s.id, title: s.title, kind: "local", note: s.note,
                  video: s.video, poster: s.poster, ramp: null, pixel: false });
  });
  FILMED.forEach(function (s) {
    worlds.push({ id: s.id + "-pixel", title: s.title, kind: "local",
                  note: s.note + " · pixel art",
                  video: s.video, poster: s.poster, ramp: s.ramp, pixel: true });
  });
  BACKDROPS.forEach(function (b) {
    worlds.push({ id: b.id, title: b.title, kind: "backdrop", note: b.note,
                  videoId: b.videoId, video: null, poster: null,
                  ramp: null, pixel: false });
  });
  // No pixel twin for the tuned source: a cross-origin iframe cannot be drawn
  // to a canvas, so the ramp never applied to it. What it used to show was the
  // last local video, pixelated, painted over the video you actually tuned.
  worlds.push({ id: "your-source", title: "Your source", kind: "youtube",
                note: "Your tuned video as the scene",
                video: null, poster: null, ramp: null, pixel: false });
  worlds.push({ id: "gallery", title: "Gallery", kind: "gallery",
                note: "Your pixel-art scenes, rotating",
                video: null, poster: null, ramp: null, pixel: true });

  // Rotation for the Gallery channel. "time" maps scenes to the part of day,
  // which is the only mode that means anything on its own; "interval" just
  // cycles. Both crossfade like any other channel change.
  var ROTATE_MS = 8 * 60000;
  function partOfDay(h) {
    if (h < 7)  return "night";
    if (h < 11) return "dawn";
    if (h < 17) return "day";
    if (h < 21) return "dusk";
    return "night";
  }

  var roomLayers = [
    { id: "rain",    name: "Gentle rain",    note: "window",  icon: "i-cloud-rain" },
    { id: "forest",  name: "Forest morning", note: "birds",   icon: "i-tree" },
    { id: "cafe",    name: "Café murmur",    note: "distant", icon: "i-coffee" },
    { id: "brown",   name: "Brown noise",    note: "deep",    icon: "i-wave-sine" },
    { id: "soft",    name: "Soft air",       note: "tonal",   icon: "i-wind" },
    { id: "white",   name: "White noise",    note: "clean",   icon: "i-radio" },
    { id: "wind",    name: "Open window",    note: "gusts",   icon: "i-wind" },
    { id: "ocean",   name: "Ocean tide",     note: "swell",   icon: "i-waves" },
    { id: "stream",  name: "Small stream",   note: "water",   icon: "i-drop" },
    { id: "fire",    name: "Fireplace",      note: "crackle", icon: "i-fire" },
    { id: "night",   name: "Night garden",   note: "insects", icon: "i-moon-stars" },
    { id: "thunder", name: "Distant thunder",note: "rumble",  icon: "i-cloud-lightning" }
  ];

  var emptyRoom = {};
  roomLayers.forEach(function (l) { emptyRoom[l.id] = 0; });

  function mix(o) { var m = {}; for (var k in emptyRoom) m[k] = 0; for (var j in o) m[j] = o[j]; return m; }
  var presets = [
    { id: "rainy-window",      title: "Rainy window",      note: "rain · soft air · low hush",    values: mix({ rain: 34, soft: 10, brown: 8 }) },
    { id: "quiet-library",     title: "Quiet library",     note: "air · brown noise · a room",    values: mix({ soft: 16, brown: 15, cafe: 6 }) },
    { id: "forest-desk",       title: "Forest desk",       note: "birds · stream · wind",         values: mix({ forest: 28, stream: 15, wind: 8 }) },
    { id: "distant-cafe",      title: "Distant café",      note: "murmur · rain · soft air",      values: mix({ cafe: 22, rain: 15, soft: 7 }) },
    { id: "fireplace-evening", title: "Fireplace evening", note: "crackle · night · wind",        values: mix({ fire: 28, night: 12, wind: 5 }) },
    { id: "deep-noise",        title: "Deep noise",        note: "brown · white · low thunder",   values: mix({ brown: 22, white: 8, thunder: 5 }) }
  ];

  var WEATHERS = ["none", "rain", "snow", "fireflies"];

  /* ---------- state ---------- */

  var state = {
    worldIndex: 0, playing: false, musicLevel: 52, roomLevel: 62,
    values: mix(presets[0].values), muted: {}, activePreset: presets[0].id, savedRoom: null,
    weather: "none", weatherIntensity: 48, drift: false, driftTimer: null,
    selectedMinutes: 25, focusEndsAt: null, focusTimer: null,
    surface: null,
    source: null,              // { kind:'video'|'playlist', id, label, station? }
    savedSources: [],          // [{ kind, id, label, savedAt }] — the user's own
    stationIndex: -1,
    gallery: [], galleryIndex: 0, rotate: "time", rotateTimer: null,
    tracks: [], trackIndex: 0,
    ytApiLoading: false, ytReady: false, ytFailed: false
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var world = $("#world");
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  var videos = [$("#sceneA"), $("#sceneB")];
  var liveVideo = 0;
  var ytPlayer = null, ytWatch = null, ytFailTimer = null, ignoreWatchUntil = 0;
  var surfaceTrigger = null, toastTimer = null, meterTimer = null;

  /* ---------- persistence (debounced: was 31 writes per 31 drag events) ---------- */

  var persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(writeState, 400);
  }
  function writeState() {
    try {
      localStorage.setItem("dreamWorldsV4", JSON.stringify({
        worldIndex: state.worldIndex, musicLevel: state.musicLevel,
        roomLevel: state.roomLevel, values: state.values,
        muted: state.muted, activePreset: state.activePreset, savedRoom: state.savedRoom,
        weather: state.weather, weatherIntensity: state.weatherIntensity, drift: state.drift,
        source: state.source, savedSources: state.savedSources, trackIndex: state.trackIndex,
        rotate: state.rotate, galleryIndex: state.galleryIndex
      }));
    } catch (e) {}
  }
  function restore() {
    var saved;
    try { saved = JSON.parse(localStorage.getItem("dreamWorldsV4")); } catch (e) { return; }
    if (!saved) return;
    state.worldIndex = Math.max(0, Math.min(worlds.length - 1, Number(saved.worldIndex) || 0));
    // Migration: one "master" used to drive music and room together, which is
    // precisely why the room could never be raised over the music. Older saves
    // seed both levels from it; the room starts a little higher so ambience is
    // actually present against a loudness-normalised YouTube track.
    var lvl = function (v, dflt) {
      v = Number(v);
      return (v === v && v >= 0 && v <= 100) ? v : dflt;
    };
    var legacy = lvl(saved.master, null);
    state.musicLevel = lvl(saved.musicLevel, legacy !== null ? legacy : 52);
    state.roomLevel  = lvl(saved.roomLevel,  legacy !== null ? Math.min(100, legacy + 10) : 62);
    state.values = mix(saved.values || {});
    state.muted = saved.muted || {};
    state.activePreset = saved.activePreset || null;
    state.savedRoom = saved.savedRoom || null;
    state.weather = WEATHERS.indexOf(saved.weather) >= 0 ? saved.weather : "none";
    state.weatherIntensity = Math.max(10, Math.min(100, Number(saved.weatherIntensity) || 48));
    state.drift = Boolean(saved.drift);
    state.source = saved.source || null;
    state.savedSources = (Array.isArray(saved.savedSources) ? saved.savedSources : [])
      .filter(function (x) { return x && x.id && (x.kind === "video" || x.kind === "playlist"); })
      .slice(0, SAVED_SOURCE_MAX);
    state.rotate = ["time","interval","off"].indexOf(saved.rotate) >= 0 ? saved.rotate : "time";
    state.galleryIndex = Math.max(0, Number(saved.galleryIndex) || 0);
    state.trackIndex = Math.max(0, Number(saved.trackIndex) || 0);
    // A saved "Your source" world is meaningless without a source.
    if (worlds[state.worldIndex].kind === "youtube" && !state.source) state.worldIndex = 0;
    if (worlds[state.worldIndex].kind === "gallery") state.worldIndex = 0;  // re-enabled once the manifest loads
    if (worlds[state.worldIndex].blocked) state.worldIndex = 0;
  }

  /* ---------- toast ---------- */

  function toast(message, duration) {
    $("#toastText").textContent = message;
    $("#toast").classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $("#toast").classList.remove("is-on"); }, duration || 3400);
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- scene: real crossfade across two <video> elements ---------- */

  function paintWorld() {
    var w = worlds[state.worldIndex];
    var poster = w.poster ||
      (w.kind === "backdrop" ? ytPoster(w.videoId) : "") ||
      (state.source ? ytPoster(state.source.id) : "");
    $("#sceneTitle").textContent = w.title;
    $("#sceneKind").textContent = w.kind === "youtube" ? "Tuned source"
      : w.kind === "gallery" ? "Pixel art"
      : w.kind === "backdrop" ? "Video backdrop"
      : w.pixel ? "Pixel art" : "Living loop";
    $("#channelChip").textContent = "CH " + (state.worldIndex + 1 < 10 ? "0" : "") + (state.worldIndex + 1);
    $("#dockWorldTitle").textContent = w.title;
    $("#worldButton").setAttribute("aria-label", "Scene selector: " + w.title);
    if (poster) {
      $("#sceneThumb").style.backgroundImage = "url('" + poster + "')";
      $("#scenePoster").style.backgroundImage = "url('" + poster + "')";
    }
    world.classList.toggle("pixel", !!w.pixel);
    if (window.PixelScene) PixelScene.setRamp(w.pixel ? w.ramp : null);   // null => untouched
    renderWorlds();
  }

  function ytPoster(id) { return "https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg"; }

  function loadGallery() {
    fetch("assets/wallpapers/manifest.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        var list = (m && m.scenes) || [];
        state.gallery = list.filter(function (s) { return s && s.file; }).map(function (s) {
          return { src: "assets/wallpapers/" + s.file,
                   label: s.label || s.file.replace(/\.[a-z0-9]+$/i, ""),
                   timeOfDay: s.timeOfDay || "any",
                   // Parsed but never rendered before. The shipped art is
                   // CC-BY, which requires attribution wherever the work
                   // appears — so the credit has to reach the screen.
                   credit: s.credit || "" };
        });
        renderWorlds();
        if (worlds[state.worldIndex].kind === "gallery") showGallery(false);
      })
      .catch(function () { state.gallery = []; renderWorlds(); });
  }

  // Pick by part of day when possible, else just advance.
  function pickGalleryScene() {
    if (!state.gallery.length) return null;
    if (state.rotate === "time") {
      var want = partOfDay(new Date().getHours());
      var matches = state.gallery.filter(function (s) { return s.timeOfDay === want; });
      if (matches.length) return matches[Math.floor(Math.random() * matches.length)];
    }
    state.galleryIndex = (state.galleryIndex + 1) % state.gallery.length;
    return state.gallery[state.galleryIndex];
  }

  function showGallery(animate) {
    var scene = pickGalleryScene();
    if (!scene) return false;
    if (window.PixelScene) {
      PixelScene.setRamp(null);
      PixelScene.showArt(scene.src, scene.label, animate === false ? 0 : 640);
    }
    $("#sceneKind").textContent = scene.label;
    scheduleRotate();
    return true;
  }

  function scheduleRotate() {
    clearTimeout(state.rotateTimer);
    if (worlds[state.worldIndex].kind !== "gallery") return;
    if (state.rotate === "off" || state.gallery.length < 2) return;
    // Under reduced motion the scene still changes, it just does not fade.
    state.rotateTimer = setTimeout(function () { showGallery(true); }, ROTATE_MS);
  }

  function showLocalWorld(w, animate) {
    var next = (liveVideo + 1) % 2;
    var incoming = videos[next], outgoing = videos[liveVideo];
    $("#youtubeWrap").classList.remove("is-live");

    function reveal() {
      incoming.classList.add("is-live");
      outgoing.classList.remove("is-live");
      liveVideo = next;
      if (state.playing) { var p = incoming.play(); if (p && p.catch) p.catch(function () {}); }
      if (window.PixelScene) {
        if (w.pixel) {
          PixelScene.crossfadeTo(incoming, animate && !reduceMotion.matches ? 640 : 0);
          PixelScene.start();
        } else {
          // Crisp channel: the video element is the scene. Stop the 30fps
          // draw loop rather than leaving it running behind an opaque video.
          PixelScene.setPlaying(false);
        }
      }
      setTimeout(function () {
        if (!state.playing || outgoing !== videos[liveVideo]) outgoing.pause();
      }, animate && !reduceMotion.matches ? 700 : 40);
    }

    if (incoming.getAttribute("src") === w.video && incoming.readyState >= 2) { reveal(); return; }
    incoming.setAttribute("src", w.video);
    incoming.load();
    // Wait for a real frame before fading, so a world change never shows black.
    var done = false;
    function ready() { if (done) return; done = true; reveal(); }
    incoming.addEventListener("loadeddata", ready, { once: true });
    incoming.addEventListener("error", function () {
      if (done) return; done = true;
      toast("That scene could not load. Staying where you are.");
    }, { once: true });
    setTimeout(ready, 2500);   // never hang on a slow network
  }

  function setWorld(index, announce) {
    if (!worlds[index]) return;
    var w = worlds[index];
    if (w.kind === "youtube" && (!state.source || state.ytFailed)) {
      toast("Tune in a source first, then this scene becomes available.");
      return;
    }
    if (w.kind === "gallery" && !state.gallery.length) {
      toast("Add pixel art to assets/wallpapers to use the gallery.");
      return;
    }
    if (w.kind === "backdrop" && w.blocked) {
      toast("That backdrop is no longer embeddable. Pick another scene.");
      return;
    }
    if (index === state.worldIndex) { closeSurface(); return; }
    state.worldIndex = index;
    paintWorld();
    clearTimeout(state.rotateTimer);
    if (w.kind === "gallery") {
      videos[liveVideo].pause();
      $("#youtubeWrap").classList.remove("is-live");
      hideBackdrop();
      showGallery(true);
    } else if (w.kind === "backdrop") {
      videos[liveVideo].classList.remove("is-live");
      videos[liveVideo].pause();
      $("#youtubeWrap").classList.remove("is-live");
      if (window.PixelScene) PixelScene.hideCanvas();
      setBackdrop(w);
    } else if (w.kind === "youtube") {
      videos[liveVideo].classList.remove("is-live");
      videos[liveVideo].pause();
      hideBackdrop();
      // The canvas used to stay live here, still painting whichever local
      // video was loaded last — so "Your source" showed a pixelated garden
      // loop sitting on top of the video you had actually tuned. The iframe
      // is the only thing that can honestly show a cross-origin source.
      if (window.PixelScene) PixelScene.hideCanvas();
      if (state.ytReady) $("#youtubeWrap").classList.add("is-live");
    } else {
      $("#youtubeWrap").classList.remove("is-live");
      hideBackdrop();
      if (window.PixelScene) {
        if (w.pixel) PixelScene.showVideo(); else PixelScene.hideCanvas();
      }
      showLocalWorld(w, true);
    }
    persist();
    closeSurface();
    if (announce !== false) toast(w.title + " is now your scene. Music and room stayed put.");
  }

  function renderWorlds() {
    // Derived, not written by hand: this label said "four channels" through
    // two commits that changed how many there are.
    var count = $("#worldPanelCount");
    if (count) count.textContent = "Source · " + worlds.length + " channels";
    var credits = $("#sceneCredits");
    if (credits) {
      var lines = state.gallery.map(function (g) { return g.credit; }).filter(Boolean);
      credits.hidden = lines.length === 0;
      credits.textContent = lines.length ? "Scene art: " + lines.join(" · ") : "";
    }
    $("#worldGrid").innerHTML = worlds.map(function (w, i) {
      var unavailable = (w.kind === "youtube" && (!state.source || state.ytFailed)) ||
                        (w.kind === "gallery" && !state.gallery.length) ||
                        (w.kind === "backdrop" && w.blocked);
      var poster = w.poster ||
                   (w.kind === "backdrop" ? ytPoster(w.videoId) : "") ||
                   (w.kind === "gallery" && state.gallery.length ? state.gallery[0].src : "") ||
                   (w.kind === "youtube" && state.source ? ytPoster(state.source.id) : "");
      var kind = unavailable
        ? (w.kind === "gallery" ? "no art added"
        : (w.kind === "backdrop" ? "embedding blocked" : "unavailable"))
        : (w.kind === "gallery" ? state.gallery.length + (state.gallery.length === 1 ? " scene" : " scenes")
        : (w.kind === "youtube" ? "tuned source"
        : (w.kind === "backdrop" ? "video backdrop"
        : (w.pixel ? "pixel art" : "living loop"))));
      return '<button class="world-card" data-world="' + i + '" style="--i:' + i + '"' +
        ' aria-current="' + (i === state.worldIndex) + '"' + (unavailable ? " disabled" : "") + '>' +
        '<span class="world-card-screen" style="background-image:url(\'' + poster + '\')">' +
          '<span class="world-card-tag">CH ' + (i + 1 < 10 ? "0" : "") + (i + 1) + '</span>' +
        '</span>' +
        '<span class="world-card-copy"><strong>' + w.title + '</strong><small>' + w.note + '</small></span>' +
        '<span class="world-card-kind">' + kind + '</span>' +
      '</button>';
    }).join("");
  }

  /* ---------- tuner: the source is whatever the user gives us ---------- */

  function parseSource(raw) {
    var text = String(raw || "").trim();
    if (!text) return null;
    var list = text.match(/[?&]list=([A-Za-z0-9_-]{12,})/);
    if (list) return { kind: "playlist", id: list[1] };
    var v = text.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
            text.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
            text.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    if (v) return { kind: "video", id: v[1] };
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return { kind: "video", id: text };
    if (/^(PL|OLAK5uy_|RD|UU|FL)[A-Za-z0-9_-]{10,}$/.test(text)) return { kind: "playlist", id: text };
    return null;
  }

  function setSource(source, announce) {
    state.source = source;
    state.ytFailed = false;
    state.ytReady = false;
    state.trackIndex = 0;
    state.tracks = [];
    if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) {} ytPlayer = null; }
    $("#sourceNotice").hidden = true;
    $("#tunerError").hidden = true;
    persist();
    paintTuner();
    paintWorld();
    loadYouTubeApi();
    if (announce !== false) toast("Tuning in " + source.label + "…");
  }

  function sourceFailed(code) {
    if (state.ytFailed) return;
    var wasStation = state.source && state.source.station;

    // Self-heal: if a curated station is blocked, quietly try the next one
    // before bothering the user. This is the failure that broke the old build.
    if (wasStation && state.stationIndex < STATIONS.length - 1) {
      state.stationIndex += 1;
      var next = STATIONS[state.stationIndex];
      if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) {} ytPlayer = null; }
      state.ytReady = false;
      clearTimeout(ytFailTimer);
      state.source = { kind: "video", id: next.id, label: next.label, station: true };
      state.tracks = [];
      persist();
      paintTuner();
      loadYouTubeApi();
      return;
    }

    state.ytFailed = true;
    state.ytReady = false;
    clearTimeout(ytFailTimer);
    $("#youtubeWrap").classList.remove("is-live");
    if (worlds[state.worldIndex].kind === "youtube") {
      state.worldIndex = 0;
      paintWorld();
      showLocalWorld(worlds[0], true);
      persist();
    }
    var msg = sourceMessage(code);
    $("#noticeTitle").textContent = msg.title;
    $("#noticeBody").textContent = msg.body;
    // Even a blocked video has a working path to the content.
    var link = $("#noticeOpen");
    if (link && state.source) {
      link.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(state.source.id);
      link.hidden = false;
    }
    $("#sourceNotice").hidden = false;
    paintTuner();
    paintWorld();
    toast(msg.title + ". Your room ambience still works.", 5200);
  }

  // Backdrop channels need the iframe API too, so loading it can no longer be
  // conditional on there being a music source. Callers queue up and are called
  // back once, in order, when the API is ready.
  var ytApiWaiting = [];
  function ensureYouTubeApi(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    if (cb) ytApiWaiting.push(cb);
    if (state.ytApiLoading) return;
    state.ytApiLoading = true;
    var el = document.createElement("script");
    el.src = "https://www.youtube.com/iframe_api";
    el.async = true;
    el.onerror = function () {
      state.ytApiLoading = false;
      ytApiWaiting.length = 0;
      if (state.source) sourceFailed(null);
      else toast("YouTube could not be reached. Your room and scene still work.");
    };
    document.head.appendChild(el);
    window.onYouTubeIframeAPIReady = function () {
      var q = ytApiWaiting; ytApiWaiting = [];
      q.forEach(function (f) { try { f(); } catch (e) {} });
    };
  }

  function loadYouTubeApi() {
    if (!state.source) return;
    ensureYouTubeApi(createPlayer);
    // The old build had no path for "the API never answers" — it sat forever
    // on a stretched thumbnail with working-looking controls.
    clearTimeout(ytFailTimer);
    ytFailTimer = setTimeout(function () {
      if (!state.ytReady) sourceFailed(null);
    }, 12000);
  }

  function createPlayer() {
    if (!state.source || ytPlayer) return;
    var vars = {
      autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
      modestbranding: 1, playsinline: 1, rel: 0,
      origin: location.origin
    };
    var config = { playerVars: vars, events: {
      onReady: function (e) {
        // An embed-blocked video still fires onReady — it reports
        // isPlayable:false with errorCode "auth" and a 0 duration, and only
        // then fires onError. Checking here closes the window in which the
        // interface looked functional for a source that cannot play.
        var vd = {};
        try { vd = e.target.getVideoData() || {}; } catch (err) {}
        if (vd.isPlayable === false) { sourceFailed(vd.errorCode === "auth" ? 150 : null); return; }

        state.ytReady = true; state.ytFailed = false;
        clearTimeout(ytFailTimer);
        try { e.target.setVolume(Math.round(state.musicLevel * 0.8)); } catch (err) {}

        if (state.source.kind === "playlist") {
          var ids = [];
          try { ids = e.target.getPlaylist() || []; } catch (err) {}
          state.tracks = ids.map(function (_, i) { return { title: "Track " + (i + 1), subtitle: "" }; });
          refreshCurrentTrackTitle();
        } else {
          state.tracks = [{ title: vd.title || state.source.label, subtitle: "" }];
        }
        $("#sourceNotice").hidden = true;
        paintTuner();
        paintWorld();
        if (worlds[state.worldIndex].kind === "youtube") $("#youtubeWrap").classList.add("is-live");
        if (state.playing) { try { e.target.playVideo(); } catch (err) {} }
      },
      onStateChange: function (e) {
        if (e.data === 1) {
          state.ytFailed = false;
          refreshCurrentTrackTitle();
          if (worlds[state.worldIndex].kind === "youtube") $("#youtubeWrap").classList.add("is-live");
        }
      },
      onError: function (e) { sourceFailed(e && e.data); }
    } };
    if (state.source.kind === "playlist") {
      vars.listType = "playlist"; vars.list = state.source.id;
    } else {
      config.videoId = state.source.id;
    }
    try { ytPlayer = new YT.Player("youtubePlayer", config); }
    catch (e) { sourceFailed(5); }
  }

  /* ---------- backdrop channels: video wallpaper, always muted ---------- */

  var bdPlayer = null, bdVideoId = null;

  function backdropFailed(w, code) {
    w.blocked = true;
    $("#backdropWrap").classList.remove("is-live");
    toast(w.title + " will not play here — the uploader blocked embedding. Trying another scene.");
    renderWorlds();
    // Fall back to a scene that cannot rot: a local file.
    var next = 0;
    setWorld(next, false);
  }

  function setBackdrop(w) {
    var wrap = $("#backdropWrap");
    ensureYouTubeApi(function () {
      if (worlds[state.worldIndex] !== w) return;      // user moved on while loading
      if (bdPlayer && bdVideoId === w.videoId) {
        wrap.classList.add("is-live");
        try { bdPlayer.mute(); bdPlayer.playVideo(); } catch (e) {}
        return;
      }
      if (bdPlayer) { try { bdPlayer.destroy(); } catch (e) {} bdPlayer = null; }
      $("#backdropWrap").innerHTML = '<div id="backdropPlayer"></div>';
      bdVideoId = w.videoId;
      try {
        bdPlayer = new YT.Player("backdropPlayer", {
          videoId: w.videoId,
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
            modestbranding: 1, playsinline: 1, rel: 0, mute: 1,
            // YouTube only loops a single video if it is also named as the
            // playlist; loop:1 alone does nothing.
            loop: 1, playlist: w.videoId,
            origin: location.origin
          },
          events: {
            onReady: function (e) {
              var d = {};
              try { d = e.target.getVideoData() || {}; } catch (err) {}
              if (d.isPlayable === false) { backdropFailed(w, 150); return; }
              // Wallpaper never makes sound. The tuner and the room own the
              // audio; a backdrop competing with them is the exact collision
              // the three independent layers exist to prevent.
              try { e.target.mute(); e.target.playVideo(); } catch (err) {}
              if (worlds[state.worldIndex] === w) wrap.classList.add("is-live");
            },
            onError: function (e) { backdropFailed(w, e && e.data); }
          }
        });
      } catch (e) { backdropFailed(w, 5); }
    });
  }

  function hideBackdrop() {
    $("#backdropWrap").classList.remove("is-live");
    if (bdPlayer) { try { bdPlayer.pauseVideo(); } catch (e) {} }
  }

  function refreshCurrentTrackTitle() {
    if (!ytPlayer || !state.tracks.length) return;
    try {
      if (state.source.kind === "playlist") {
        var i = ytPlayer.getPlaylistIndex();
        if (i >= 0 && i < state.tracks.length) {
          state.trackIndex = i;
          var d = ytPlayer.getVideoData() || {};
          if (d.title) state.tracks[i] = { title: d.title, subtitle: "" };
        }
      }
    } catch (e) {}
    paintTuner();
  }

  function currentTrack() { return state.tracks[state.trackIndex] || null; }

  function paintTuner() {
    var t = currentTrack();
    var hasSource = Boolean(state.source) && !state.ytFailed;
    var label = !state.source ? "No source tuned"
              : state.ytFailed ? "Room ambience only"
              : (t ? t.title : state.source.label);
    $("#dockSongTitle").textContent = label;
    $("#musicButton").setAttribute("aria-label",
      hasSource ? "Music source: " + label : "No music source — open the tuner");
    $("#musicPanelDescription").textContent = !state.source
      ? "Tune in any YouTube video or playlist. Your scene and room stay put."
      : state.ytFailed
      ? "This source will not play here. Your scene and room are untouched."
      : "Playing " + state.source.label + ". Your scene and room stay put.";

    // The skip keys used to be disabled for any single-video source, which is
    // every one of the default stations — so on a 1 h 55 m mix the only working
    // transport control was play/pause. They now seek when there is no
    // playlist to step through, and the labels say which they are doing.
    var mode = transportMode();
    $("#previousButton").disabled = mode === "none";
    $("#nextButton").disabled = mode === "none";
    $("#previousButton").setAttribute("aria-label",
      mode === "seek" ? "Back " + SEEK_SECONDS + " seconds" : "Previous track");
    $("#nextButton").setAttribute("aria-label",
      mode === "seek" ? "Forward " + SEEK_SECONDS + " seconds" : "Next track");
    $("#tuner").hidden = false;
    renderStations();
    $("#tunerHint").textContent = state.source && !state.ytFailed
      ? "Tuned to " + state.source.label + ". Paste another link to change it."
      : "Paste a link, or start with the suggested station below.";
    renderTracks();
  }

  var SAVED_SOURCE_MAX = 12;

  function sameSource(a, b) {
    return Boolean(a && b) && a.id === b.id && a.kind === b.kind;
  }

  // One row shape for both lists. `remove` adds the little discard button that
  // only a user-saved entry gets.
  function sourceRow(item, i, live, remove) {
    return '<div class="station-row' + (live ? " is-live" : "") + '">' +
      '<button class="station" data-tune="' + i + '" aria-current="' + live + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-radio"/></svg>' +
        '<span class="station-copy"><strong>' + escapeHtml(item.label) + '</strong>' +
        '<small>' + escapeHtml(item.note || (item.kind === "playlist" ? "Playlist" : "Video")) +
        (live ? " · on air" : "") + '</small></span>' +
      '</button>' +
      (remove ? '<button class="hw hw-icon station-drop" data-drop="' + i + '"' +
                ' aria-label="Remove ' + escapeHtml(item.label) + ' from saved">' +
                '<svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>' : '') +
    '</div>';
  }

  function renderStations() {
    var host = $("#stationList");
    if (host) {
      host.innerHTML = STATIONS.map(function (st, i) {
        return sourceRow({ label: st.label, note: st.note + " · third-party upload", kind: "video" },
                         i, sameSource(state.source, { id: st.id, kind: "video" }), false);
      }).join("");
    }
    var saveBtn = $("#saveSourceButton");
    if (saveBtn) {
      var already = state.savedSources.some(function (x) { return sameSource(x, state.source); });
      saveBtn.disabled = !state.source || state.ytFailed || already;
      var lbl = saveBtn.querySelector("span");
      if (lbl) lbl.textContent = already ? "Saved" : "Save this source";
    }
    var sec = $("#savedSourceSection"), list = $("#savedSourceList");
    if (sec && list) {
      sec.hidden = state.savedSources.length === 0;
      list.innerHTML = state.savedSources.map(function (x, i) {
        return sourceRow(x, i, sameSource(state.source, x), true);
      }).join("");
    }
  }

  function saveCurrentSource() {
    if (!state.source || state.ytFailed) return;
    if (state.savedSources.some(function (x) { return sameSource(x, state.source); })) return;
    state.savedSources.unshift({ kind: state.source.kind, id: state.source.id,
                                 label: state.source.label,
                                 note: state.source.kind === "playlist" ? "Playlist" : "Video" });
    state.savedSources = state.savedSources.slice(0, SAVED_SOURCE_MAX);
    writeState();                       // a save is deliberate: do not debounce
    renderStations();
    toast("Saved. It is in your tuner on this device.");
  }

  function removeSavedSource(i) {
    var gone = state.savedSources[i];
    if (!gone) return;
    state.savedSources.splice(i, 1);
    writeState();
    renderStations();
    toast("Removed " + gone.label + " from saved.");
  }

  function renderTracks() {
    var host = $("#trackList");
    if (!state.tracks.length || state.ytFailed) { host.innerHTML = ""; return; }
    host.innerHTML = state.tracks.map(function (t, i) {
      return '<button class="list-row" data-track="' + i + '" style="--i:' + (i % 12) + '"' +
        ' aria-current="' + (i === state.trackIndex) + '">' +
        '<span class="list-num">' + (i + 1 < 10 ? "0" : "") + (i + 1) + '</span>' +
        '<span class="list-copy"><strong>' + escapeHtml(t.title) + '</strong>' +
        (t.subtitle ? '<small>' + escapeHtml(t.subtitle) + '</small>' : '') + '</span>' +
      '</button>';
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var SEEK_SECONDS = 30;

  // "track" when there is a playlist to step through, "seek" for a single
  // video — which is the common case, since the curated stations are one
  // long video each.
  function transportMode() {
    if (!state.source || state.ytFailed) return "none";
    return state.tracks.length > 1 ? "track" : "seek";
  }

  function seekBy(delta) {
    if (!ytPlayer || !state.ytReady) return;
    try {
      var at = ytPlayer.getCurrentTime();
      if (typeof at !== "number" || at !== at) return;
      var dur = Number(ytPlayer.getDuration()) || 0;
      // Stop a forward seek landing past the end, which ends the video.
      var to = at + delta;
      if (dur > 1) to = Math.min(dur - 1, to);
      to = Math.max(0, to);
      ytPlayer.seekTo(to, true);
      if (!state.playing) playAll();
      toast((delta < 0 ? "Back " : "Forward ") + Math.abs(delta) + " seconds");
    } catch (e) {}
  }

  function transportStep(dir) {
    var mode = transportMode();
    if (mode === "none") return;
    if (mode === "track") selectTrack(state.trackIndex + dir);
    else seekBy(dir * SEEK_SECONDS);
  }

  function selectTrack(index, announce) {
    if (!state.source || state.ytFailed || !state.tracks.length) return;
    var n = (index + state.tracks.length) % state.tracks.length;
    state.trackIndex = n;
    ignoreWatchUntil = Date.now() + 2500;
    if (ytPlayer && state.ytReady) {
      try {
        if (state.source.kind === "playlist") ytPlayer.playVideoAt(n);
        else ytPlayer.playVideo();
        // Picking a track is a play gesture like any other, so it has to go
        // through playAll — setting state.playing here on its own lit the
        // pause icon while the room stayed silent and the scene stayed frozen.
        if (state.playing) reflectPlaying(); else playAll();
      } catch (e) {}
    }
    paintTuner();
    persist();
    if (announce !== false) toast(state.tracks[n].title);
  }

  /* ---------- transport ---------- */

  function reflectPlaying() {
    world.classList.toggle("playing", state.playing);
    $("#playButton").setAttribute("aria-pressed", String(state.playing));
    $("#playButton").setAttribute("aria-label", state.playing ? "Pause" : "Play");
  }

  function playAll() {
    state.playing = true;
    reflectPlaying();
    AmbienceEngine.start().then(function () { AmbienceEngine.setMaster(state.roomLevel); pushMix(); });
    startMeters();
    if (worlds[state.worldIndex].kind === "local" && !reduceMotion.matches) {
      var p = videos[liveVideo].play(); if (p && p.catch) p.catch(function () {});
    }
    if (window.PixelScene) PixelScene.setPlaying(true);
    if (ytPlayer && state.ytReady && !state.ytFailed) { try { ytPlayer.playVideo(); } catch (e) {} }
    else if (!state.source) toast("Room ambience is playing. Tune in a source for music.");
  }

  function pauseAll() {
    state.playing = false;
    reflectPlaying();
    AmbienceEngine.stop();
    stopMeters();
    videos.forEach(function (v) { v.pause(); });
    if (window.PixelScene) PixelScene.setPlaying(false);
    if (ytPlayer && state.ytReady) { try { ytPlayer.pauseVideo(); } catch (e) {} }
  }

  function togglePlay() { state.playing ? pauseAll() : playAll(); }

  /* ---------- room ---------- */

  function pushMix() {
    roomLayers.forEach(function (l) {
      AmbienceEngine.setLayer(l.id, state.values[l.id], Boolean(state.muted[l.id]));
    });
  }

  // The engine gates every layer's gain on `running`, and the AudioContext is
  // only created on the first Play — so a fader moved before that was written
  // to state and then silently multiplied by zero. Any deliberate room gesture
  // now brings the engine up, whenever it is not already running.
  //
  // This deliberately has no "only once" guard. An earlier version only woke
  // the room if it had never started, which meant that after any pause the
  // faders went silent again permanently — the same bug one step later.
  //
  // The room is its own layer, so this starts the room and nothing else: the
  // music stays paused and the scene is untouched. Because that leaves the
  // transport reading "play" while sound is coming out, it says so once.
  var roomWaking = false;
  function wakeRoom() {
    if (state.playing || roomWaking || AmbienceEngine.running) return;
    roomWaking = true;
    AmbienceEngine.start().then(function () {
      roomWaking = false;
      AmbienceEngine.setMaster(state.roomLevel);
      pushMix();
      startMeters();
    }, function () { roomWaking = false; });
    toast(state.source ? "Room ambience is playing. The music is still paused."
                       : "Room ambience is playing.");
  }

  function renderPresets() {
    $("#presetList").innerHTML = presets.map(function (p, i) {
      return '<button class="preset" data-preset="' + p.id + '" style="--i:' + i + '"' +
        ' aria-current="' + (state.activePreset === p.id) + '">' +
        '<span><strong>' + p.title + '</strong><small>' + p.note + '</small></span></button>';
    }).join("");
  }

  function renderChannels() {
    $("#channelGrid").innerHTML = roomLayers.map(function (l, i) {
      var v = state.values[l.id], m = Boolean(state.muted[l.id]);
      return '<div class="channel' + (v > 0 && !m ? " is-live" : "") + '" data-channel="' + l.id + '" style="--i:' + i + '">' +
        '<div class="channel-top">' +
          '<span class="channel-icon"><svg class="icon"><use href="#' + l.icon + '"/></svg></span>' +
          '<span class="channel-name"><strong>' + l.name + '</strong><small>' + l.note + '</small></span>' +
          '<output id="out-' + l.id + '" aria-live="off">' + (m ? "muted" : v + "%") + '</output>' +
        '</div>' +
        '<div class="channel-meter-row"><span class="meter" aria-hidden="true">' +
          '<span class="meter-fill" id="meter-' + l.id + '"></span></span></div>' +
        '<div class="channel-bottom">' +
          '<button class="mute' + (m ? " is-muted" : "") + '" data-mute="' + l.id + '"' +
            ' aria-label="' + (m ? "Unmute " : "Mute ") + l.name + '">' +
            '<svg class="icon"><use href="#' + (m ? "i-speaker-slash" : "i-speaker-simple-low") + '"/></svg></button>' +
          '<input type="range" min="0" max="100" value="' + v + '" data-layer="' + l.id + '"' +
            ' aria-label="' + l.name + ' level" style="--fill:' + v + '%">' +
        '</div>' +
      '</div>';
    }).join("");
  }

  function setLayerValue(id, raw, fromUser) {
    var v = Math.max(0, Math.min(100, Math.round(Number(raw))));
    state.values[id] = v;
    if (fromUser && v > 0 && state.muted[id]) state.muted[id] = false;
    if (fromUser) { state.activePreset = null; wakeRoom(); }
    AmbienceEngine.setLayer(id, v, Boolean(state.muted[id]));

    var ch = document.querySelector('[data-channel="' + id + '"]');
    var input = document.querySelector('[data-layer="' + id + '"]');
    var out = document.getElementById("out-" + id);
    if (ch) ch.classList.toggle("is-live", v > 0 && !state.muted[id]);
    if (input) { input.value = v; input.style.setProperty("--fill", v + "%"); }
    if (out) out.textContent = state.muted[id] ? "muted" : v + "%";
    if (fromUser) renderPresets();
    persist();
  }

  function toggleMute(id) {
    state.muted[id] = !state.muted[id];
    state.activePreset = null;
    wakeRoom();
    AmbienceEngine.setLayer(id, state.values[id], Boolean(state.muted[id]));
    renderChannels(); renderPresets(); persist();
  }

  function applyPreset(id, announce) {
    var p = null;
    for (var i = 0; i < presets.length; i++) if (presets[i].id === id) p = presets[i];
    if (!p) return;
    state.muted = {};
    state.values = mix(p.values);
    state.activePreset = p.id;
    wakeRoom();
    pushMix();
    renderChannels(); renderPresets(); persist();
    if (announce !== false) toast(p.title + " changed the room. Your scene and music stayed put.");
  }

  function surprise() {
    var pool = presets.filter(function (p) { return p.id !== state.activePreset; });
    var pick = pool[Math.floor(Math.random() * pool.length)] || presets[0];
    applyPreset(pick.id, false);
    toast("Surprise: " + pick.title + ". Scene and music unchanged.");
  }

  function saveRoom() {
    state.savedRoom = { values: mix(state.values), muted: JSON.parse(JSON.stringify(state.muted)) };
    $("#savedRoomButton").disabled = false;
    $("#savedRoomHint").textContent = "Ready whenever you return";
    writeState();
    if (state.playing) AmbienceEngine.chime();
    toast("Your mix is saved on this device.");
  }

  function loadSavedRoom() {
    if (!state.savedRoom) return;
    state.values = mix(state.savedRoom.values);
    state.muted = JSON.parse(JSON.stringify(state.savedRoom.muted || {}));
    state.activePreset = null;
    wakeRoom();
    pushMix(); renderChannels(); renderPresets(); persist();
    toast("Your saved mix is back. Scene and music unchanged.");
  }

  function toggleDrift(announce) {
    state.drift = !state.drift;
    $("#driftButton").setAttribute("aria-checked", String(state.drift));
    clearInterval(state.driftTimer);
    if (state.drift) {
      state.driftTimer = setInterval(function () {
        roomLayers.forEach(function (l) {
          var v = state.values[l.id];
          if (v > 0 && !state.muted[l.id]) setLayerValue(l.id, v + (Math.random() * 4 - 2), false);
        });
      }, 28000);
    }
    if (announce) toast(state.drift ? "Drift is on. Only room levels will move." : "Drift is off.");
    persist();
  }

  /* ---------- LED meters — one shared 10fps loop, not 12 analysers ---------- */

  function startMeters() {
    if (meterTimer) return;
    meterTimer = setInterval(function () {
      for (var i = 0; i < roomLayers.length; i++) {
        var el = document.getElementById("meter-" + roomLayers[i].id);
        if (!el) continue;
        el.style.setProperty("--lvl", Math.round(AmbienceEngine.getLevel(roomLayers[i].id) * 100) + "%");
      }
    }, 100);
  }
  function stopMeters() {
    clearInterval(meterTimer); meterTimer = null;
    roomLayers.forEach(function (l) {
      var el = document.getElementById("meter-" + l.id);
      if (el) el.style.setProperty("--lvl", "0%");
    });
  }

  /* ---------- weather — the loop only exists while it is switched on ----------
     The old build cleared a 2560x1440 canvas every frame forever, because the
     "none" check happened after the clear and "none" is the default.        */

  var weather = { canvas: null, ctx: null, particles: [], frame: null, w: 0, h: 0, resizeQueued: false };

  function weatherActive() { return state.weather !== "none" && !reduceMotion.matches; }

  function sizeWeather() {
    if (!weather.canvas) return;
    var ratio = Math.min(1.5, window.devicePixelRatio || 1);
    weather.w = window.innerWidth; weather.h = window.innerHeight;
    weather.canvas.width = Math.round(weather.w * ratio);
    weather.canvas.height = Math.round(weather.h * ratio);
    weather.canvas.style.width = weather.w + "px";
    weather.canvas.style.height = weather.h + "px";
    weather.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    seedParticles();
  }

  function seedParticles() {
    if (!weatherActive()) { weather.particles = []; return; }
    var n = Math.round((state.weatherIntensity / 100) * (state.weather === "rain" ? 110 : 56));
    weather.particles = [];
    for (var i = 0; i < n; i++) weather.particles.push(makeParticle(true));
  }

  function makeParticle(anywhere) {
    var x = Math.random() * weather.w;
    if (state.weather === "rain") {
      return { x: x, y: anywhere ? Math.random() * weather.h : -20,
               speed: 8 + Math.random() * 8, len: 8 + Math.random() * 18, alpha: .12 + Math.random() * .24 };
    }
    if (state.weather === "snow") {
      return { x: x, y: anywhere ? Math.random() * weather.h : -12,
               speed: .35 + Math.random() * .85, r: 1 + Math.random() * 2.4,
               drift: Math.random() * 1.4 - .7, alpha: .2 + Math.random() * .5 };
    }
    return { x: x, y: anywhere ? Math.random() * weather.h : weather.h + 10,
             speed: .12 + Math.random() * .34, r: 1.2 + Math.random() * 2,
             drift: Math.random() * 1.2 - .6, phase: Math.random() * Math.PI * 2 };
  }

  function drawWeather() {
    if (!weatherActive()) { stopWeather(); return; }
    var c = weather.ctx, now = Date.now();
    c.clearRect(0, 0, weather.w, weather.h);
    for (var i = 0; i < weather.particles.length; i++) {
      var p = weather.particles[i];
      if (state.weather === "rain") {
        c.strokeStyle = "rgba(237,230,214," + p.alpha + ")";
        c.lineWidth = .7;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y + p.len); c.stroke();
        p.y += p.speed; p.x -= .5;
        if (p.y > weather.h + 30) weather.particles[i] = makeParticle(false);
      } else if (state.weather === "snow") {
        c.fillStyle = "rgba(245,240,228," + p.alpha + ")";
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        p.y += p.speed; p.x += p.drift;
        if (p.y > weather.h + 10) weather.particles[i] = makeParticle(false);
      } else {
        var glow = .25 + (Math.sin(now / 700 + p.phase) + 1) * .2;
        c.shadowBlur = 9; c.shadowColor = "rgba(240,169,60,.75)";
        c.fillStyle = "rgba(240,169,60," + glow + ")";
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
        p.y -= p.speed; p.x += Math.sin(now / 1000 + p.phase) * p.drift;
        if (p.y < -10) weather.particles[i] = makeParticle(false);
      }
    }
    weather.frame = requestAnimationFrame(drawWeather);
  }

  function startWeather() {
    if (!weatherActive() || weather.frame !== null) return;
    if (!weather.canvas) { weather.canvas = $("#weatherCanvas"); weather.ctx = weather.canvas.getContext("2d"); }
    sizeWeather();
    weather.frame = requestAnimationFrame(drawWeather);
  }

  function stopWeather() {
    if (weather.frame !== null) { cancelAnimationFrame(weather.frame); weather.frame = null; }
    if (weather.ctx) weather.ctx.clearRect(0, 0, weather.w, weather.h);
    // Release the backing store so an idle canvas costs nothing.
    if (weather.canvas) { weather.canvas.width = 0; weather.canvas.height = 0; }
    weather.particles = [];
  }

  function setWeather(type, announce) {
    state.weather = WEATHERS.indexOf(type) >= 0 ? type : "none";
    var i = WEATHERS.indexOf(state.weather);
    $("#weatherOptions").style.setProperty("--seg-i", i);
    $("#weatherValue").textContent = state.weather === "none"
      ? "Off" : state.weather.charAt(0).toUpperCase() + state.weather.slice(1);
    $$("[data-weather]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.weather === state.weather));
    });
    if (weatherActive()) startWeather(); else stopWeather();
    persist();
    if (announce) toast(state.weather === "none" ? "Weather off." : "Weather: " + state.weather + ".");
  }

  /* ---------- focus / sleep timer ---------- */

  function tickFocus() {
    if (!state.focusEndsAt) return;
    var left = Math.max(0, Math.ceil((state.focusEndsAt - Date.now()) / 1000));
    $("#focusCountdown").textContent = formatTime(left);
    if (left <= 0) endFocus(true);
  }

  function startFocus() {
    state.focusEndsAt = Date.now() + state.selectedMinutes * 60000;
    clearInterval(state.focusTimer);
    state.focusTimer = setInterval(tickFocus, 1000);
    $("#focusStatus").classList.add("is-on");
    $("#focusStatusLabel").textContent = state.selectedMinutes + " min";
    tickFocus();
    closeSurface();
    if (!state.playing) playAll();
    toast("Session started. The room will fade out when time is up.");
  }

  function endFocus(completed) {
    clearInterval(state.focusTimer);
    state.focusTimer = null;
    state.focusEndsAt = null;
    $("#focusStatus").classList.remove("is-on");
    if (!completed) { toast("Session stopped. Your room is still here."); return; }

    // The old build scheduled a 5s ramp and then cancelled it immediately with
    // pauseAll(). Here the ramp is allowed to finish before anything stops.
    toast("Session complete. Look away for one quiet minute.", 6000);
    if (ytPlayer && state.ytReady) {
      var vol = Math.round(state.musicLevel * 0.8);
      var fade = setInterval(function () {
        vol = Math.max(0, vol - 4);
        try { ytPlayer.setVolume(vol); } catch (e) {}
        if (vol <= 0) clearInterval(fade);
      }, 240);
    }
    AmbienceEngine.fadeOutAndStop(5, function () {
      state.playing = false;
      reflectPlaying();
      stopMeters();
      videos.forEach(function (v) { v.pause(); });
      if (ytPlayer && state.ytReady) { try { ytPlayer.pauseVideo(); ytPlayer.setVolume(Math.round(state.musicLevel * 0.8)); } catch (e) {} }
      AmbienceEngine.chime();
    });
  }

  /* ---------- surfaces: honest non-modal disclosure ----------
     The dock stays live while a panel is open (panels swap), so the old
     role="dialog" + aria-modal="true" + focus trap was simply a lie —
     the dock sat at z-index 12 above a z-index 8 backdrop, never inert.  */

  var SURFACES = { worldPanel: "worldButton", musicPanel: "musicButton", roomPanel: "roomButton", focusPopover: "focusButton" };

  function surfaceEl(id) { return document.getElementById(id); }

  /* ---------- the dock steps out of the way ---------- */

  // A permanent bar across the bottom of a full-screen scene competes with the
  // scene. The dock withdraws to a grab strip once it has been left alone, and
  // returns on hover, on focus, or on any pointer near the bottom edge. It is
  // held open while a panel is open, while focus is inside it, and mid-drag —
  // a control that slides away under a keyboard user or a held fader is worse
  // than one that never moves.
  var DOCK_IDLE_MS = 4000;
  var dockIdleTimer = null, dockHeld = false;

  function dockHeldOpen() {
    var more = $("#moreMenu");
    return Boolean(state.surface) || dockHeld ||
           (more && more.classList.contains("is-open")) ||
           $("#controlDock").contains(document.activeElement);
  }

  function wakeDock() {
    world.classList.remove("dock-idle");
    clearTimeout(dockIdleTimer);
    dockIdleTimer = setTimeout(function () {
      if (dockHeldOpen()) { wakeDock(); return; }   // re-arm, never hide it
      world.classList.add("dock-idle");
    }, DOCK_IDLE_MS);
  }

  function bindDockIdle() {
    var dock = $("#controlDock");
    if (!dock) return;
    dock.addEventListener("pointerenter", wakeDock);
    dock.addEventListener("focusin", wakeDock);
    dock.addEventListener("focusout", wakeDock);
    // A fader drag leaves the dock's box; hold it open until the pointer is up.
    dock.addEventListener("pointerdown", function () { dockHeld = true; wakeDock(); });
    window.addEventListener("pointerup", function () { dockHeld = false; wakeDock(); });
    window.addEventListener("keydown", wakeDock);
    window.addEventListener("pointermove", function (e) {
      if (e.clientY > window.innerHeight - 140) wakeDock();
    }, { passive: true });
    wakeDock();
  }

  function openSurface(id, trigger) {
    if (state.surface === id) { closeSurface(); return; }
    closeSurface(false);
    closeMore();
    var el = surfaceEl(id);
    if (!el) return;
    surfaceTrigger = trigger || null;
    el.classList.add("is-open");
    wakeDock();
    el.removeAttribute("inert");
    el.removeAttribute("aria-hidden");
    state.surface = id;
    world.classList.add("surface-open");
    $("#panelBackdrop").classList.add("is-on");
    syncExpanded();
    focusInto(el);
  }

  // Land on the heading, not the close button. content-visibility can defer
  // focusability by a frame, and a single rAF never fires in a hidden tab —
  // so try now and retry on timers until it takes.
  function focusInto(el) {
    var target = el.querySelector("[tabindex='-1']") || firstVisibleFocusable(el);
    if (!target) return;
    var tries = 0;
    function attempt() {
      if (!el.classList.contains("is-open")) return;
      try { target.focus(); } catch (e) {}
      if (document.activeElement === target || ++tries > 3) return;
      setTimeout(attempt, 24 * tries);
    }
    attempt();
  }

  function closeSurface(restoreFocus) {
    var had = state.surface;
    Object.keys(SURFACES).forEach(function (id) {
      var el = surfaceEl(id);
      if (!el) return;
      el.classList.remove("is-open");
      wakeDock();
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    });
    state.surface = null;
    world.classList.remove("surface-open");
    $("#panelBackdrop").classList.remove("is-on");
    syncExpanded();
    if (had && restoreFocus !== false && surfaceTrigger && surfaceTrigger.isConnected) {
      try { surfaceTrigger.focus(); } catch (e) {}
    }
    if (restoreFocus !== false) surfaceTrigger = null;
  }

  function syncExpanded() {
    Object.keys(SURFACES).forEach(function (id) {
      var btn = document.getElementById(SURFACES[id]);
      if (btn) btn.setAttribute("aria-expanded", String(state.surface === id));
    });
  }

  // The old build queried "button, a[href], input" unfiltered, so in the
  // failure state the first hit was a display:none link and focus() silently
  // did nothing — leaving focus on <body>, outside the surface.
  function firstVisibleFocusable(root) {
    var all = root.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (typeof el.checkVisibility === "function") { if (el.checkVisibility()) return el; }
      else if (el.offsetParent !== null) return el;
    }
    return null;
  }

  function closeMore() {
    var m = $("#moreMenu");
    m.classList.remove("is-open");
    m.setAttribute("inert", "");
    m.setAttribute("aria-hidden", "true");
    $("#moreButton").setAttribute("aria-expanded", "false");
  }
  function toggleMore() {
    var m = $("#moreMenu");
    var open = !m.classList.contains("is-open");
    closeSurface(false);
    if (open) {
      m.classList.add("is-open"); m.removeAttribute("inert"); m.removeAttribute("aria-hidden");
      $("#moreButton").setAttribute("aria-expanded", "true");
    } else closeMore();
  }

  function toggleQuiet(force) {
    var quiet = typeof force === "boolean" ? force : !world.classList.contains("quiet");
    closeSurface(); closeMore();
    world.classList.toggle("quiet", quiet);
    if (quiet) $("#quietReturn").focus();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  }

  /* ---------- power-on ---------- */

  var bootDone = false;
  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    world.classList.remove("booting", "sweeping");
    $("#sceneTitle").textContent = worlds[state.worldIndex].title;
    $$("#channelGrid input[type=range]").forEach(function (inp) {
      inp.style.setProperty("--fill", state.values[inp.dataset.layer] + "%");
    });
    $("#musicVolume").style.setProperty("--fill", state.musicLevel + "%");
    $("#roomVolume").style.setProperty("--fill", state.roomLevel + "%");
  }

  function powerOn() {
    var today = new Date().toDateString();
    var seen = null;
    try { seen = localStorage.getItem("dwPowerOn"); } catch (e) {}
    if (reduceMotion.matches || seen === today) { finishBoot(); return; }
    try { localStorage.setItem("dwPowerOn", today); } catch (e) {}

    world.classList.add("booting", "sweeping");
    var inputs = $$("#channelGrid input[type=range]").concat([$("#musicVolume"), $("#roomVolume")]);
    inputs.forEach(function (inp) { inp.style.setProperty("--fill", "0%"); });

    // Type the scene name in — brief, and it explains what channel you are on.
    var title = worlds[state.worldIndex].title;
    var per = Math.min(26, Math.floor(340 / Math.max(1, title.length)));
    $("#sceneTitle").textContent = "";
    var ci = 0;
    (function type() {
      if (bootDone) return;
      $("#sceneTitle").textContent = title.slice(0, ++ci);
      if (ci < title.length) setTimeout(type, per);
    })();

    // Faders sweep to their saved positions — the animation explains state.
    inputs.forEach(function (inp, i) {
      setTimeout(function () {
        if (bootDone) return;
        var key = inp.dataset.layer;
        var to = key ? state.values[key]
                     : (inp.id === "roomVolume" ? state.roomLevel : state.musicLevel);
        inp.style.setProperty("--fill", to + "%");
      }, 360 + i * 40);
    });

    setTimeout(finishBoot, 900);
    // Skippable, per the frequency rule: delight must never be in the way.
    ["pointerdown", "keydown", "wheel"].forEach(function (ev) {
      window.addEventListener(ev, finishBoot, { once: true, passive: true });
    });
  }

  /* ---------- events ---------- */

  function tuneFromInput() {
    var parsed = parseSource($("#sourceInput").value);
    var err = $("#tunerError");
    if (!parsed) {
      err.textContent = "That does not look like a YouTube video or playlist link.";
      err.hidden = false;
      $("#sourceInput").focus();
      return;
    }
    err.hidden = true;
    $("#sourceInput").value = "";
    setSource({ kind: parsed.kind, id: parsed.id,
                label: parsed.kind === "playlist" ? "your playlist" : "your video" });
  }

  function bind() {
    $("#worldGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-world]");
      if (b) setWorld(Number(b.dataset.world));
    });
    $("#trackList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-track]");
      if (b) selectTrack(Number(b.dataset.track));
    });
    $("#presetList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-preset]");
      if (b) applyPreset(b.dataset.preset);
    });
    $("#channelGrid").addEventListener("input", function (e) {
      if (e.target.matches("[data-layer]")) setLayerValue(e.target.dataset.layer, e.target.value, true);
    });
    $("#channelGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-mute]");
      if (b) toggleMute(b.dataset.mute);
    });
    $("#weatherOptions").addEventListener("click", function (e) {
      var b = e.target.closest("[data-weather]");
      if (b) setWeather(b.dataset.weather, false);
    });
    $("#weatherIntensity").addEventListener("input", function (e) {
      state.weatherIntensity = Number(e.target.value);
      e.target.style.setProperty("--fill", state.weatherIntensity + "%");
      seedParticles();
      persist();
    });
    // Music and room are separate levels on purpose. One fader used to drive
    // both, so raising the room raised the music with it and the balance
    // between them could never change — which read as "the mixer does nothing".
    $("#musicVolume").addEventListener("input", function (e) {
      state.musicLevel = Number(e.target.value);
      $("#musicOutput").textContent = state.musicLevel;
      e.target.style.setProperty("--fill", state.musicLevel + "%");
      if (ytPlayer && state.ytReady) { try { ytPlayer.setVolume(Math.round(state.musicLevel * 0.8)); } catch (err) {} }
      persist();
    });
    $("#roomVolume").addEventListener("input", function (e) {
      state.roomLevel = Number(e.target.value);
      $("#roomOutput").textContent = state.roomLevel;
      e.target.style.setProperty("--fill", state.roomLevel + "%");
      AmbienceEngine.setMaster(state.roomLevel);
      // A fader that moves must make sound, even before the first Play.
      wakeRoom();
      persist();
    });

    $("#worldButton").addEventListener("click", function (e) { openSurface("worldPanel", e.currentTarget); });
    $("#musicButton").addEventListener("click", function (e) { openSurface("musicPanel", e.currentTarget); });
    $("#roomButton").addEventListener("click", function (e) { openSurface("roomPanel", e.currentTarget); });
    $("#focusButton").addEventListener("click", function (e) { openSurface("focusPopover", e.currentTarget); });
    $("#closeFocusButton").addEventListener("click", function () { closeSurface(); });
    $$("[data-close-panel]").forEach(function (b) { b.addEventListener("click", function () { closeSurface(); }); });
    $("#panelBackdrop").addEventListener("click", function () { closeSurface(); });

    $("#playButton").addEventListener("click", togglePlay);
    $("#previousButton").addEventListener("click", function () { transportStep(-1); });
    $("#nextButton").addEventListener("click", function () { transportStep(1); });
    $("#surpriseButton").addEventListener("click", surprise);
    $("#saveRoomButton").addEventListener("click", saveRoom);
    $("#savedRoomButton").addEventListener("click", loadSavedRoom);
    $("#driftButton").addEventListener("click", function () { toggleDrift(true); });

    $("#setSourceButton").addEventListener("click", tuneFromInput);
    $("#sourceInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); tuneFromInput(); }
    });
    $("#stationList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tune]");
      if (!b) return;
      var i = Number(b.dataset.tune), st = STATIONS[i];
      if (!st) return;
      state.stationIndex = i;
      setSource({ kind: "video", id: st.id, label: st.label, station: true });
    });
    $("#savedSourceList").addEventListener("click", function (e) {
      var drop = e.target.closest("[data-drop]");
      if (drop) { removeSavedSource(Number(drop.dataset.drop)); return; }
      var b = e.target.closest("[data-tune]");
      if (!b) return;
      var x = state.savedSources[Number(b.dataset.tune)];
      if (x) setSource({ kind: x.kind, id: x.id, label: x.label });
    });
    $("#saveSourceButton").addEventListener("click", saveCurrentSource);
    function focusTuner() {
      openSurface("musicPanel", $("#musicButton"));
      var tries = 0;
      (function focusField() {
        var f = $("#sourceInput");
        try { f.focus(); } catch (e) {}
        if (document.activeElement !== f && ++tries <= 3) setTimeout(focusField, 24 * tries);
      })();
    }
    $("#changeSourceButton").addEventListener("click", focusTuner);
    $("#noticeAction").addEventListener("click", focusTuner);

    $("#durationGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-minutes]");
      if (!b) return;
      state.selectedMinutes = Number(b.dataset.minutes);
      var all = $$("#durationGrid [data-minutes]");
      $("#durationGrid").style.setProperty("--seg-i", all.indexOf(b));
      all.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
    $("#startFocusButton").addEventListener("click", startFocus);
    $("#stopFocusButton").addEventListener("click", function () { endFocus(false); });

    $("#moreButton").addEventListener("click", toggleMore);
    $("#quietButton").addEventListener("click", function () { toggleQuiet(true); });
    $("#quietReturn").addEventListener("click", function () { toggleQuiet(false); });
    $("#fullscreenButton").addEventListener("click", toggleFullscreen);

    // The old build had no outside-click handler and no backdrop for this
    // menu, so once opened it could only be closed from its own button.
    document.addEventListener("pointerdown", function (e) {
      if (!$("#moreMenu").classList.contains("is-open")) return;
      var t = e.target;
      // A synthetic or shadow-retargeted event can hand us a non-Element here,
      // and an unguarded .closest() throws and silently kills this listener.
      if (t && t.nodeType === 1 && t.closest("#moreMenu, #moreButton")) return;
      closeMore();
    });
    $("#moreMenu").addEventListener("focusout", function (e) {
      var t = e.relatedTarget;
      if (!t || t.nodeType !== 1 || !t.closest("#moreMenu, #moreButton")) closeMore();
    });

    document.addEventListener("keydown", onKey);

    var resizeQueued = false;
    window.addEventListener("resize", function () {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; if (weatherActive()) sizeWeather(); });
    });
    reduceMotion.addEventListener("change", function () {
      if (weatherActive()) startWeather(); else stopWeather();
    });
  }

  /* ---------- keyboard ----------
     The old guard bailed on "input, button, a", and every interaction leaves
     focus on a button — so Space, Q, F and the arrows all died after the
     first click. Now each key only steps aside where it would actually clash. */

  function isTextField(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = el.tagName;
    if (t === "TEXTAREA") return true;
    if (t !== "INPUT") return false;
    return ["text", "url", "search", "email", "password", "number", "tel"].indexOf(el.type) >= 0;
  }

  function onKey(e) {
    var target = e.target;

    if (e.key === "Escape") {
      if (state.surface || $("#moreMenu").classList.contains("is-open")) {
        e.preventDefault(); closeSurface(); closeMore();
      } else if (world.classList.contains("quiet")) {
        e.preventDefault(); toggleQuiet(false);
      }
      return;
    }
    if (isTextField(target) || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.code === "Space") {
      // A focused button already answers Space itself — don't double-fire.
      if (target && target.tagName === "BUTTON") return;
      e.preventDefault(); togglePlay(); return;
    }
    var k = (e.key || "").toLowerCase();
    if (k === "q") { e.preventDefault(); toggleQuiet(); return; }
    if (k === "f") { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      // Arrows belong to a focused fader.
      if (target && target.tagName === "INPUT" && target.type === "range") return;
      if (transportMode() === "none") return;
      e.preventDefault();
      transportStep(e.key === "ArrowRight" ? 1 : -1);
    }
  }

  /* ---------- init ---------- */

  function init() {
    restore();

    // Panels ship with [hidden] so there is no flash before JS; swap that for
    // inert + aria-hidden so they can animate but stay out of the a11y tree.
    Object.keys(SURFACES).concat(["moreMenu"]).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.removeAttribute("hidden");
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    });

    state.trackIndex = Math.min(state.trackIndex, Math.max(0, state.tracks.length - 1));

    renderPresets();
    renderChannels();
    paintWorld();
    paintTuner();
    reflectPlaying();

    var w = worlds[state.worldIndex];
    if (window.PixelScene) {
      PixelScene.init($("#pixelScene"));
      PixelScene.useArt([$("#sceneArtA"), $("#sceneArtB")]);
      PixelScene.setRamp(w.pixel ? w.ramp : null);
      world.classList.toggle("pixel", !!w.pixel);
      if (w.pixel) PixelScene.showVideo(); else PixelScene.hideCanvas();
    }
    if (w.kind === "backdrop") setBackdrop(w);
    if (w.kind === "local") {
      videos[0].setAttribute("src", w.video);
      videos[0].classList.add("is-live");
      liveVideo = 0;
      if (window.PixelScene && w.pixel) {
        PixelScene.setSource(videos[0]);
        // One frame as soon as there is one to draw, so the desktop is never
        // blank before the user presses play.
        videos[0].addEventListener("loadeddata", function () { PixelScene.redraw(); }, { once: true });
        videos[0].addEventListener("canplay", function () { PixelScene.redraw(); }, { once: true });
      }
    }

    $("#musicVolume").value = state.musicLevel;
    $("#musicVolume").style.setProperty("--fill", state.musicLevel + "%");
    $("#musicOutput").textContent = state.musicLevel;
    $("#roomVolume").value = state.roomLevel;
    $("#roomVolume").style.setProperty("--fill", state.roomLevel + "%");
    $("#roomOutput").textContent = state.roomLevel;
    $("#weatherIntensity").value = state.weatherIntensity;
    $("#weatherIntensity").style.setProperty("--fill", state.weatherIntensity + "%");
    $("#durationGrid").style.setProperty("--seg-i", 0);
    $$("#durationGrid [data-minutes]").forEach(function (b, i) {
      b.setAttribute("aria-pressed", String(i === 0));
    });

    if (state.savedRoom) {
      $("#savedRoomButton").disabled = false;
      $("#savedRoomHint").textContent = "Ready whenever you return";
    }
    setWeather(state.weather, false);
    // Restore drift silently — the old build toasted at users on every load.
    if (state.drift) { state.drift = false; toggleDrift(false); }

    bind();
    bindDockIdle();
    powerOn();

    if (state.source) loadYouTubeApi();
    loadGallery();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
