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
    { id: "7voSN82FGF0", label: "Ghibli summer night piano",    note: "7 h 18 m" },
    // The house library, added 2026-09-01 (owner's picks; titles from oEmbed).
    // Not player-probed like the three above — if one stops embedding, the
    // self-heal in sourceFailed() walks to the next station on its own.
    { id: "sF80I-TQiW0", label: "90s chill lofi · rain",        note: "The Japanese Town" },
    { id: "gUbNlN_SqpE", label: "Seaside coffee lofi",          note: "Healing Me" },
    { id: "JCKBaJDRMw4", label: "Chill beats to work to",       note: "Lofi Girl" },
    { id: "p_LcrQeZzwI", label: "Deep focus study lofi",        note: "Little Soul" },
    { id: "NWw1ZuDIjlw", label: "Mochi's summer café",     note: "Mochi Cat Lofi" },
    { id: "BCxTQq0UiFs", label: "Chill lofi mix vol. 32",       note: "Art Is Sound" },
    { id: "HGl75kurxok", label: "Piano Ghibli collection",      note: "Vangakuz" },
    { id: "I4fxYapxu5M", label: "3 hours of Studio Ghibli",     note: "relaxing piano" },
    { id: "Njt1io9jakQ", label: "Ghibli concert, unbroken",     note: "Relaxation Day" },
    { id: "MzgMBrtrFc4", label: "Japanese bamboo flute",        note: "guzheng · erhu" },
    { id: "Zu_pBbCwovA", label: "Poems of the Moon",            note: "BigRicePiano" },
    { id: "r7IplE0fZcM", label: "Deep focus Asian flute",       note: "traditional" },
    { id: "XmBji07OtwA", label: "Chinese instrumental",         note: "flute · guzheng · erhu" },
    { id: "9JCwQEJgVtA", label: "Chinese classical guzheng",    note: "traditional" }
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

  /* ---------- scene packs ----------
     Two libraries of paintings. Each pack is shown as ONE slideshow scene —
     the paintings drift (Ken Burns) and rotate, so nothing on screen is ever
     a static frame.

     `ukiyoe` ships. Hiroshige and Hokusai painted the exact weather this
     machine renders — sudden rain, evening snow, morning mist, fireflies —
     and every file is public domain via the Met's Open Access program, so
     this pack can be published, shared and shown without asking anyone.

     `ghibli` stays as a personal option. The studio's grant covers common
     sense, not publication; see each pack's CREDITS.txt.

     `sat`/`luma` are measured (48px decode, mean sRGB-linear luminance and
     HSV saturation), not guessed. `weather` is the effect the print itself
     depicts — picking the scene can bring its own sky with it. `orient`
     drives the mounted-print treatment when the print and the screen
     disagree about which way is long.                                     */

  var PACKS = {
    ukiyoe: {
      label: "The floating world",
      base: "assets/scenes/ukiyoe/",
      ext: ".jpg", thumbExt: ".jpg",
      scenes: [
        { id: "shin-ohashi", title: "Sudden Shower", note: "Ōhashi bridge, caught in the rain",
          file: "shin-ohashi", sat: .192, luma: .331, tone: "light", orient: "portrait",
          weather: "rain", artist: "Hiroshige, 1857",
          moods: ["rain", "lofi", "melancholy", "evening", "calm"] },
        { id: "shono", title: "Shōno in the Rain", note: "travellers running for cover",
          file: "shono", sat: .173, luma: .375, tone: "light", orient: "landscape",
          weather: "rain", artist: "Hiroshige, c. 1833",
          moods: ["rain", "storm", "epic", "focus"] },
        { id: "asukayama", title: "Evening Snow", note: "Asukayama going quiet",
          file: "asukayama", sat: .187, luma: .509, tone: "light", orient: "landscape",
          weather: "snow", artist: "Hiroshige, c. 1837",
          moods: ["winter", "sleep", "calm", "piano"] },
        { id: "evening-snow", title: "River Snow", note: "one boat, six jewel rivers",
          file: "evening-snow", sat: .209, luma: .481, tone: "light", orient: "landscape",
          weather: "snow", artist: "Hiroshige",
          moods: ["winter", "quiet", "ambient", "night"] },
        { id: "great-wave", title: "The Great Wave", note: "you know this one",
          file: "great-wave", sat: .173, luma: .573, tone: "light", orient: "landscape",
          weather: "sea", artist: "Hokusai, c. 1830",
          moods: ["sea", "epic", "classical", "uplifting"] },
        { id: "ejiri", title: "The Gust at Ejiri", note: "papers stolen by the wind",
          file: "ejiri", sat: .192, luma: .472, tone: "light", orient: "landscape",
          weather: "mist", artist: "Hokusai, c. 1830",
          moods: ["wind", "study", "focus", "morning"] },
        { id: "kamata", title: "Plum Garden", note: "spring at Kamata",
          file: "kamata", sat: .262, luma: .409, tone: "light", orient: "portrait",
          weather: "petals", artist: "Hiroshige, 1857",
          moods: ["spring", "gentle", "piano", "morning", "uplifting"] },
        { id: "mishima", title: "Morning Mist", note: "Mishima, barely awake",
          file: "mishima", sat: .224, luma: .429, tone: "light", orient: "landscape",
          weather: "mist", artist: "Hiroshige, c. 1833",
          moods: ["morning", "calm", "ambient", "study"] },
        { id: "tama-moon", title: "Autumn Moon", note: "the Tama river, silvered",
          file: "tama-moon", sat: .191, luma: .440, tone: "light", orient: "landscape",
          weather: "moon", artist: "Hiroshige, c. 1838",
          moods: ["night", "sleep", "dream", "jazz"] },
        { id: "red-fuji", title: "Red Fuji", note: "south wind, clear morning",
          file: "red-fuji", sat: .269, luma: .330, tone: "light", orient: "landscape",
          weather: "none", artist: "Hokusai, c. 1830",
          moods: ["morning", "bright", "uplifting", "classical"] },
        { id: "asakusa-cat", title: "The Cat's Window", note: "Asakusa ricefields at dusk",
          file: "asakusa-cat", sat: .203, luma: .346, tone: "light", orient: "portrait",
          weather: "dusk", artist: "Hiroshige, 1857",
          moods: ["dusk", "cozy", "home", "lofi", "evening"] },
        { id: "mama-maples", title: "Maples at Mama", note: "red leaves over the water",
          file: "mama-maples", sat: .171, luma: .402, tone: "light", orient: "portrait",
          weather: "leaves", artist: "Hiroshige, 1857",
          moods: ["autumn", "calm", "folk", "afternoon"] },
        { id: "ryogoku", title: "Fireworks at Ryōgoku", note: "the night bridge crowds",
          file: "ryogoku", sat: .163, luma: .228, tone: "dark", orient: "portrait",
          weather: "embers", artist: "Hiroshige, 1858",
          moods: ["night", "summer", "festival", "town"] },
        { id: "miyanokoshi", title: "Moonlit Night", note: "Miyanokoshi under a full moon",
          file: "miyanokoshi", sat: .170, luma: .344, tone: "light", orient: "landscape",
          weather: "night", artist: "Hiroshige, c. 1835",
          moods: ["night", "sleep", "quiet", "melancholy"] },
        { id: "fireflies", title: "Catching Fireflies", note: "a summer night's hunt",
          file: "fireflies", sat: .226, luma: .211, tone: "dark", orient: "portrait",
          weather: "fireflies", artist: "Chōki, c. 1793",
          moods: ["summer", "night", "gentle", "dream"] }
      ]
    },
    ghibli: {
      label: "Ghibli (personal)",
      base: "assets/scenes/ghibli/",
      ext: ".jpg", thumbExt: ".png",
      scenes: [
        { id: "ponyo-hill",    title: "House on the hill", note: "Green slope, wide blue morning",
          file: "ponyo006",  sat: .43, luma: .43, tone: "light",
          moods: ["morning", "calm", "study", "piano", "bright"] },
        { id: "howl-sky",      title: "Sky bridge",        note: "Nothing but weather and air",
          file: "howl050",   sat: .41, luma: .46, tone: "light",
          moods: ["uplifting", "classical", "bright", "air"] },
        { id: "howl-castle",   title: "The moving castle", note: "Long view over open country",
          file: "howl049",   sat: .37, luma: .43, tone: "light",
          moods: ["epic", "orchestral", "adventure"] },
        { id: "howl-field",    title: "Scarecrow field",   note: "Wind, wheat and a big sky",
          file: "howl035",   sat: .51, luma: .35, tone: "light",
          moods: ["folk", "calm", "wind", "afternoon"] },
        { id: "laputa-bloom",  title: "Flowering bank",    note: "Close green, close quiet",
          file: "laputa024", sat: .48, luma: .35, tone: "light",
          moods: ["gentle", "piano", "spring", "study"] },
        { id: "ponyo-coast",   title: "The coast road",    note: "Sea light off the water",
          file: "ponyo031",  sat: .46, luma: .22, tone: "dark",
          moods: ["ambient", "waves", "sea", "calm"] },
        { id: "majo-town",     title: "Over the town",     note: "Rooftops down to the harbour",
          file: "majo038",   sat: .50, luma: .21, tone: "dark",
          moods: ["jazz", "nostalgia", "town", "afternoon"] },
        { id: "laputa-ruins",  title: "Overgrown ruins",   note: "Stone giving way to green",
          file: "laputa039", sat: .51, luma: .20, tone: "dark",
          moods: ["focus", "study", "quiet", "ambient"] },
        { id: "majo-garden",   title: "The garden house",  note: "Somebody lives here",
          file: "majo002",   sat: .55, luma: .18, tone: "dark",
          moods: ["cozy", "lofi", "home", "evening"] },
        { id: "totoro-field",  title: "Summer field",      note: "Hot grass and far trees",
          file: "totoro040", sat: .55, luma: .18, tone: "dark",
          moods: ["summer", "folk", "warm", "afternoon"] },
        { id: "laputa-jungle", title: "Deep green",        note: "Light coming through leaves",
          file: "laputa041", sat: .62, luma: .16, tone: "dark",
          moods: ["forest", "focus", "green", "rain"] },
        { id: "totoro-wood",   title: "The wood at dusk",  note: "The path home, nearly dark",
          file: "totoro035", sat: .54, luma: .10, tone: "dark",
          moods: ["forest", "night", "walk", "quiet"] },
        { id: "ponyo-deep",    title: "Under the sea",     note: "Slow light, slower company",
          file: "ponyo023",  sat: .50, luma: .27, tone: "dark",
          moods: ["sleep", "dream", "ambient", "night", "sea"] },
        { id: "howl-dusk",     title: "Hillside at dusk",  note: "The last of the light",
          file: "howl032",   sat: .48, luma: .14, tone: "dark",
          moods: ["dusk", "melancholy", "evening", "piano"] }
      ]
    }
  };

  var FILMED = [
    { id: "rain-window", title: "Rain window", note: "A quiet city seen through rain",
      video: "assets/rain-window.mp4", poster: "assets/rain-window-poster.jpg", ramp: "slate",
      tone: "dark", moods: ["rain", "city", "melancholy", "lofi"] },
    { id: "pond-garden", title: "Pond garden", note: "Leaves, water, a patient afternoon",
      video: "assets/garden-loop.mp4", poster: "assets/garden-loop-poster.jpg", ramp: "moss",
      tone: "dark", moods: ["garden", "water", "calm", "focus"] },
    { id: "wide-awake", title: "Wide awake", note: "Open lake light for clear work",
      video: "assets/lake-loop.mp4", poster: "assets/lake-loop-poster.jpg", ramp: "cool",
      tone: "light", moods: ["lake", "bright", "clear", "study"] }
  ];

  /* ---------- the scene list ----------
     Everything moves. The film reel leads (every clip, one after another),
     then every clip as its own scene, then the three filmed loops, then the
     two painting slideshows — never a static frame — then the tuned source. */
  var worlds = [];
  var LOOPS = (window.DW_LOOPS && window.DW_LOOPS.clips) || [];
  var LOOP_BASE = (window.DW_LOOPS && window.DW_LOOPS.base) || "assets/loops/";
  // The film reel: one world that plays every clip in turn, mirroring
  // whichever clip is up. Deliberately no moods: the music matcher must
  // never land you mid-reel.
  worlds.push({ id: "film-slideshow", title: "Slideshow", kind: "local",
                slideshow: true,
                video: null, poster: null, fit: null, bytes: 0,
                tone: "light", moods: null, ramp: null, pixel: false });
  // Every clip is also its own scene, so the whole library is visible and
  // choosable rather than trapped inside the reel.
  LOOPS.forEach(function (c) {
    worlds.push({ id: c.id, title: c.title, kind: "local",
                  video: LOOP_BASE + c.file, poster: LOOP_BASE + c.poster,
                  fit: c.fit || null, bytes: c.bytes || 0,
                  tone: c.tone || "light", accent: c.accent || null,
                  moods: c.moods || null, ramp: null, pixel: false });
  });
  FILMED.forEach(function (s) {
    worlds.push({ id: s.id, title: s.title, kind: "local",
                  video: s.video, poster: s.poster, ramp: null, pixel: false,
                  tone: s.tone, moods: s.moods });
  });
  // The painting packs, one slideshow scene each: the print drifts (Ken
  // Burns), the pack rotates, and each print brings its own weather.
  worlds.push({ id: "ukiyoe-show", title: "The Floating World", kind: "artshow",
                pack: "ukiyoe", art: null, poster: null, tone: "light",
                orient: "landscape", ramp: null, pixel: false });
  worlds.push({ id: "ghibli-show", title: "Ghibli", kind: "artshow",
                pack: "ghibli", art: null, poster: null, tone: "light",
                orient: "landscape", ramp: null, pixel: false });
  // No pixel twin for the tuned source: a cross-origin iframe cannot be drawn
  // to a canvas, so the ramp never applied to it.
  worlds.push({ id: "your-source", title: "Your source", kind: "youtube",
                video: null, poster: null, ramp: null, pixel: false });

  function partOfDay(h) {
    if (h < 7)  return "night";
    if (h < 11) return "dawn";
    if (h < 17) return "day";
    if (h < 21) return "dusk";
    return "night";
  }

  /* ---------- display mode ----------
     Night is the default and lives in :root. Day and dusk are authored
     palettes rather than inversions — on a pale ground the amber has to lose
     most of its lightness or it fails contrast outright. "auto" follows the
     clock, which is what an ambience app should do on its own.            */

  var MODES = ["auto", "night", "dusk", "day"];
  var MODE_LABEL = { auto: "Auto", night: "Night", dusk: "Dusk", day: "Day" };
  var MODE_THEME = { night: "#0A131E", dusk: "#EAD9BF", day: "#F5EDDD" };
  var modeClockTimer = null;

  function modeForClock() {
    var p = partOfDay(new Date().getHours());
    if (p === "day") return "day";
    if (p === "dawn" || p === "dusk") return "dusk";
    return "night";
  }

  // A bright scene needs dark chrome and a dark scene needs light chrome, or
  // the faceplate sinks into the picture. Scene tone wins over the clock,
  // because what you are looking at matters more than what time it is.
  function modeForScene() {
    var w = worlds[state.worldIndex];
    if (!w || !w.tone) return modeForClock();
    // Harmonize, don't oppose: the chrome is paper now, with its own plates,
    // so a bright print gets washi and a night print gets indigo. The old
    // inversion dated from when text floated bare on the picture.
    return w.tone === "light" ? "day" : "night";
  }

  function resolvedMode() {
    return state.mode === "auto" ? modeForScene() : state.mode;
  }

  function applyMode() {
    var m = resolvedMode();
    document.documentElement.setAttribute("data-mode", m);
    document.documentElement.style.colorScheme = m === "day" ? "light" : "dark";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", MODE_THEME[m] || MODE_THEME.night);
    // The shade is this same mode seen once more: whenever the mode changes
    // from anywhere else — the Display row, the clock, a scene's tone — the
    // blind moves to match, so the grip's position never lies about the light.
    if (!shade.dragging && Math.abs(shade.v - SHADE_POS[m]) > 0.01) animateShade(SHADE_POS[m], false);
    var btn = $("#modeButton");
    if (btn) {
      btn.setAttribute("aria-label", "Display mode: " + MODE_LABEL[state.mode] +
        (state.mode === "auto" ? " (" + MODE_LABEL[m] + " now)" : ""));
      // Only the clock-driven fallback needs a timer; scene-driven repaints
      // happen on scene change.
      var out = btn.querySelector(".mode-value");
      if (out) out.textContent = state.mode === "auto" ? "Auto \u00b7 " + MODE_LABEL[m] : MODE_LABEL[state.mode];
    }
    // Only "auto" needs to keep watching the clock.
    clearInterval(modeClockTimer);
    // Compare against resolvedMode(), not the raw clock: scene tone wins over
    // the clock in auto, and checking the clock here made the timer fight the
    // scene (and the shade) once a minute, flipping the chrome back and forth.
    if (state.mode === "auto") modeClockTimer = setInterval(function () {
      if (document.documentElement.getAttribute("data-mode") !== resolvedMode()) applyMode();
    }, 60000);
  }

  function cycleMode() {
    state.mode = MODES[(MODES.indexOf(state.mode) + 1) % MODES.length];
    applyMode();
    persist();
    toast("Display mode: " + MODE_LABEL[state.mode] +
      (state.mode === "auto" ? " \u2014 following the clock." : "."));
  }

  // `tint` is the token's own colour. Twelve identical slabs on a painting read
  // as equipment; twelve coloured objects read as things you can pick up. The
  // hues are held at a similar lightness so no single one shouts over the rest.
  var roomLayers = [
    { id: "rain",    name: "Gentle rain",    short: "Rain",    icon: "i-cloud-rain",      tint: "#6FB4F2" },
    { id: "forest",  name: "Forest morning", short: "Birds",   icon: "i-tree",            tint: "#6FD08C" },
    { id: "cafe",    name: "Café murmur",    short: "Café",    icon: "i-coffee",          tint: "#E0A167" },
    { id: "brown",   name: "Brown noise",    short: "Brown",   icon: "i-wave-sine",       tint: "#D09D77" },
    { id: "soft",    name: "Soft air",       short: "Air",     icon: "i-wind",            tint: "#8FD7D2" },
    { id: "white",   name: "White noise",    short: "White",   icon: "i-radio",           tint: "#BFCBD8" },
    { id: "wind",    name: "Open window",    short: "Wind",    icon: "i-wind",            tint: "#7FD2C0" },
    { id: "ocean",   name: "Ocean tide",     short: "Ocean",   icon: "i-waves",           tint: "#5FBBD8" },
    { id: "stream",  name: "Small stream",   short: "Stream",  icon: "i-drop",            tint: "#79CFE8" },
    { id: "fire",    name: "Fireplace",      short: "Fire",    icon: "i-fire",            tint: "#F2925F" },
    { id: "night",   name: "Night garden",   short: "Night",   icon: "i-moon-stars",      tint: "#B99BEA" },
    { id: "thunder", name: "Distant thunder",short: "Thunder", icon: "i-cloud-lightning", tint: "#98A4E8" }
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

  // Derived from WEATHER_FX further down, so the two can never drift apart.
  var WEATHERS = ["none", "rain", "snow", "mist", "petals", "leaves", "fireflies", "embers"];

  /* ---------- state ---------- */

  var state = {
    worldIndex: 0, playing: false, musicLevel: 52, roomLevel: 62,
    values: mix(presets[0].values), muted: {}, activePreset: presets[0].id, savedRoom: null,
    weather: "none", weatherIntensity: 64, drift: false, driftTimer: null,
    mode: "auto",              // auto | night | dusk | day
    sceneLocked: false,        // a hand-picked scene wins over the music matcher
    weatherLocked: false,      // a hand-picked effect wins over the room mix
    sound: true,
    selectedMinutes: 25, focusEndsAt: null, focusTimer: null,
    surface: null,
    source: null,              // { kind:'video'|'playlist', id, label, station? }
    savedSources: [],          // [{ kind, id, label, savedAt }] — the user's own
    stationIndex: -1,
    slideIndex: 0, artIndex: { ukiyoe: 0, ghibli: 0 },
    rotate: "time", rotateTimer: null,
    shuffle: false,            // the slot machine picks at random when on
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
        worldIndex: state.worldIndex,
        musicLevel: state.musicLevel,
        roomLevel: state.roomLevel, values: state.values,
        muted: state.muted, activePreset: state.activePreset, savedRoom: state.savedRoom,
        weather: state.weather, weatherIntensity: state.weatherIntensity, drift: state.drift,
        source: state.source, savedSources: state.savedSources, trackIndex: state.trackIndex,
        rotate: state.rotate,
        slideIndex: state.slideIndex, artIndex: state.artIndex,
        shuffle: state.shuffle,
        worldId: (worlds[state.worldIndex] || {}).id,
        mode: state.mode, sound: state.sound, sceneLocked: state.sceneLocked,
        weatherLocked: state.weatherLocked
      }));
    } catch (e) {}
  }
  var freshVisit = false;

  function restore() {
    var saved;
    try { saved = JSON.parse(localStorage.getItem("dreamWorldsV4")); } catch (e) { freshVisit = true; return; }
    if (!saved) { freshVisit = true; return; }
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
    state.weatherIntensity = Math.max(10, Math.min(100, Number(saved.weatherIntensity) || 64));
    state.drift = Boolean(saved.drift);
    state.source = saved.source || null;
    state.savedSources = (Array.isArray(saved.savedSources) ? saved.savedSources : [])
      .filter(function (x) { return x && x.id && (x.kind === "video" || x.kind === "playlist"); })
      .slice(0, SAVED_SOURCE_MAX);
    state.rotate = ["time","interval","off"].indexOf(saved.rotate) >= 0 ? saved.rotate : "time";
    if (saved.worldId) {
      for (var wi = 0; wi < worlds.length; wi++) {
        if (worlds[wi].id === saved.worldId) { state.worldIndex = wi; break; }
      }
    }
    // Playback never survives a reload, so a restored video scene would be a
    // black stage. Boot on the film reel instead; the first play brings the
    // video back as the backdrop on its own (showSourceScene).
    if (worlds[state.worldIndex] && worlds[state.worldIndex].kind === "youtube") state.worldIndex = 0;
    if (MODES.indexOf(saved.mode) >= 0) state.mode = saved.mode;
    if (typeof saved.sound === "boolean") state.sound = saved.sound;
    state.sceneLocked = Boolean(saved.sceneLocked);
    state.weatherLocked = Boolean(saved.weatherLocked);
    state.slideIndex = Math.max(0, Number(saved.slideIndex) || 0);
    if (saved.artIndex && typeof saved.artIndex === "object") {
      for (var pk in state.artIndex) {
        state.artIndex[pk] = Math.max(0, Number(saved.artIndex[pk]) || 0);
      }
    }
    state.shuffle = Boolean(saved.shuffle);
    state.trackIndex = Math.max(0, Number(saved.trackIndex) || 0);
    // A saved "Your source" world is meaningless without a source.
    if (worlds[state.worldIndex].kind === "youtube" && !state.source) state.worldIndex = 0;
    // A saved slideshow with the films since removed falls back to the start.
    if (worlds[state.worldIndex].slideshow && !(window.DW_LOOPS && window.DW_LOOPS.clips.length)) {
      state.worldIndex = 0;
    }
  }

  // Fresh visitors open on the film reel — the scene that moves on its own.
  // Anyone who has been here keeps whatever they chose.
  function defaultWorldIndex() {
    for (var i = 0; i < worlds.length; i++) {
      if (worlds[i].slideshow) {
        return (window.DW_LOOPS && window.DW_LOOPS.clips.length) ? i : 0;
      }
    }
    return 0;
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
    var poster = w.poster || "";
    // The video scene carries its own picture; a big title bar over it reads
    // as clutter (owner directive, 2026-09-01). CSS hides the readout here.
    world.classList.toggle("video-scene", w.kind === "youtube");
    $("#sceneTitle").textContent = displayTitle();
    $("#dockWorldTitle").textContent = w.title;
    $("#worldButton").setAttribute("aria-label", "Scene selector: " + w.title);
    // No borrowed banners: a tuned YouTube source shows a plain dark screen
    // in the dock, never the video's own thumbnail.
    $("#sceneThumb").style.backgroundImage = poster ? "url('" + poster + "')" : "none";
    var plate = w.art || poster;
    $("#scenePoster").style.backgroundImage = plate ? "url('" + plate + "')" : "none";
    world.classList.toggle("pixel", !!w.pixel);
    if (window.PixelScene) PixelScene.setRamp(w.pixel ? w.ramp : null);   // null => untouched
    renderWorlds();
  }

  /* ---------- follow the music ----------
     YouTube exposes no genre, so the only honest signal is the title the
     player already hands back. Keyword hits are scored against the mood tags
     on each scene. A scene you picked by hand locks the list until you clear
     it — a feature that overrides a deliberate choice is a bug.        */

  var MOOD_WORDS = {
    rain: ["rain", "rainy", "storm", "thunder", "downpour"],
    night: ["night", "midnight", "3am", "late", "nocturne", "dark"],
    sleep: ["sleep", "sleeping", "insomnia", "deep sleep", "lullab"],
    study: ["study", "studying", "focus", "concentrat", "work", "coding", "deep work"],
    lofi: ["lofi", "lo-fi", "chill", "chillhop", "beats"],
    jazz: ["jazz", "swing", "saxophone", "bossa"],
    piano: ["piano", "keys", "nocturne", "chopin", "erik satie"],
    classical: ["classical", "orchestra", "symphony", "strings", "violin"],
    epic: ["epic", "cinematic", "soundtrack", "score", "trailer"],
    forest: ["forest", "woods", "jungle", "birds", "nature", "tree"],
    sea: ["ocean", "sea", "wave", "beach", "shore", "underwater"],
    morning: ["morning", "sunrise", "dawn", "wake"],
    evening: ["evening", "sunset", "dusk", "twilight"],
    summer: ["summer", "warm", "sunny"],
    winter: ["winter", "snow", "cold", "christmas"],
    cozy: ["cozy", "cosy", "fireplace", "warm", "cabin", "home"],
    calm: ["calm", "relax", "peace", "gentle", "quiet", "soft", "ambient"],
    melancholy: ["melanchol", "sad", "lonely", "rainy day", "blue"],
    town: ["city", "town", "street", "tokyo", "urban"],
    uplifting: ["happy", "uplifting", "bright", "joy", "hopeful"]
  };

  function classifyTrack(title) {
    var t = String(title || "").toLowerCase();
    if (!t) return [];
    var hits = [];
    for (var mood in MOOD_WORDS) {
      for (var i = 0; i < MOOD_WORDS[mood].length; i++) {
        if (t.indexOf(MOOD_WORDS[mood][i]) >= 0) { hits.push(mood); break; }
      }
    }
    return hits;
  }

  function sceneForMoods(moods) {
    if (!moods.length) return -1;
    var best = -1, bestScore = 0;
    for (var i = 0; i < worlds.length; i++) {
      var w = worlds[i];
      if (!w.moods || !w.moods.length) continue;
      var score = 0;
      for (var j = 0; j < moods.length; j++) {
        if (w.moods.indexOf(moods[j]) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return bestScore >= 1 ? best : -1;
  }

  function followMusic(title) {
    if (state.sceneLocked) return;
    // The slideshows hold their ground: they move on their own, and a track
    // title must not yank the user out of one — only a hand-picked scene does.
    // The tuned video holds its ground too: it IS what is playing, so no
    // mood-matched painting outranks it.
    var cw = worlds[state.worldIndex];
    if (cw && (cw.slideshow || cw.kind === "artshow" || cw.kind === "youtube")) return;
    var moods = classifyTrack(title);
    var i = sceneForMoods(moods);
    if (i < 0 || i === state.worldIndex) return;
    setWorld(i, false);
    toast(worlds[i].title + " suits what is playing. Pick a scene yourself to keep it.");
  }

  function fitsMounted(w) {
    // Asymmetric on purpose. A portrait print cover-cropped on a landscape
    // screen loses its whole composition, so it gets mounted. A landscape
    // print on a phone crops to its centre, which ukiyo-e landscapes carry
    // well — the Great Wave reads better bled than boxed.
    var landscapeScreen = window.innerWidth >= window.innerHeight;
    return w.orient === "portrait" && landscapeScreen;
  }

  // Three screen SHAPES, not three devices: a rotated tablet is a wide screen
  // and should be framed like one. Matches the buckets tools/loops.py derives
  // fit values for.
  function screenBucket() {
    var a = window.innerWidth / window.innerHeight;
    return a >= 1.2 ? "wide" : a >= 0.85 ? "tall" : "phone";
  }

  // Per-element, never on the stage: during the 640ms fade the outgoing clip
  // must keep its own framing.
  function applyFit(el, w) {
    if (!el) return;
    var f = w && w.fit && w.fit[screenBucket()];
    el.style.setProperty("--fit-zoom", f ? f[0] : 1.01);
    el.style.setProperty("--fit-pos", f ? f[1] : "center");
  }

  function showStill(w, animate) {
    if (!window.PixelScene) return false;
    PixelScene.setRamp(null);
    PixelScene.showArt(w.art, w.title, animate === false ? 0 : 640);
    world.classList.add("still-scene");
    world.classList.toggle("mounted-print", fitsMounted(w));
    return true;
  }

  /* ---------- the painting slideshows ----------
     One world per pack. The current print drifts under the Ken Burns camera,
     and the pack advances on a timer with a crossfade — a moving gallery
     rather than a wall of stills. Each print brings its own weather unless a
     hand-picked sky or the room already owns it. */

  var ART_MS = 45 * 1000;

  function currentArt(w) {
    var pk = PACKS[w.pack];
    return pk.scenes[state.artIndex[w.pack] % pk.scenes.length];
  }

  function showArtSlide(animate) {
    var sw = worlds[state.worldIndex];
    if (!sw || sw.kind !== "artshow") return false;
    var pk = PACKS[sw.pack];
    var s = currentArt(sw);
    // The artshow world mirrors whichever print is up, so the dock thumb,
    // the postcard and the mounted-print logic all read one shape of world.
    sw.art = pk.base + s.file + pk.ext;
    sw.poster = pk.base + "thumb-" + s.file + pk.thumbExt;
    sw.tone = s.tone || "light";
    sw.orient = s.orient || "landscape";
    sw.artist = s.artist || "";
    showStill(sw, animate !== false && !reduceMotion.matches);
    $("#sceneTitle").textContent = s.title;
    $("#sceneThumb").style.backgroundImage = "url('" + sw.poster + "')";
    $("#scenePoster").style.backgroundImage = "url('" + sw.art + "')";
    // The print's own sky comes with it, unless someone already owns the sky.
    if (s.weather && !state.weatherLocked && !roomWeather() &&
        s.weather !== state.weather && FX_BY_ID[s.weather]) {
      state.weatherIntensity = Math.max(state.weatherIntensity, 60);
      var wSl = $("#weatherIntensity");
      if (wSl) { wSl.value = state.weatherIntensity; wSl.style.setProperty("--fill", state.weatherIntensity + "%"); }
      setWeather(s.weather, false);
    }
    if (state.mode === "auto") applyMode();
    scheduleRotate();
    return true;
  }

  function advanceArt() {
    var sw = worlds[state.worldIndex];
    if (!sw || sw.kind !== "artshow") return;
    state.artIndex[sw.pack] = (state.artIndex[sw.pack] + 1) % PACKS[sw.pack].scenes.length;
    persist();
    showArtSlide(true);
  }

  /* ---------- the film slideshow ----------
     One world, every clip. Advances go straight to showLocalWorld the way
     gallery advances go to showGallery — never back through setWorld, so the
     weather layer, the lock and the toast all stay untouched per slide. */

  // A clip dwells for at least a minute; short loops repeat inside their
  // dwell via the loop attribute, which the user has said is fine.
  var FILM_MS = 60 * 1000;

  function currentClip() { return LOOPS[state.slideIndex % LOOPS.length]; }

  // What the readout should call the scene: on the reel that is the clip's
  // own name, everywhere else the world's.
  function displayTitle() {
    var w = worlds[state.worldIndex];
    if (!w) return "";
    if (w.slideshow && LOOPS.length) return currentClip().title;
    if (w.kind === "artshow") return currentArt(w).title;
    // The video scene is named by what is playing in it, not "Your source".
    if (w.kind === "youtube" && state.source) {
      var t = state.tracks[state.trackIndex];
      return (t && t.title) || state.source.label;
    }
    return w.title;
  }

  function showFilmSlide(animate) {
    if (!LOOPS.length) return false;
    var sw = worlds[state.worldIndex];
    if (!sw || !sw.slideshow) return false;
    var clip = currentClip();
    // The slideshow world mirrors whichever clip is up, so the dock thumb,
    // the postcard and the fit plumbing all read one shape of world.
    sw.video = LOOP_BASE + clip.file;
    sw.poster = LOOP_BASE + clip.poster;
    sw.fit = clip.fit || null;
    sw.bytes = clip.bytes || 0;
    sw.tone = clip.tone || "light";
    showLocalWorld(sw, animate !== false && !reduceMotion.matches);
    $("#sceneTitle").textContent = clip.title;
    $("#sceneThumb").style.backgroundImage = "url('" + sw.poster + "')";
    $("#scenePoster").style.backgroundImage = "url('" + sw.poster + "')";
    // The chrome harmonizes with the clip: its tone flips day/night in auto,
    // its dominant colour becomes the placard's accent rule. Never text ink.
    if (clip.accent) document.documentElement.style.setProperty("--scene-accent", clip.accent);
    if (state.mode === "auto") applyMode();
    scheduleRotate();
    return true;
  }

  function advanceFilm() {
    if (!LOOPS.length) return;
    state.slideIndex = (state.slideIndex + 1) % LOOPS.length;
    persist();
    showFilmSlide(true);
  }

  function rotateSpec() {
    var w = worlds[state.worldIndex];
    if (!w) return null;
    if (w.kind === "artshow") return { ms: ART_MS, n: PACKS[w.pack].scenes.length, go: advanceArt };
    if (w.slideshow) {
      // Let a long clip finish at least one pass before moving on.
      var dwell = Math.max(FILM_MS, (currentClip() && currentClip().dur || 0) * 1000 + 4000);
      return { ms: dwell, n: LOOPS.length, go: advanceFilm };
    }
    return null;
  }

  function scheduleRotate() {
    clearTimeout(state.rotateTimer);
    var spec = rotateSpec();
    if (!spec || state.rotate === "off" || spec.n < 2) return;
    if (document.hidden) return;   // rearmed by visibilitychange on return
    // Under reduced motion the scene still changes, it just does not fade.
    state.rotateTimer = setTimeout(function () { spec.go(true); }, spec.ms);
  }

  function showLocalWorld(w, animate) {
    var next = (liveVideo + 1) % 2;
    var incoming = videos[next], outgoing = videos[liveVideo];
    $("#youtubeWrap").classList.remove("is-live");
    applyFit(incoming, w);

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
        warmNextFilm();
      }, animate && !reduceMotion.matches ? 700 : 40);
    }

    if (incoming.getAttribute("src") === w.video && incoming.readyState >= 2) { reveal(); return; }
    // The poster is the real no-black-frame guarantee: iOS treats preload as
    // advisory, so every warm path below it can silently no-op.
    if (w.poster) incoming.setAttribute("poster", w.poster);
    incoming.setAttribute("src", w.video);
    if (window.PixelScene && PixelScene.unprime) PixelScene.unprime(incoming);
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

  // Deterministic prefetch: on the reel the next clip is always known, so the
  // idle element buffers it while the current one plays and the crossfade is
  // always warm. Fires only after the outgoing fade has fully settled.
  function warmNextFilm() {
    var w = worlds[state.worldIndex];
    if (!w || !w.slideshow || LOOPS.length < 2) return;
    if (document.hidden) return;
    var c = navigator.connection;
    if (c && (c.saveData || c.effectiveType === "2g" || c.effectiveType === "slow-2g")) return;
    var nextClip = LOOPS[(state.slideIndex + 1) % LOOPS.length];
    var idle = videos[(liveVideo + 1) % 2];
    if (idle.classList.contains("is-live")) return;
    var src = LOOP_BASE + nextClip.file;
    if (idle.getAttribute("src") === src) return;
    // Local files are cheap; remote ones over ~2.5MB only warm their metadata.
    idle.preload = (!nextClip.bytes || nextClip.bytes < 2500000 ||
                    location.protocol === "file:" || location.hostname === "localhost")
      ? "auto" : "metadata";
    idle.setAttribute("poster", LOOP_BASE + nextClip.poster);
    idle.setAttribute("src", src);
    if (window.PixelScene && PixelScene.unprime) PixelScene.unprime(idle);
    idle.load();
  }

  function setWorld(index, announce) {
    if (!worlds[index]) return;
    var w = worlds[index];
    if (w.kind === "youtube" && (!state.source || state.ytFailed)) {
      toast("Tune in a source first, then this scene becomes available.");
      return;
    }
    if (w.slideshow && !LOOPS.length) {
      toast("No films added yet. See assets/loops/README.md to add your own.");
      return;
    }
    if (index === state.worldIndex) { closeSurface(); return; }
    // announce is false for automatic changes, so this only latches on a
    // choice the user actually made.
    if (announce) state.sceneLocked = true;
    UISound.play("scene");
    state.worldIndex = index;
    paintWorld();
    clearTimeout(state.rotateTimer);
    world.classList.toggle("still-scene", w.kind === "artshow");
    // Nothing removed this on leaving a portrait print, so the washi mat
    // followed you into every other scene.
    world.classList.toggle("mounted-print", w.kind === "artshow" && fitsMounted(w));
    // The placard's accent rule belongs to scenes that declare one; everything
    // else gets the house amber back.
    if (w.accent) document.documentElement.style.setProperty("--scene-accent", w.accent);
    else if (!w.slideshow) document.documentElement.style.removeProperty("--scene-accent");
    if (state.mode === "auto") applyMode();
    if (w.kind === "artshow") {
      videos[liveVideo].pause();
      videos[liveVideo].classList.remove("is-live");
      $("#youtubeWrap").classList.remove("is-live");
      showArtSlide(true);
    } else if (w.kind === "youtube") {
      videos[liveVideo].classList.remove("is-live");
      videos[liveVideo].pause();
      // The iframe is the only thing that can honestly show a cross-origin
      // source — the pixel canvas must come off screen with it. It fades in
      // only once frames are actually playing; a cued embed shows YouTube's
      // own chrome (logo, title bar, red button), which is never the scene.
      if (window.PixelScene) PixelScene.hideCanvas();
      var ytState = -1;
      try { ytState = ytPlayer ? ytPlayer.getPlayerState() : -1; } catch (err) {}
      if (state.ytReady && (ytState === 1 || ytState === 2 || ytState === 3)) {
        $("#youtubeWrap").classList.add("is-live");
      }
    } else {
      $("#youtubeWrap").classList.remove("is-live");
      if (window.PixelScene) {
        if (w.pixel) PixelScene.showVideo(); else PixelScene.hideCanvas();
      }
      if (w.slideshow) showFilmSlide(true); else showLocalWorld(w, true);
    }
    persist();
    closeSurface();
    if (announce !== false) toast(displayTitle() + " is now your scene.");
  }

  // The cards carry a picture and a name, nothing else — the picture is the
  // information. Scenes that cannot show anything right now are simply not
  // listed rather than shown disabled with an excuse.
  function renderWorlds() {
    $("#worldGrid").innerHTML = worlds.map(function (w, i) {
      if (w.kind === "youtube" && (!state.source || state.ytFailed)) return "";
      if (w.slideshow && !LOOPS.length) return "";
      var poster = "";
      if (w.slideshow) poster = LOOP_BASE + LOOPS[state.slideIndex % LOOPS.length].poster;
      else if (w.kind === "artshow") {
        var pk = PACKS[w.pack], s = pk.scenes[state.artIndex[w.pack] % pk.scenes.length];
        poster = pk.base + "thumb-" + s.file + pk.thumbExt;
      } else poster = w.poster || "";
      return '<button class="world-card" data-world="' + i + '" style="--i:' + (i % 12) + '"' +
        ' aria-current="' + (i === state.worldIndex) + '">' +
        '<span class="world-card-screen"' +
          (poster ? ' style="background-image:url(\'' + poster + '\')"' : '') + '></span>' +
        '<span class="world-card-copy"><strong>' + w.title + '</strong></span>' +
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
    // A fresh tune returns the scene to its default: the source's own video
    // (showSourceScene, once the player is ready). A scene picked BY HAND
    // after tuning latches the lock again and wins until the next tune.
    state.sceneLocked = false;
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

  // The tuned video is the default backdrop (owner directive, 2026-09-01):
  // whatever is playing, you are also looking at it — unless a hand-picked
  // scene holds the lock, in which case the pick wins until the next tune.
  function showSourceScene() {
    if (state.sceneLocked || state.ytFailed || !state.source) return;
    for (var i = 0; i < worlds.length; i++) {
      if (worlds[i].kind === "youtube") {
        if (i !== state.worldIndex) setWorld(i, false);
        return;
      }
    }
  }

  function createPlayer() {
    if (!state.source || ytPlayer) return;
    var vars = {
      autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
      modestbranding: 1, playsinline: 1, rel: 0,
      vq: "hd1080",   // unofficial and often ignored, but costs nothing
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

        // The machine introduces itself once, the first time there is
        // actually something for it to pick.
        try {
          if (!localStorage.getItem("dwSlotToast") && !localStorage.getItem("dwSlotSeen")) {
            localStorage.setItem("dwSlotToast", "1");
            setTimeout(function () {
              toast("Try the slot machine — pull the lever to pick what plays next.", 5600);
            }, 2400);
          }
        } catch (err) {}

        if (state.source.kind === "playlist") {
          var ids = [];
          try { ids = e.target.getPlaylist() || []; } catch (err) {}
          state.tracks = ids.map(function (_, i) { return { title: "Track " + (i + 1), subtitle: "" }; });
          refreshCurrentTrackTitle();
          prefetchTrackTitles(ids);
        } else {
          state.tracks = [{ title: vd.title || state.source.label, subtitle: "" }];
        }
        $("#sourceNotice").hidden = true;
        paintTuner();
        paintWorld();
        // NOT shown yet: a ready-but-unstarted embed renders YouTube's cued
        // chrome — title bar, logo, the giant red button. The backdrop fades
        // in on the first PLAYING state, when there are real frames to show.
        // Best effort on quality; the oversized iframe is the real lever.
        try { e.target.setPlaybackQuality("hd1080"); } catch (err) {}
        if (state.playing) { try { e.target.playVideo(); } catch (err) {} }
      },
      onStateChange: function (e) {
        // 0 ended · 1 playing · 2 paused · 3 buffering
        if (e.data === 2 && state.playing) { state.playing = false; reflectPlaying(); stopScrub(); }
        if (e.data === 0) {
          if (state.source && state.source.kind === "playlist") { refreshCurrentTrackTitle(); }
          else {
            state.playing = false; reflectPlaying(); stopScrub();
            // The end screen is a wall of suggested thumbnails — never the
            // backdrop. Fall back to the film reel until the next play.
            $("#youtubeWrap").classList.remove("is-live");
            if (worlds[state.worldIndex].kind === "youtube") setWorld(0, false);
          }
        }
        if (e.data === 1) {
          startScrub();
          paintScrub();
          state.ytFailed = false;
          refreshCurrentTrackTitle();
          try { e.target.setPlaybackQuality("hd1080"); } catch (err) {}
          showSourceScene();
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

  var lastMatchedTitle = "";

  /* ---------- real names for the reel ----------
     The iframe API hands back video IDs but no titles until each one plays,
     which left the slot machine spinning "Track 7". oEmbed knows every title
     without a key; noembed proxies it with CORS. Fetched politely, painted in
     batches. Cosmetic: any failure just leaves the placeholder. */
  var titlePaintTimer = null;
  function prefetchTrackTitles(ids) {
    var mySource = state.source;
    ids.slice(0, 100).forEach(function (id, i) {
      if (!id) return;
      setTimeout(function () {
        if (state.source !== mySource) return;   // retuned while fetching
        fetch("https://noembed.com/embed?url=" +
              encodeURIComponent("https://www.youtube.com/watch?v=" + id))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d || !d.title || state.source !== mySource || !state.tracks[i]) return;
            if (state.tracks[i].loaded) return;
            state.tracks[i] = { title: d.title, subtitle: "", loaded: true };
            clearTimeout(titlePaintTimer);
            titlePaintTimer = setTimeout(function () { renderTracks(); paintScrub(); }, 400);
          })
          .catch(function () {});
      }, i * 130);
    });
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
    // When the video IS the scene, the placard names the track playing in it.
    if (worlds[state.worldIndex].kind === "youtube") $("#sceneTitle").textContent = displayTitle();
    var cur = state.tracks[state.trackIndex];
    var name = cur ? cur.title : (state.source ? state.source.label : "");
    if (name && name !== lastMatchedTitle) { lastMatchedTitle = name; followMusic(name); }
    // The tab title is the now-playing readout when the app is in a background
    // tab, which is where it spends most of its life.
    document.title = name ? name + " · UKIYO" : "UKIYO — a floating world machine";
  }

  function currentTrack() { return state.tracks[state.trackIndex] || null; }

  function paintTuner() {
    var t = currentTrack();
    var hasSource = Boolean(state.source) && !state.ytFailed;
    var label = !state.source ? "Tune a source →"
              : state.ytFailed ? "Room only \u2014 retune"
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
    $("#nextButton").setAttribute("aria-label", "Next — pull the slot machine");
    var slotKey = $("#slotButton");
    if (slotKey) {
      slotKey.disabled = mode === "none";
      slotKey.setAttribute("aria-label", mode === "track"
        ? "Slot machine — pick the next track"
        : "Slot machine — pick the next station");
    }
    $("#tuner").hidden = false;
    renderStations();
    $("#tunerHint").textContent = state.source && !state.ytFailed
      ? "Tuned to " + state.source.label + ". Paste another link to change it."
      : "Paste a link, or start with the suggested station below.";
    renderTracks();
    paintScrub();
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

  /* ---------- scrub bar ----------
     getCurrentTime was only ever called inside seekBy, so there was no
     position readout at all. Polling runs only while something is actually
     playing and the tab is visible; a paused player in a hidden tab should
     cost nothing. */

  var scrubTimer = null, scrubbing = false;

  // Two bars, one position: the compact one in the dock's LCD and the
  // full-size one at the top of the tuner panel. Both read and write the
  // same player.
  function scrubBars() {
    return [
      { wrap: $("#scrubWrap"), bar: $("#scrub"),
        paint: function (at, dur) {
          var o = $("#scrubTime");
          if (o) o.textContent = formatTime(Math.round(at)) + " / " + formatTime(Math.round(dur));
        } },
      { wrap: $("#panelNow"), bar: $("#scrubPanel"),
        paint: function (at, dur) {
          var a = $("#scrubPanelAt"), d = $("#scrubPanelDur");
          if (a) a.textContent = formatTime(Math.round(at));
          if (d) d.textContent = formatTime(Math.round(dur));
        } }
    ];
  }

  function paintScrub() {
    var live = ytPlayer && state.ytReady && !state.ytFailed;
    var at = 0, dur = 0;
    if (live) {
      try { at = Number(ytPlayer.getCurrentTime()) || 0; dur = Number(ytPlayer.getDuration()) || 0; }
      catch (err) { return; }
    }
    var p = dur > 0 ? Math.max(0, Math.min(1000, Math.round((at / dur) * 1000))) : 0;
    scrubBars().forEach(function (e) {
      if (!e.wrap) return;
      e.wrap.hidden = !live;
      if (!live || scrubbing || dur <= 0) return;
      e.bar.value = p;
      e.bar.style.setProperty("--fill", (p / 10) + "%");
      e.paint(at, dur);
    });
    var nowTitle = $("#panelNowTitle");
    if (nowTitle) {
      var t = currentTrack();
      nowTitle.textContent = t ? t.title : (state.source ? state.source.label : "—");
    }
  }

  function startScrub() {
    if (scrubTimer) return;
    scrubTimer = setInterval(function () {
      if (document.hidden || !state.playing) return;
      paintScrub();
    }, 400);
  }
  function stopScrub() { clearInterval(scrubTimer); scrubTimer = null; }

  function bindScrub() {
    scrubBars().forEach(function (e) {
      if (!e.bar) return;
      e.bar.addEventListener("pointerdown", function () { scrubbing = true; });
      e.bar.addEventListener("input", function () {
        var dur = 0;
        try { dur = Number(ytPlayer.getDuration()) || 0; } catch (err) {}
        e.bar.style.setProperty("--fill", (e.bar.value / 10) + "%");
        if (dur > 0) e.paint((e.bar.value / 1000) * dur, dur);
      });
      var commit = function () {
        if (!scrubbing) return;
        scrubbing = false;
        try {
          var dur = Number(ytPlayer.getDuration()) || 0;
          if (dur > 0) ytPlayer.seekTo((e.bar.value / 1000) * dur, true);
        } catch (err) {}
        UISound.play("tick");
      };
      e.bar.addEventListener("change", commit);
      e.bar.addEventListener("pointerup", commit);
    });
  }

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
    // Forward is always the machine — that is the whole gesture, and it works
    // on a single-video station too (the reels pick a station instead of a
    // track). Back stays instant: a rewind you have to gamble for is a bad
    // rewind, and it is the only way to undo an unlucky spin.
    if (dir > 0) { openSlot(); return; }
    if (mode === "track") selectTrack(state.trackIndex - 1);
    else seekBy(-SEEK_SECONDS);
  }

  /* ---------- the slot machine ----------
     Pressing Next summons a machine instead of silently advancing: three
     reels, a lever, and a moment of not knowing.

     It works whatever is tuned. A playlist offers its own tracks; a single
     video — which is every one of the curated stations — offers the other
     stations and everything you have saved. That was the bug: the machine
     only knew how to pick tracks, so on a station the transport quietly fell
     back to seeking and the machine never appeared at all.

     Landing is staggered — sides first, answer last — and clicking mid-spin
     stops the next reel by hand, the way the stop buttons on a real cabinet
     do. */

  var SLOT_ICONS = ["i-cloud-rain", "i-tree", "i-coffee", "i-fire", "i-moon-stars",
                    "i-sparkle", "i-waves", "i-drop", "i-snowflake", "i-wind",
                    "i-radio", "i-seal"];
  var SLOT_CELL = 46;                  // must match --slot-cell in styles.css
  var slot = { open: false, spinning: false, target: -1, pool: null,
               anims: [], tick: null, stopped: 0 };

  function paintSlotMode() {
    var n = $("#slotModeNormal"), s = $("#slotModeShuffle");
    if (n) n.setAttribute("aria-pressed", String(!state.shuffle));
    if (s) s.setAttribute("aria-pressed", String(state.shuffle));
  }

  // Everything the machine could land on, and how to play it.
  function slotPool() {
    if (state.tracks.length > 1) {
      return { kind: "track", at: state.trackIndex,
               items: state.tracks.map(function (t) { return { label: t.title }; }) };
    }
    var items = [];
    STATIONS.forEach(function (st, i) {
      items.push({ label: st.label, note: st.note,
                   source: { kind: "video", id: st.id, label: st.label, station: true },
                   stationIndex: i });
    });
    state.savedSources.forEach(function (x) {
      items.push({ label: x.label,
                   source: { kind: x.kind, id: x.id, label: x.label } });
    });
    // Never offer what is already on air.
    items = items.filter(function (it) {
      return !(state.source && it.source.id === state.source.id &&
               it.source.kind === state.source.kind);
    });
    return { kind: "source", at: -1, items: items };
  }

  function slotTargetIndex(pool) {
    var n = pool.items.length;
    if (n < 2) return 0;
    if (state.shuffle || pool.kind === "source") {
      var pick;
      do { pick = Math.floor(Math.random() * n); } while (pick === pool.at && n > 1);
      return pick;
    }
    return (pool.at + 1) % n;
  }

  // Fill the strips so the target lands on the payline after a few laps.
  // Returns the strip index of the winning cell.
  function buildSlotReels(pool, target) {
    var n = pool.items.length;
    var from = pool.at >= 0 ? pool.at : Math.floor(Math.random() * n);
    var cells = [from], idx = from;
    var laps = Math.max(14, Math.min(26, n * 2));
    for (var k = 0; k < laps; k++) { idx = (idx + 1) % n; cells.push(idx); }
    while (cells[cells.length - 1] !== target) { idx = (idx + 1) % n; cells.push(idx); }
    cells.push((target + 1) % n);
    $("#slotReelT").innerHTML = cells.map(function (i) {
      return "<li>" + escapeHtml(pool.items[i].label) + "</li>";
    }).join("");
    ["slotReelA", "slotReelB"].forEach(function (id, which) {
      var m = [];
      for (var j = 0; j < cells.length; j++) {
        m.push('<li><svg class="icon"><use href="#' +
          SLOT_ICONS[(j * 5 + which * 7) % SLOT_ICONS.length] + '"/></svg></li>');
      }
      document.getElementById(id).innerHTML = m.join("");
    });
    return cells.length - 2;
  }

  function slotReels() { return [$("#slotReelA"), $("#slotReelT"), $("#slotReelB")]; }

  function openSlot() {
    if (slot.open) return;
    var pool = slotPool();
    if (!pool.items.length) {
      toast("Tune in a source first — then the machine has something to pick.");
      return;
    }
    // Seen once, the attention glint on the dock key retires for good.
    try { localStorage.setItem("dwSlotSeen", "1"); } catch (e) {}
    var sk = $("#slotButton");
    if (sk) sk.classList.add("is-seen");
    slot.pool = pool;
    slot.open = true; slot.spinning = false; slot.target = -1; slot.stopped = 0;
    paintSlotMode();
    // Order only means something for a playlist; a pool of sources is always
    // a lucky dip, so the toggle steps aside rather than lying.
    var modes = $(".slot-mode");
    if (modes) modes.hidden = pool.kind !== "track";
    $("#slotHint").textContent = "Pull the lever";
    $("#slotMarquee").textContent = pool.kind === "track" ? "NEXT TRACK" : "NEXT STATION";
    // A neutral cover strip: the machine must not leak the answer at rest.
    $("#slotReelT").innerHTML = "<li></li><li>?</li><li></li>";
    ["slotReelA", "slotReelB"].forEach(function (id, which) {
      document.getElementById(id).innerHTML =
        '<li></li><li><svg class="icon"><use href="#' + SLOT_ICONS[which * 6] +
        '"/></svg></li><li></li>';
    });
    slotReels().forEach(function (ul) {
      ul.style.transform = "translateY(0)";
      ul.classList.remove("is-spinning");
    });
    var veil = $("#slotVeil");
    veil.hidden = false;
    // Forced layout, then the class: the fade still animates, but nothing
    // depends on rAF (throttled to zero in hidden panes and background tabs).
    void veil.offsetWidth;
    veil.classList.add("is-on");
    UISound.play("open");
    try { $("#slotLever").focus(); } catch (e) {}
  }

  function closeSlot(restoreFocus) {
    if (!slot.open) return;
    slot.open = false; slot.spinning = false;
    clearInterval(slot.tick); slot.tick = null;
    slot.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    slot.anims = [];
    var veil = $("#slotVeil");
    veil.classList.remove("is-on");
    setTimeout(function () { veil.hidden = true; }, 220);
    UISound.play("close");
    if (restoreFocus !== false) { try { $("#slotButton").focus(); } catch (e) {} }
  }

  function spinSlot() {
    if (!slot.open || slot.spinning) return;
    var pool = slotPool();
    slot.pool = pool;
    if (!pool || pool.items.length < 1) return;
    // Kill any fill:forwards transforms from the previous pull before the
    // reels are rebuilt, or the old animation fights the new one.
    slot.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    slot.anims = [];
    slot.spinning = true; slot.stopped = 0;
    slot.target = slotTargetIndex(pool);
    var last = buildSlotReels(pool, slot.target);
    var finalY = -(last - 1) * SLOT_CELL;
    $("#slotHint").textContent = "Tap to stop a reel";
    $("#slotMachine").classList.add("is-spinning");
    var reels = slotReels();
    var durs = [1500, 2400, 1950];      // sides land first, the answer last
    slot.anims = [];
    var landed = 0;
    reels.forEach(function (ul, i) {
      ul.style.transform = "translateY(0)";
      ul.classList.add("is-spinning");
      var a = ul.animate([
        { transform: "translateY(0)", easing: "cubic-bezier(.25,.5,.35,1)" },
        { transform: "translateY(" + (finalY - 16) + "px)", offset: .9,
          easing: "cubic-bezier(.34,1.45,.55,1)" },
        { transform: "translateY(" + finalY + "px)" }
      ], { duration: durs[i], fill: "forwards" });
      a.addEventListener("finish", function () {
        ul.classList.remove("is-spinning");
        UISound.play("stop");
        if (++landed === reels.length) landSlot();
      });
      slot.anims.push(a);
    });
    clearInterval(slot.tick);
    slot.tick = setInterval(function () { UISound.play("reel"); }, 150);
    setTimeout(function () { clearInterval(slot.tick); }, Math.max.apply(null, durs));
  }

  // Stop the next still-spinning reel by hand, left to right.
  function stopNextReel() {
    if (!slot.spinning) return;
    var a = slot.anims[slot.stopped];
    if (!a) return;
    slot.stopped++;
    try { a.finish(); } catch (e) {}
  }

  function skipSlotSpin() {
    if (!slot.spinning) return;
    slot.anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
  }

  // The reels have settled: play whatever they are showing — and STAY OPEN.
  // The machine is an audition booth: listen, and if it is not the one, the
  // lever is right there. It only closes when the user closes it.
  function landSlot() {
    if (!slot.open || slot.target < 0) return;
    slot.spinning = false;
    clearInterval(slot.tick); slot.tick = null;
    var m = $("#slotMachine");
    m.classList.remove("is-spinning");
    m.classList.add("is-won");
    setTimeout(function () {
      var mm = $("#slotMachine");
      if (mm) mm.classList.remove("is-won");
    }, 1300);
    UISound.play("win");
    var pool = slot.pool, pick = pool.items[slot.target];
    if (!pick) return;
    $("#slotHint").innerHTML = '<strong>' + escapeHtml(pick.label) + '</strong>' +
      '<small>Not it? Pull again.</small>';
    $("#slotMarquee").textContent = state.shuffle && pool.kind === "track"
      ? "FATE SAYS" : "NOW PLAYING";
    if (pool.kind === "track") selectTrack(slot.target, false);
    else {
      if (typeof pick.stationIndex === "number") state.stationIndex = pick.stationIndex;
      setSource(pick.source, false);
      if (!state.playing) playAll();
    }
    try { $("#slotLever").focus(); } catch (e) {}
  }

  function bindSlot() {
    var lever = $("#slotLever");
    if (!lever) return;
    var drag = { on: false, y0: 0, moved: 0, fired: false };
    lever.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      lever.setPointerCapture(e.pointerId);
      drag.on = true; drag.y0 = e.clientY; drag.moved = 0; drag.fired = false;
      lever.classList.add("is-held");
      e.preventDefault();
    });
    lever.addEventListener("pointermove", function (e) {
      if (!drag.on) return;
      var dy = Math.max(0, Math.min(76, e.clientY - drag.y0));
      drag.moved = Math.max(drag.moved, dy);
      lever.style.setProperty("--pull", (dy / 76).toFixed(3));
      if (dy >= 60 && !drag.fired && !slot.spinning) {
        drag.fired = true;
        UISound.play("press");
        spinSlot();
      }
    });
    function release(e) {
      if (!drag.on) return;
      drag.on = false;
      try { lever.releasePointerCapture(e.pointerId); } catch (err) {}
      lever.classList.remove("is-held");
      lever.style.setProperty("--pull", "0");
    }
    lever.addEventListener("pointerup", release);
    lever.addEventListener("pointercancel", release);
    // Keyboard and plain clicks pull it too — the drag is flavour, not a gate.
    lever.addEventListener("click", function () {
      if (drag.moved > 8 || drag.fired) return;
      if (slot.spinning) { stopNextReel(); return; }
      lever.classList.add("is-autopull");
      setTimeout(function () { lever.classList.remove("is-autopull"); }, 460);
      spinSlot();
    });

    // Anywhere on the cabinet: spin it, or stop the next reel.
    $(".slot-cab").addEventListener("click", function () {
      if (slot.spinning) stopNextReel(); else spinSlot();
    });

    $("#slotClose").addEventListener("click", function (e) {
      e.stopPropagation();
      if (slot.spinning) { skipSlotSpin(); return; }
      closeSlot();
    });
    $("#slotVeil").addEventListener("pointerdown", function (e) {
      if (e.target !== e.currentTarget) return;
      if (slot.spinning) { skipSlotSpin(); return; }
      closeSlot();
    });
    $("#slotModeNormal").addEventListener("click", function (e) {
      e.stopPropagation();
      state.shuffle = false; paintSlotMode(); persist(); UISound.play("tick");
    });
    $("#slotModeShuffle").addEventListener("click", function (e) {
      e.stopPropagation();
      state.shuffle = true; paintSlotMode(); persist(); UISound.play("tick");
    });
    var key = $("#slotButton");
    if (key) {
      key.addEventListener("click", openSlot);
      try { if (localStorage.getItem("dwSlotSeen")) key.classList.add("is-seen"); } catch (e) {}
    }
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
    UISound.play(state.playing ? "on" : "off");
    world.classList.toggle("playing", state.playing);
    $("#playButton").setAttribute("aria-pressed", String(state.playing));
    $("#playButton").setAttribute("aria-label", state.playing ? "Pause" : "Play");
  }

  function playAll() {
    startScrub();
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
    stopScrub();
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
      // Something is audible now, so the transport has to say so. It used to
      // stay on "Play" while the room was running, which is the clearest
      // place the app disagreed with itself.
      state.playing = true;
      reflectPlaying();
      persist();
    }, function () { roomWaking = false; });
    toast(state.source ? "Room ambience is playing. The music is still paused."
                       : "Room ambience is playing.");
  }

  function renderPresets() {
    $("#presetList").innerHTML = presets.map(function (p, i) {
      return '<button class="preset" data-preset="' + p.id + '" style="--i:' + i + '"' +
        ' aria-current="' + (state.activePreset === p.id) + '">' +
        '<span><strong>' + p.title + '</strong></span></button>';
    }).join("");
  }

  // Twelve fader strips, like the desk the dock pretends to be. Icon, a
  // vertical fader, the name, a mute key — nothing to read, only to move.
  function renderChannels() {
    $("#channelGrid").innerHTML = roomLayers.map(function (l, i) {
      var v = state.values[l.id], m = Boolean(state.muted[l.id]);
      return '<div class="channel strip' + (v > 0 && !m ? " is-live" : "") + '" data-channel="' + l.id + '"' +
        ' style="--i:' + i + ';--tint:' + l.tint + '">' +
        '<span class="strip-icon" title="' + l.name + '"><svg class="icon"><use href="#' + l.icon + '"/></svg></span>' +
        '<output id="out-' + l.id + '" aria-live="off">' + (m ? "mute" : v + "%") + '</output>' +
        '<span class="vfader">' +
          '<input type="range" min="0" max="100" value="' + v + '" data-layer="' + l.id + '"' +
            ' aria-label="' + l.name + ' level" aria-orientation="vertical" style="--fill:' + v + '%">' +
        '</span>' +
        '<strong>' + l.short + '</strong>' +
        '<button class="mute' + (m ? " is-muted" : "") + '" data-mute="' + l.id + '"' +
          ' aria-label="' + (m ? "Unmute " : "Mute ") + l.name + '">' +
          '<svg class="icon"><use href="#' + (m ? "i-speaker-slash" : "i-speaker-simple-low") + '"/></svg></button>' +
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
    if (out) out.textContent = state.muted[id] ? "mute" : v + "%";
    if (fromUser) renderPresets();
    if (state.drift) swayResync();
    if (fromUser) syncWeatherToRoom();
    persist();
  }

  function toggleMute(id) {
    state.muted[id] = !state.muted[id];
    state.activePreset = null;
    wakeRoom();
    AmbienceEngine.setLayer(id, state.values[id], Boolean(state.muted[id]));
    if (state.drift) swayResync();
    syncWeatherToRoom();
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
    if (state.drift) swayResync();
    syncWeatherToRoom();
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
    pushMix();
    if (state.drift) swayResync();
    renderChannels(); renderPresets(); persist();
    toast("Your saved mix is back. Scene and music unchanged.");
  }

  // Every live channel gets its own slow sine, each with a random period and
  // phase, so the room breathes instead of stepping and no two channels ever
  // line up. The moving value goes straight to the engine as a float: the
  // user's set point in state.values never moves, so the fader, the readout
  // and the saved mix still show what was actually set.
  var SWAY_TICK_MS = 700;
  var swayNodes = {};

  function swayResync() {
    if (!state.drift) { return; }
    var next = {};
    roomLayers.forEach(function (l) {
      var v = state.values[l.id];
      if (v <= 0 || state.muted[l.id]) return;
      var was = swayNodes[l.id];
      next[l.id] = {
        base: v,
        amp: Math.min(Math.max(3, v * 0.28), 100 - v, v),   // never clip either rail
        period: was ? was.period : 34000 + Math.random() * 46000,
        phase:  was ? was.phase  : Math.random() * Math.PI * 2
      };
    });
    Object.keys(swayNodes).forEach(function (id) {
      // Channels that just left the sway set go back to their exact set point.
      if (!next[id]) AmbienceEngine.setLayer(id, state.values[id], Boolean(state.muted[id]));
    });
    swayNodes = next;
    document.querySelectorAll("[data-channel]").forEach(function (el) {
      el.classList.toggle("is-swaying", Boolean(swayNodes[el.dataset.channel]));
    });
  }

  function swayTick() {
    var now = Date.now();
    Object.keys(swayNodes).forEach(function (id) {
      var n = swayNodes[id];
      var f = n.base + Math.sin((now / n.period) * Math.PI * 2 + n.phase) * n.amp;
      AmbienceEngine.setLayer(id, Math.max(0, Math.min(100, f)), Boolean(state.muted[id]));
    });
  }

  function toggleDrift(announce) {
    state.drift = !state.drift;
    $("#driftButton").setAttribute("aria-checked", String(state.drift));
    clearInterval(state.driftTimer);
    if (state.drift) {
      swayResync();
      state.driftTimer = setInterval(swayTick, SWAY_TICK_MS);
    } else {
      var ids = Object.keys(swayNodes);
      swayNodes = {};
      ids.forEach(function (id) {
        AmbienceEngine.setLayer(id, state.values[id], Boolean(state.muted[id]));
      });
      document.querySelectorAll(".is-swaying").forEach(function (el) {
        el.classList.remove("is-swaying");
      });
    }
    UISound.play(state.drift ? "on" : "off");
    if (announce) toast(state.drift
      ? "Sway is on. Room levels rise and fall on their own. Your scene, music and weather never move."
      : "Sway is off. Levels are back where you set them.");
    persist();
  }







  /* ---------- the bonsai ----------
     Grows with quiet minutes spent here. Never dies, never resets, never
     guilts — the world changed a little, that is all. The stages are far
     enough apart that a new leaf is an event.                              */

  var BONSAI_STAGES = [0, 15, 60, 180, 600, 1500];   // minutes

  function quietMinutes() {
    return Number(localStorage.getItem("dwMinutes") || 0);
  }

  function bonsaiStage(mins) {
    var st = 0;
    for (var i = 0; i < BONSAI_STAGES.length; i++) if (mins >= BONSAI_STAGES[i]) st = i;
    return st;
  }

  function paintBonsai() {
    var el = $("#bonsai");
    if (!el) return;
    var mins = quietMinutes();
    var st = bonsaiStage(mins);
    el.dataset.stage = st;
    el.setAttribute("aria-label", "Your bonsai — grown from " + mins + " quiet minutes");
    var next = BONSAI_STAGES[st + 1];
    el.title = next ? (next - mins) + " quiet minutes to the next leaf" : "fully grown";
  }

  function startBonsaiClock() {
    setInterval(function () {
      if (!state.playing || document.hidden) return;
      try { localStorage.setItem("dwMinutes", String(quietMinutes() + 1)); } catch (e) {}
      paintBonsai();
    }, 60000);
    paintBonsai();
  }

  /* ---------- rare moments ----------
     Three unlisted visitors. No checklist, no announcement schedule — the
     point is that one day the boat is there, and you tell somebody.

     They ride the weather canvas's own loop, so an active moment keeps the
     loop alive exactly the way sparks do.                                  */

  var WATER_SCENES = { "great-wave": 1, "tama-moon": 1, "evening-snow": 1, "shin-ohashi": 1, "shono": 1 };
  var moment = null;          // the active visitor, if any
  var momentTimer = null;

  function momentsSeen() {
    try { return JSON.parse(localStorage.getItem("dwMoments") || "{}"); } catch (e) { return {}; }
  }

  function recordMoment(kind, label) {
    var seen = momentsSeen();
    var first = !seen[kind];
    seen[kind] = Date.now();
    try { localStorage.setItem("dwMoments", JSON.stringify(seen)); } catch (e) {}
    if (first) toast("You saw " + label + ". Not everyone does.", 5200);
    paintMomentShelf();
  }

  function paintMomentShelf() {
    var el = $("#momentsValue");
    if (!el) return;
    var count = Object.keys(momentsSeen()).length;
    el.textContent = count ? count + " of 3" : "none yet";
  }

  function tryStartMoment() {
    if (moment || document.hidden || reduceMotion.matches) return;
    var w = worlds[state.worldIndex];
    var isNight = document.documentElement.getAttribute("data-mode") === "night";
    var roll = Math.random();
    if (WATER_SCENES[w.id] && roll < 0.12) {
      moment = { kind: "boat", born: Date.now(), life: 38000 };
    } else if (isNight && state.weather === "rain" && roll < 0.16) {
      moment = { kind: "cat", born: Date.now(), life: 22000, flick: 0 };
    } else if (isNight && state.weather === "none" && roll < 0.14) {
      moment = { kind: "star", born: Date.now(), life: 1400,
                 x: weather.w * (0.15 + Math.random() * 0.5), y: weather.h * (0.08 + Math.random() * 0.15) };
    }
    if (moment) startWeather();
  }

  function stepMoment(c, now) {
    if (!moment) return;
    var t = (now - moment.born) / moment.life;
    if (t >= 1) {
      recordMoment(moment.kind,
        moment.kind === "boat" ? "the boat" : moment.kind === "cat" ? "the night cat" : "a falling star");
      moment = null;
      return;
    }
    if (moment.kind === "boat") {
      // a small hull gliding the lower third, right to left
      var bx = weather.w * (1.05 - t * 1.15);
      var by = weather.h * 0.66 + Math.sin(now / 900) * 2.5;
      c.fillStyle = "rgba(30,26,22,.78)";
      c.fillRect(bx, by, 34, 5);                       // hull
      c.fillRect(bx + 6, by - 3, 22, 3);               // gunwale
      c.fillRect(bx + 15, by - 14, 2, 12);             // boatman
      c.fillRect(bx + 12, by - 16, 8, 2);              // hat
      c.fillRect(bx + 17, by - 10, 10, 1);             // oar
    } else if (moment.kind === "cat") {
      // a silhouette at the lower-left corner of the picture, tail flicking
      var cx0 = weather.w * 0.06, cy0 = weather.h - 168;
      c.fillStyle = "rgba(18,16,14,.85)";
      c.fillRect(cx0 + 4, cy0 + 10, 22, 12);           // body
      c.fillRect(cx0 + 20, cy0 + 2, 10, 10);           // head
      c.fillRect(cx0 + 20, cy0 - 2, 3, 4);             // ear
      c.fillRect(cx0 + 27, cy0 - 2, 3, 4);             // ear
      var flick = Math.sin(now / 700) > 0.6 ? -6 : 0;  // the tail has opinions
      c.fillRect(cx0 - 4, cy0 + 8 + flick, 8, 3);
    } else if (moment.kind === "star") {
      var sx = moment.x + t * 130, sy = moment.y + t * 46;
      c.strokeStyle = "rgba(255,240,200," + (0.85 * (1 - t)) + ")";
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 26, sy - 9); c.stroke();
    }
  }

  /* ---------- share: rooms as postcards ----------
     Two artifacts, zero backend.

     A room URL carries the whole arrangement — print, sounds, weather, shade —
     in the hash, so every shared link opens the sender's exact room. And a
     postcard renders the moment to a PNG: the print, the weather mid-fall, a
     cartouche with the room's name, the seal. The research was unambiguous
     that "look what I made" artifacts are what actually travel; this is ours. */

  function encodeRoom(name) {
    var w = worlds[state.worldIndex];
    var p = new URLSearchParams();
    p.set("w", w.id);
    var sounds = [];
    roomLayers.forEach(function (l) {
      var v = state.values[l.id] || 0;
      if (v > 0 && !state.muted[l.id]) sounds.push(l.id + "." + v);
    });
    if (sounds.length) p.set("s", sounds.join("_"));
    if (state.weather !== "none") p.set("x", state.weather + "." + state.weatherIntensity);
    if (shade.v > 0.02) p.set("sh", Math.round(shade.v * 100));
    if (name) p.set("n", name);
    return location.origin + location.pathname + "#" + p.toString().replace(/%2E/g, ".");
  }

  function decodeRoomHash() {
    if (!location.hash || location.hash.length < 3) return null;
    try {
      var p = new URLSearchParams(location.hash.slice(1));
      if (!p.get("w")) return null;
      return p;
    } catch (e) { return null; }
  }

  // Applied after restore(), before power-on, so a shared link wins the boot.
  function applySharedRoom(p) {
    var id = p.get("w");
    for (var i = 0; i < worlds.length; i++) {
      if (worlds[i].id === id) { state.worldIndex = i; break; }
    }
    var s = p.get("s");
    if (s) {
      roomLayers.forEach(function (l) { state.values[l.id] = 0; });
      s.split("_").forEach(function (pair) {
        var kv = pair.split(".");
        if (state.values.hasOwnProperty(kv[0])) {
          state.values[kv[0]] = Math.max(0, Math.min(100, Number(kv[1]) || 0));
        }
      });
      state.activePreset = null;
    }
    var x = p.get("x");
    if (x) {
      var xkv = x.split(".");
      if (FX_BY_ID[xkv[0]]) {
        state.weather = xkv[0];
        state.weatherIntensity = Math.max(10, Math.min(100, Number(xkv[1]) || 48));
        state.weatherLocked = true;   // the sender chose this sky on purpose
      }
    }
    var sh = Number(p.get("sh"));
    // Commit rather than paint: a shared room's shade should bring its light
    // with it, not leave the chrome contradicting a drawn blind.
    if (sh > 0) setTimeout(function () { commitShade(sh / 100); }, 50);
    var name = p.get("n");
    toast(name ? "A room from a friend: “" + name + "”" : "A room from a friend.", 4200);
    // The link has been delivered; a reload should be the visitor's own state.
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }

  /* ---------- the postcard ---------- */

  function poeticName() {
    var w = worlds[state.worldIndex];
    var h = new Date().getHours();
    var tw = h < 5 ? "before dawn" : h < 11 ? "in the morning" : h < 15 ? "at midday"
           : h < 18 ? "in the afternoon" : h < 22 ? "in the evening" : "late at night";
    return w.title + ", " + tw;
  }

  function soundsSummary() {
    var live = [];
    roomLayers.forEach(function (l) {
      var v = state.values[l.id] || 0;
      if (v > 0 && !state.muted[l.id]) live.push(l.name.toLowerCase());
    });
    if (!live.length) return "silence";
    if (live.length > 3) return live.slice(0, 3).join(" · ") + " +" + (live.length - 3);
    return live.join(" · ");
  }

  function drawSeal(c, x, y, size) {
    // The 16-grid hanko, drawn as rects so the canvas needs no SVG rasterising.
    var u = size / 16;
    c.fillStyle = "#C73E2E";
    c.fillRect(x, y, size, size);
    c.fillStyle = "#F7EFE0";
    [[2,2,5,2],[2,4,2,3],[9,2,5,2],[12,4,2,3],[4,6,3,1],[9,6,3,1],[6,6,1,1],
     [10,8,2,3],[4,7,1,4],[6,9,2,2],[2,9,2,3],[4,12,3,2],[12,9,2,5],[9,12,3,2]
    ].forEach(function (r) { c.fillRect(x + r[0]*u, y + r[1]*u, r[2]*u, r[3]*u); });
  }

  function renderPostcard(name, done) {
    var w = worlds[state.worldIndex];
    var W = 1200, H = 630;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d");

    var img = new Image();
    img.onload = function () {
      // washi ground
      c.fillStyle = "#F2E8D5";
      c.fillRect(0, 0, W, H);

      // the print: landscape prints bleed across; portrait prints mount left
      var portrait = img.naturalHeight > img.naturalWidth;
      var px, py, pw, ph;
      if (portrait) {
        ph = H - 64; pw = ph * (img.naturalWidth / img.naturalHeight);
        px = 48; py = 32;
      } else {
        pw = W - 400; ph = pw * (img.naturalHeight / img.naturalWidth);
        if (ph > H - 64) { ph = H - 64; pw = ph * (img.naturalWidth / img.naturalHeight); }
        px = 48; py = (H - ph) / 2;
      }
      // paper shadow, then the print, then a sumi hairline
      c.save();
      c.shadowColor = "rgba(60,45,30,.35)"; c.shadowBlur = 24; c.shadowOffsetY = 8;
      c.fillStyle = "#fff"; c.fillRect(px, py, pw, ph);
      c.restore();
      c.drawImage(img, px, py, pw, ph);
      c.strokeStyle = "rgba(40,30,20,.55)"; c.lineWidth = 1.5;
      c.strokeRect(px + .75, py + .75, pw - 1.5, ph - 1.5);

      // the weather, mid-fall, clipped to the print
      var wc = $("#weatherCanvas");
      if (wc && wc.width > 0) {
        c.save();
        c.beginPath(); c.rect(px, py, pw, ph); c.clip();
        c.globalAlpha = .92;
        c.drawImage(wc, px, py, pw, ph);
        c.restore();
      }

      // cartouche column
      var cx = px + pw + 44;
      var cw = W - cx - 48;
      if (cw > 180) {
        drawSeal(c, cx, 48, 44);
        c.fillStyle = "#3A322A";
        c.font = "600 30px 'Silkscreen', monospace";
        c.fillText("UKIYO", cx + 58, 82);

        c.font = "700 30px 'Shippori Mincho', Georgia, serif";
        wrapText(c, "“" + name + "”", cx, 160, cw, 40);

        c.font = "16px 'IBM Plex Mono', monospace";
        c.fillStyle = "#6E5F52";
        wrapText(c, w.title + " · " + (w.artist || ""), cx, 240, cw, 24);
        wrapText(c, "sounds: " + soundsSummary(), cx, 300, cw, 24);
        var wx = state.weather !== "none" ? FX_BY_ID[state.weather].label.toLowerCase() : "clear";
        c.fillText("sky: " + wx, cx, 360);
        c.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), cx, 390);

        c.fillStyle = "#B83526";
        c.font = "15px 'IBM Plex Mono', monospace";
        c.fillText("a floating world machine", cx, H - 64);
      }
      done(cv);
    };
    img.onerror = function () { toast("The postcard could not be made."); };
    img.src = w.art || w.poster;
  }

  function wrapText(c, text, x, y, maxW, lh) {
    var words = String(text).split(" "), line = "";
    words.forEach(function (word) {
      var probe = line ? line + " " + word : word;
      if (c.measureText(probe).width > maxW && line) {
        c.fillText(line, x, y); y += lh; line = word;
      } else line = probe;
    });
    if (line) c.fillText(line, x, y);
    return y;
  }

  function sharePostcard() {
    var name = poeticName();
    UISound.play("scene");
    renderPostcard(name, function (cv) {
      cv.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], "ukiyo-postcard.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "UKIYO", text: name }).catch(function () {});
        } else {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "ukiyo-postcard.png";
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          toast("Postcard saved. “" + name + "”");
        }
      }, "image/png");
    });
  }

  function copyRoomLink() {
    var name = poeticName();
    var url = encodeRoom(name);
    var doneMsg = "Room link copied. Anyone who opens it gets this exact room.";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast(doneMsg, 4200); },
        function () { window.prompt("Copy the room link:", url); });
    } else {
      window.prompt("Copy the room link:", url);
    }
    UISound.play("on");
  }

  /* ---------- the window shade ----------
     Pulling it binds the scene's brightness AND the chrome's palette to the
     gesture, updating on every pointermove. Release snaps to the nearest of
     three detents — open (day), half-drawn (dusk), drawn (night) — and the
     detent BECOMES the display mode: the shade and the Display row are the
     same control seen twice. The old build only moved the chrome in auto mode
     and let the clock timer yank it back a minute later, which read as broken.
     applyMode() moves the blind whenever the mode changes from anywhere else,
     so the two can never disagree. */

  var shade = { v: 0, dragging: false, startY: 0, startV: 0, h: 1, seq: 0 };
  var SHADE_POS = { day: 0, dusk: 0.5, night: 1 };
  var SHADE_TRAVEL = 0.55;   // fraction of the window the blind travels — must match the 55% in styles.css

  function modeForShade(v) { return v < 0.25 ? "day" : v < 0.7 ? "dusk" : "night"; }

  // `live` marks a change owned by the user's hand (or an animation finishing
  // one): only those crossfade the chrome mid-flight. Programmatic syncs from
  // applyMode() arrive with the mode already set and must not write it again.
  function paintShade(v, live) {
    shade.v = Math.max(0, Math.min(1, v));
    world.style.setProperty("--shade", shade.v.toFixed(3));
    var m = modeForShade(shade.v);
    var grip = $("#shadeGrip");
    if (grip) {
      grip.setAttribute("aria-valuenow", String(Math.round(shade.v * 100)));
      grip.setAttribute("aria-valuetext", MODE_LABEL[m]);
      grip.setAttribute("data-hint", m === "day" ? "Pull for night" : m === "night" ? "Lift for day" : "Dusk");
    }
    // Crossfade the faceplate through dusk on the way down, so the chrome
    // travels with the light instead of snapping at the end.
    if (live && document.documentElement.getAttribute("data-mode") !== m) {
      document.documentElement.setAttribute("data-mode", m);
    }
  }

  function animateShade(to, live) {
    var seq = ++shade.seq;
    if (reduceMotion.matches) { paintShade(to, live); return; }
    var from = shade.v, t0 = performance.now(), MS = 420, settled = false;
    (function step(now) {
      if (seq !== shade.seq) return;             // a newer gesture owns the shade
      var p = Math.min(1, (now - t0) / MS);
      // easeOutQuint, the same shape as --ease-out
      var e = 1 - Math.pow(1 - p, 5);
      paintShade(from + (to - from) * e, live);
      if (p < 1) requestAnimationFrame(step);
      else settled = true;
    })(t0);
    // rAF is throttled to nothing in background tabs — where an ambience app
    // spends its life — so the destination is guaranteed on a timer. Same
    // lesson as the token drag: never let a frame callback own a final state.
    setTimeout(function () {
      if (seq === shade.seq && !settled) { settled = true; paintShade(to, live); }
    }, MS + 80);
  }

  // Release rule: the nearest detent wins, and the detent becomes the mode —
  // set BEFORE the blind settles, not after: a slideshow advance mid-animation
  // calls applyMode(), and if the mode were still pending, that call would
  // resolve against the old mode and yank the blind straight back. A drag that
  // lands where auto already resolves stays on auto, so the person who never
  // asked for a manual override keeps the clock and the scene tone.
  function commitShade(v) {
    var to = v < 0.25 ? 0 : v < 0.7 ? 0.5 : 1;
    var m = modeForShade(to);
    if (!(state.mode === "auto" && m === resolvedMode())) state.mode = m;
    applyMode();          // sets the chrome and animates the blind to its detent
    persist();
    return m;
  }

  function bindShade() {
    var grip = $("#shadeGrip");
    if (!grip) return;
    // No initial paint: applyMode() runs first at boot and slides the blind to
    // the mode's own position. Painting 0 here used to stomp the boot mode
    // back to "day" on every load, whatever the hour or the scene.

    function down(e) {
      if (e.button !== undefined && e.button !== 0) return;
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      shade.seq++;                               // cancel any in-flight animation
      shade.dragging = true;
      shade.startY = e.clientY;
      shade.startV = shade.v;
      shade.h = Math.max(1, world.getBoundingClientRect().height * SHADE_TRAVEL);
      $("#shade").style.transition = "none";
      UISound.play("press");
      e.preventDefault();
    }
    function move(e) {
      if (!shade.dragging) return;
      paintShade(shade.startV + (e.clientY - shade.startY) / shade.h, true);
    }
    function up(e) {
      if (!shade.dragging) return;
      shade.dragging = false;
      try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
      UISound.play(commitShade(shade.v) === "night" ? "off" : "on");
    }

    grip.addEventListener("pointerdown", down);
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
    // Keyboard: the shade must be reachable without a pointer (SC 2.5.7).
    // Steps walk the three detents rather than raw tenths, so every keypress
    // lands on a state that means something.
    grip.addEventListener("keydown", function (e) {
      var order = ["day", "dusk", "night"];
      var i = order.indexOf(modeForShade(shade.v)), to = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") to = order[Math.min(2, i + 1)];
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = order[Math.max(0, i - 1)];
      else if (e.key === "Home") to = "day";
      else if (e.key === "End") to = "night";
      else if (e.key === "Enter" || e.key === " ") to = shade.v >= 0.5 ? "day" : "night";
      if (to === null) return;
      e.preventDefault();
      commitShade(SHADE_POS[to]);
    });
  }

  // The grip is quiet by design, so the first visit gets one pointer at it.
  // Any interaction with it — ever — retires the hint for good.
  function shadeHint() {
    var el = $("#shade"), grip = $("#shadeGrip");
    if (!el || !grip) return;
    try { if (localStorage.getItem("dwShadeHint")) return; } catch (e) { return; }
    function dismiss() {
      el.classList.remove("shade-hint");
      try { localStorage.setItem("dwShadeHint", "1"); } catch (e) {}
    }
    grip.addEventListener("pointerdown", dismiss, { once: true });
    grip.addEventListener("keydown", dismiss, { once: true });
    setTimeout(function () {
      try { if (localStorage.getItem("dwShadeHint")) return; } catch (e) { return; }
      el.classList.add("shade-hint");
      toast("The blind at the top switches day and night — pull its handle.", 5200);
    }, 2600);
  }

  // The chips explain themselves once: they are sounds you can pick up.
  // Touching any token — ever — retires the hint for good.
  function tokensHint() {
    var host = $("#tokenLayer");
    if (!host) return;
    try { if (localStorage.getItem("dwTokenHint")) return; } catch (e) { return; }
    function dismiss() {
      try { localStorage.setItem("dwTokenHint", "1"); } catch (e) {}
    }
    host.addEventListener("pointerdown", dismiss, { once: true });
    setTimeout(function () {
      try { if (localStorage.getItem("dwTokenHint")) return; } catch (e) { return; }
      if (window.innerWidth <= 640) return;   // no tokens on a phone
      toast("The small chips are sounds — drag one onto the scene. Higher is louder, left is left.", 6000);
      dismiss();
    }, 9800);
  }

  /* ---------- sound tokens ----------
     The twelve room layers as objects on the scene.

       vertical position   -> level   (higher is louder)
       horizontal position -> pan     (left is left)

     Both apply on every pointermove, not on release. That continuous binding is
     the whole point: the room has to answer your hand while it is moving, the
     way the reference clip binds a page's lightness to a shade being pulled.

     state.values stays the authority. A token writes into it and the mixer
     faders read from it, so the two are the same control seen twice — and the
     faders remain the non-drag path that SC 2.5.7 requires.                  */

  var TOKEN_PAD = 56;              // keep tokens clear of the readout and dock
  var tokens = {};                 // id -> { el, grab, x, y }
  var tokenIdleTimer = null;

  function tokenBounds() {
    var r = world.getBoundingClientRect();
    return { minX: TOKEN_PAD, maxX: Math.max(TOKEN_PAD, r.width - TOKEN_PAD),
             minY: TOKEN_PAD + 40, maxY: Math.max(TOKEN_PAD, r.height - 150) };
  }

  // Position <-> value. Level is inverted because up should mean more.
  function tokenToValues(x, y) {
    var b = tokenBounds();
    var spanY = Math.max(1, b.maxY - b.minY), spanX = Math.max(1, b.maxX - b.minX);
    var level = Math.round(100 * (1 - (y - b.minY) / spanY));
    var pan = ((x - b.minX) / spanX) * 2 - 1;
    return { level: Math.max(0, Math.min(100, level)), pan: Math.max(-1, Math.min(1, pan)) };
  }
  function valuesToToken(level, pan, index) {
    var b = tokenBounds();
    var y = b.minY + (1 - level / 100) * (b.maxY - b.minY);
    // A silent channel has no meaningful pan, so its x would be identical for
    // every one of them. Park them along the foot of the scene instead, spread
    // by index: a tray made out of position rather than out of more markup.
    if (level <= 0 && typeof index === "number") {
      var n = Math.max(1, roomLayers.length);
      var slot = (index + 0.5) / n;
      return { x: b.minX + slot * (b.maxX - b.minX), y: b.maxY };
    }
    return { x: b.minX + ((pan + 1) / 2) * (b.maxX - b.minX), y: y };
  }

  function panWord(pan) {
    if (pan < -0.12) return "left " + Math.round(-pan * 100) + "%";
    if (pan > 0.12) return "right " + Math.round(pan * 100) + "%";
    return "centre";
  }

  // While it is held, the token shows what it currently is — the way the
  // reference's card swaps its content for its drop target mid-drag.
  function paintToken(id) {
    var t = tokens[id];
    if (!t) return;
    var v = state.values[id] || 0;
    var muted = Boolean(state.muted[id]);
    var pan = AmbienceEngine.getPan ? AmbienceEngine.getPan(id) : 0;
    t.el.classList.toggle("is-off", v <= 0 || muted);
    t.el.querySelector(".token-val").textContent =
      muted ? "muted" : (v <= 0 ? "off" : v + "% · " + panWord(pan));
    t.el.setAttribute("aria-label", t.name + ", " + (muted ? "muted" : v + " percent, " + panWord(pan)));
  }

  function applyTokenPosition(id, x, y) {
    var v = tokenToValues(x, y);
    tokens[id].x = x; tokens[id].y = y;
    if (AmbienceEngine.setPan) AmbienceEngine.setPan(id, v.pan);
    setLayerValue(id, v.level, true);
    paintToken(id);
  }

  function wakeTokens() {
    var host = $("#tokenLayer");
    if (!host) return;
    host.classList.remove("is-idle");
    clearTimeout(tokenIdleTimer);
    // Fade back to an outline so the painting is clean when you are only looking.
    tokenIdleTimer = setTimeout(function () { host.classList.add("is-idle"); }, 4000);
  }

  function renderTokens() {
    var host = $("#tokenLayer");
    if (!host) return;
    host.innerHTML = "";
    tokens = {};
    host.removeAttribute("aria-hidden");
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", "Sound placement");

    roomLayers.forEach(function (l, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "token";
      el.dataset.token = l.id;
      el.style.setProperty("--tint", l.tint || "var(--amber)");
      el.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#' + l.icon + '"></use></svg>' +
        '<span class="token-copy"><strong>' + l.name + '</strong>' +
        '<span class="token-val"></span></span>';

      // A live channel that was never panned sits at dead centre, so three
      // live chips stacked in one column over the picture — often the face.
      // Fan them into a gentle stereo spread instead; silent channels park.
      var pan0 = AmbienceEngine.getPan ? AmbienceEngine.getPan(l.id) : 0;
      if ((state.values[l.id] || 0) > 0 && !pan0 && AmbienceEngine.setPan) {
        pan0 = ((i % 3) - 1) * 0.34;
        AmbienceEngine.setPan(l.id, pan0);
      }
      var pos = valuesToToken(state.values[l.id] || 0, pan0, i);
      var grab = Grabbable.make(el, {
        tilt: Grabbable.tiltFor(i),
        bounds: tokenBounds,
        onGrab: function () { wakeTokens(); UISound.play("press"); el.classList.add("is-live-drag"); },
        onMove: function (s) { applyTokenPosition(l.id, s.x, s.y); wakeTokens(); },
        onDrop: function (s) {
          el.classList.remove("is-live-drag");
          applyTokenPosition(l.id, s.x, s.y);
          // paper lands on paper: a ring of ink and a soft thump
          var hex = (l.tint || "#888888").replace("#", "");
          var rgb = parseInt(hex.slice(0,2),16) + "," + parseInt(hex.slice(2,4),16) + "," + parseInt(hex.slice(4,6),16);
          inkRipple(s.x + 22, s.y + 22, rgb);
          UISound.play("thump");
          persist();
        }
      });
      // Register before the first moveTo: moveTo calls onMove, and onMove writes
      // through tokens[id]. The other order threw on the first token and left
      // the boot sequence hanging at 0%.
      tokens[l.id] = { el: el, grab: grab, x: pos.x, y: pos.y, name: l.name };
      grab.moveTo(pos.x, pos.y, false);

      // Keyboard path. Arrows move the token exactly as a pointer would, so the
      // gesture is not the only way to reach a value.
      el.addEventListener("keydown", function (e) {
        var step = e.shiftKey ? 24 : 8, t = tokens[l.id], moved = true;
        if (e.key === "ArrowUp") t.y -= step;
        else if (e.key === "ArrowDown") t.y += step;
        else if (e.key === "ArrowLeft") t.x -= step;
        else if (e.key === "ArrowRight") t.x += step;
        else moved = false;
        if (!moved) return;
        e.preventDefault();
        var b = tokenBounds();
        t.x = Math.max(b.minX, Math.min(b.maxX, t.x));
        t.y = Math.max(b.minY, Math.min(b.maxY, t.y));
        t.grab.moveTo(t.x, t.y, true);
        applyTokenPosition(l.id, t.x, t.y);
        wakeTokens();
      });
      el.addEventListener("focus", wakeTokens);

      host.appendChild(el);
      paintToken(l.id);
    });
    wakeTokens();
  }

  // Re-seat every token when the window changes shape, or they drift off-screen.
  function reseatTokens() {
    Object.keys(tokens).forEach(function (id) {
      var pan = AmbienceEngine.getPan ? AmbienceEngine.getPan(id) : 0;
      var p = valuesToToken(state.values[id] || 0, pan, roomLayers.map(function (l) { return l.id; }).indexOf(id));
      tokens[id].x = p.x; tokens[id].y = p.y;
      tokens[id].grab.moveTo(p.x, p.y, false);
      paintToken(id);
    });
  }

  /* ---------- LED meters — one shared 10fps loop, not 12 analysers ---------- */

  /* ---------- dock VU ----------
     What you are doing to the room, visible without opening the mixer. Reads
     the same analyser output the channel meters do, summed. The peak cap falls
     at a fixed rate rather than tracking the signal, which is what separates
     an instrument from a bar chart.                                        */

  var vuPeak = 0;

  function paintVU() {
    var host = $("#vu");
    if (!host) return;
    var sum = 0;
    for (var i = 0; i < roomLayers.length; i++) sum += AmbienceEngine.getLevel(roomLayers[i].id) || 0;
    // A typical preset runs three or four channels, so the divisor is set
    // against that rather than against all twelve at once — otherwise the
    // meter never leaves the first two bars and tells you nothing.
    var level = Math.max(0, Math.min(1, sum / 1.5));
    vuPeak = Math.max(level, vuPeak - 0.018);      // slow fall, fixed rate

    var bars = host.getElementsByTagName("span");
    var lit = Math.round(level * bars.length);
    for (var b = 0; b < bars.length; b++) {
      bars[b].className = b < lit ? "is-lit" : "";
    }
    var cap = host.querySelector(".vu-peak");
    if (cap) cap.style.left = (vuPeak * 100) + "%";
    host.classList.toggle("is-live", level > 0.01);
  }

  function startMeters() {
    if (meterTimer) return;
    meterTimer = setInterval(function () {
      for (var i = 0; i < roomLayers.length; i++) {
        var el = document.getElementById("meter-" + roomLayers[i].id);
        if (!el) continue;
        el.style.setProperty("--lvl", Math.round(AmbienceEngine.getLevel(roomLayers[i].id) * 100) + "%");
      }
      paintVU();
    }, 100);
  }
  function stopMeters() {
    clearInterval(meterTimer); meterTimer = null;
    roomLayers.forEach(function (l) {
      var el = document.getElementById("meter-" + l.id);
      if (el) el.style.setProperty("--lvl", "0%");
    });
    vuPeak = 0;
    paintVU();
  }

  /* ---------- weather — the loop only exists while it is switched on ----------
     The old build cleared a 2560x1440 canvas every frame forever, because the
     "none" check happened after the clear and "none" is the default.

     Effects live in one registry. Adding one is a single object; the chips,
     the labels and the persistence all read from this list. It used to be an
     if/else chain repeated in three functions.

     Intensity drives five axes at once — count, speed, size, alpha and wind.
     It used to change the particle count and nothing else, which is why the
     slider did almost nothing: rain at 100 lit 0.21% of the screen.          */

  var weather = { canvas: null, ctx: null, particles: [], frame: null, w: 0, h: 0,
                  resizeQueued: false, glow: {} };

  function weatherActive() { return state.weather !== "none" && !reduceMotion.matches; }

  /* ---------- poke the scene ----------
     Touch the picture and it answers. This is the one place in the app where
     the thing you press is the thing that moves — everywhere else you press a
     control and something else changes. Sparks borrow the current weather's
     colour so a rainy scene splashes and a lit one throws embers.        */

  var sparks = [];
  var ripples = [];

  function inkRipple(x, y, tint) {
    ripples.push({ x: x, y: y, r: 6, life: 1, tint: tint || "120,120,140" });
    startWeather();
  }

  function stepRipples(c) {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var p = ripples[i];
      p.r += 2.6; p.life -= 0.035;
      if (p.life <= 0) { ripples.splice(i, 1); continue; }
      c.strokeStyle = "rgba(" + p.tint + "," + (p.life * 0.5) + ")";
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.stroke();
      // a second, older ring gives it the spreading-ink read
      c.strokeStyle = "rgba(" + p.tint + "," + (p.life * 0.22) + ")";
      c.beginPath(); c.arc(p.x, p.y, p.r * 1.6, 0, 6.283); c.stroke();
    }
  }
  var SPARK_TINT = { rain: "204,226,245", snow: "245,248,255", mist: "226,238,247",
                     petals: "247,186,196", leaves: "216,158,74",
                     fireflies: "255,206,102", embers: "255,148,58",
                     none: "255,232,168" };

  /* ---------- the whip ----------
     Double-tap the empty scene: right half cracks the whip upward and steps
     the volume up, left half mirrors it and steps down. On touch, a vertical
     drag on the right half rides the level continuously — the VLC gesture.
     The gesture drives the music level when a source is tuned, otherwise the
     room, so it always does something audible. The sliders remain the
     visible, accessible path to the same values. */

  var WHIP_STEP = 5;
  var whipTimer = null;

  function applyMusicLevel(v) {
    state.musicLevel = Math.max(0, Math.min(100, Math.round(v)));
    var inp = $("#musicVolume");
    if (inp) { inp.value = state.musicLevel; inp.style.setProperty("--fill", state.musicLevel + "%"); }
    var out = $("#musicOutput");
    if (out) out.textContent = state.musicLevel + "%";
    if (ytPlayer && state.ytReady) { try { ytPlayer.setVolume(Math.round(state.musicLevel * 0.8)); } catch (e) {} }
    persist();
  }

  function applyRoomLevel(v) {
    state.roomLevel = Math.max(0, Math.min(100, Math.round(v)));
    var inp = $("#roomVolume");
    if (inp) { inp.value = state.roomLevel; inp.style.setProperty("--fill", state.roomLevel + "%"); }
    var out = $("#roomOutput");
    if (out) out.textContent = state.roomLevel + "%";
    AmbienceEngine.setMaster(state.roomLevel);
    wakeRoom();
    persist();
  }

  function whipTargetsMusic() { return Boolean(state.source) && !state.ytFailed; }

  function showWhip(dir, x, y, level, sustain) {
    var el = $("#whip");
    if (!el) return;
    el.hidden = false;
    el.classList.toggle("is-down", dir < 0);
    el.style.left = Math.max(60, Math.min(window.innerWidth - 60, x)) + "px";
    el.style.top = Math.max(60, Math.min(window.innerHeight - 150, y)) + "px";
    $("#whipRead").textContent = (dir > 0 ? "+" : "−") + level + "%";
    if (!sustain || !el.classList.contains("is-go")) {
      el.classList.remove("is-go");
      void el.offsetWidth;
      el.classList.add("is-go");
      // A swipe rides the level continuously, so it must not re-lash on every
      // frame — only a discrete double-tap throws the rope. The rope carries
      // its own lash/crack audio; nothing is layered on top of it.
      if (!sustain && window.WhipFX) {
        WhipFX.crack(dir, x, y, dir > 0 ? "#FFC24A" : "#FF836A", null);
      }
    }
    clearTimeout(whipTimer);
    whipTimer = setTimeout(function () {
      el.classList.remove("is-go");
      el.hidden = true;
    }, sustain ? 900 : 900);
  }

  function whipVolume(dir, x, y) {
    var level;
    if (whipTargetsMusic()) { applyMusicLevel(state.musicLevel + dir * WHIP_STEP); level = state.musicLevel; }
    else { applyRoomLevel(state.roomLevel + dir * WHIP_STEP); level = state.roomLevel; }
    showWhip(dir, x, y, level, false);
  }

  var pokedThisSession = false;
  function pokeScene(x, y) {
    if (reduceMotion.matches) return;
    // the first touch of a visit answers louder, so the secret teaches itself
    var generous = !pokedThisSession;
    pokedThisSession = true;
    if (!weather.canvas) { weather.canvas = $("#weatherCanvas"); weather.ctx = weather.canvas.getContext("2d"); }
    if (!weather.canvas.width) sizeWeather();
    var tint = SPARK_TINT[state.weather] || SPARK_TINT.none;
    var n = (generous ? 30 : 14) + Math.round(Math.random() * 8);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var speed = 1.2 + Math.random() * 4.2;
      sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 1.1,          // a little lift, so it reads as a splash
        r: 1 + Math.random() * 2.4,
        life: 1, decay: 0.012 + Math.random() * 0.016,
        tint: tint
      });
    }
    if (sparks.length > 320) sparks.splice(0, sparks.length - 320);
    startWeather();
  }

  function stepSparks(c) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.13;                 // gravity
      p.vx *= 0.985;                // drag
      p.life -= p.decay;
      if (p.life <= 0 || p.y > weather.h + 30) { sparks.splice(i, 1); continue; }
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = "rgb(" + p.tint + ")";
      c.beginPath();
      c.arc(p.x, p.y, p.r * p.life, 0, 6.283);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // intensity 10..100 -> 0..1
  function wt() { return Math.max(0, Math.min(1, (state.weatherIntensity - 10) / 90)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Density is quoted against a 1440x900 reference so a phone is not blizzarded
  // and a 4K display is not left empty.
  function areaScale() {
    return Math.max(.55, Math.min(1.7, Math.sqrt((weather.w * weather.h) / 1296000)));
  }

  // shadowBlur re-rasterises per draw call and was the most expensive thing in
  // the old loop. One cached radial sprite per colour is far cheaper, so the
  // glow effects can afford many more particles.
  function glowSprite(rgb) {
    if (weather.glow[rgb]) return weather.glow[rgb];
    var s = document.createElement("canvas");
    s.width = s.height = 32;
    var g = s.getContext("2d");
    var rad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rad.addColorStop(0,   "rgba(" + rgb + ",1)");
    rad.addColorStop(.28, "rgba(" + rgb + ",.55)");
    rad.addColorStop(1,   "rgba(" + rgb + ",0)");
    g.fillStyle = rad; g.fillRect(0, 0, 32, 32);
    weather.glow[rgb] = s;
    return s;
  }

  function drawGlow(c, rgb, x, y, r, a) {
    c.globalAlpha = a;
    c.drawImage(glowSprite(rgb), x - r * 3, y - r * 3, r * 6, r * 6);
    c.globalAlpha = 1;
  }

  // Petals and leaves are the same motion with different weight and colour, so
  // they share a factory. That sharing is the point of having a registry.
  function driftFall(cfg) {
    return {
      count: function (t) { return Math.round(lerp(cfg.nMin, cfg.nMax, t)); },
      make: function (t, anywhere) {
        return { x: Math.random() * weather.w,
                 y: anywhere ? Math.random() * weather.h : -20,
                 v: lerp(cfg.vMin, cfg.vMax, t) * rnd(.6, 1.4),
                 r: lerp(cfg.rMin, cfg.rMax, t) * rnd(.6, 1.3),
                 sway: lerp(cfg.swayMin, cfg.swayMax, t) * rnd(.5, 1.3),
                 spin: lerp(cfg.spinMin, cfg.spinMax, t) * (Math.random() < .5 ? -1 : 1),
                 ang: Math.random() * 6.283,
                 ph: Math.random() * 6.283,
                 a: lerp(cfg.aMin, cfg.aMax, t) * rnd(.7, 1.15) };
      },
      step: function (p, t, now) {
        p.y += p.v;
        p.ang += p.spin;
        p.x += Math.sin(now / 1900 + p.ph) * (p.sway / 55);
        return p.y < weather.h + 30;
      },
      draw: function (c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.ang);
        c.fillStyle = "rgba(" + cfg.rgb + "," + Math.min(1, p.a) + ")";
        // A squashed ellipse tumbling on its own axis reads as a leaf far more
        // cheaply than an authored sprite, and it never has to be loaded.
        c.beginPath();
        c.ellipse(0, 0, p.r, p.r * cfg.squash, 0, 0, 6.283);
        c.fill();
        c.restore();
      }
    };
  }

  var WEATHER_FX = [
    { id: "none", label: "Off", icon: "i-x" },

    { id: "rain", label: "Rain", icon: "i-cloud-rain",
      count: function (t) { return Math.round(lerp(90, 620, t * t * .55 + t * .45)); },
      make: function (t, anywhere) {
        return { x: Math.random() * weather.w,
                 y: anywhere ? Math.random() * weather.h : rnd(-140, -10),
                 v: lerp(6, 19, t) * rnd(.75, 1.35),
                 len: lerp(10, 40, t) * rnd(.65, 1.4),
                 w: lerp(.8, 1.7, t),
                 a: lerp(.22, .58, t) * rnd(.65, 1.25) };
      },
      step: function (p, t) { p.y += p.v; p.x -= lerp(.4, 3.4, t); return p.y < weather.h + 50; },
      draw: function (c, p, t) {
        c.strokeStyle = "rgba(214,232,246," + Math.min(1, p.a) + ")";
        c.lineWidth = p.w;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - lerp(1.5, 8, t), p.y + p.len);
        c.stroke();
      } },

    { id: "snow", label: "Snow", icon: "i-snowflake",
      count: function (t) { return Math.round(lerp(70, 430, t)); },
      make: function (t, anywhere) {
        return { x: Math.random() * weather.w,
                 y: anywhere ? Math.random() * weather.h : -16,
                 v: lerp(.35, 2.6, t) * rnd(.55, 1.5),
                 r: lerp(.9, 3.6, t) * rnd(.5, 1.3),
                 sway: lerp(6, 38, t), ph: Math.random() * 6.283,
                 a: lerp(.34, .88, t) * rnd(.6, 1.2) };
      },
      step: function (p, t, now) {
        p.y += p.v;
        p.x += Math.sin(now / 2200 + p.ph) * (p.sway / 60) - lerp(0, 1.7, t);
        return p.y < weather.h + 16;
      },
      draw: function (c, p) {
        c.fillStyle = "rgba(245,248,255," + Math.min(1, p.a) + ")";
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
      } },

    { id: "mist", label: "Mist", icon: "i-wind",
      // Bands rather than points — same loop, a different primitive.
      count: function (t) { return Math.round(lerp(4, 11, t)); },
      make: function (t, anywhere) {
        var h = lerp(80, 210, t) * rnd(.7, 1.5);
        return { x: anywhere ? Math.random() * weather.w : -weather.w * .7,
                 y: Math.random() * weather.h, h: h,
                 bw: weather.w * rnd(.8, 1.7),
                 v: lerp(.08, .42, t) * rnd(.5, 1.5),
                 a: lerp(.11, .40, t) };
      },
      step: function (p) { p.x += p.v; return p.x < weather.w * 1.5; },
      draw: function (c, p) {
        var g = c.createLinearGradient(0, p.y, 0, p.y + p.h);
        g.addColorStop(0, "rgba(226,238,247,0)");
        g.addColorStop(.5, "rgba(226,238,247," + p.a + ")");
        g.addColorStop(1, "rgba(226,238,247,0)");
        c.fillStyle = g;
        c.fillRect(p.x - p.bw / 2, p.y, p.bw, p.h);
      } },

    { id: "petals", label: "Petals", icon: "i-drop",
      fx: driftFall({ rgb: "247,186,196", squash: .55,
                      nMin: 34, nMax: 220, vMin: .5, vMax: 2.4, rMin: 3.2, rMax: 8.5,
                      swayMin: 14, swayMax: 46, spinMin: .02, spinMax: .1,
                      aMin: .48, aMax: .88 }) },

    { id: "leaves", label: "Leaves", icon: "i-tree",
      fx: driftFall({ rgb: "216,158,74", squash: .42,
                      nMin: 26, nMax: 170, vMin: .4, vMax: 1.8, rMin: 4.2, rMax: 12.5,
                      swayMin: 18, swayMax: 58, spinMin: .01, spinMax: .06,
                      aMin: .5, aMax: .9 }) },

    { id: "fireflies", label: "Fireflies", icon: "i-sparkle", blend: "lighter",
      count: function (t) { return Math.round(lerp(34, 175, t)); },
      make: function (t, anywhere) {
        return { x: Math.random() * weather.w,
                 y: anywhere ? Math.random() * weather.h : weather.h + 12,
                 v: lerp(.12, .55, t) * rnd(.5, 1.5),
                 r: lerp(1.9, 3.8, t) * rnd(.7, 1.3),
                 wander: lerp(.35, 1.2, t),
                 ph: Math.random() * 6.283,
                 // Fading fully to zero and back is what sells them; always-on
                 // dots read as dust.
                 lifePh: Math.random() * 6.283,
                 lifeP: rnd(2200, 5200),
                 a: lerp(.55, .95, t) };
      },
      step: function (p, t, now) {
        p.y -= p.v;
        p.x += Math.sin(now / 1400 + p.ph) * p.wander;
        return p.y > -14;
      },
      draw: function (c, p, t, now) {
        var env = (Math.sin((now / p.lifeP) * 6.283 + p.lifePh) + 1) / 2;
        drawGlow(c, "255,206,102", p.x, p.y, p.r, p.a * (0.3 + 0.7 * env * env));
      } },

    { id: "embers", label: "Embers", icon: "i-fire", blend: "lighter",
      count: function (t) { return Math.round(lerp(42, 250, t)); },
      make: function (t, anywhere) {
        return { x: Math.random() * weather.w,
                 y: anywhere ? Math.random() * weather.h : weather.h + 12,
                 v: lerp(.5, 2.1, t) * rnd(.5, 1.6),
                 r: lerp(1.4, 3.4, t) * rnd(.6, 1.4),
                 wander: lerp(.45, 1.6, t),
                 ph: Math.random() * 6.283,
                 born: Date.now(),
                 life: lerp(6200, 3200, t) * rnd(.7, 1.3),
                 a: lerp(.55, .95, t) };
      },
      step: function (p, t, now) {
        p.y -= p.v;
        p.x += Math.sin(now / 900 + p.ph) * p.wander;
        return p.y > -14 && (now - p.born) < p.life;
      },
      draw: function (c, p, t, now) {
        var age = (now - p.born) / p.life;
        drawGlow(c, "255,148,58", p.x, p.y, p.r, p.a * (1 - age) * (1 - age));
      } }
  ];

  // Effects declared with `fx:` get their four functions from the shared factory.
  WEATHER_FX.forEach(function (f) {
    if (f.fx) { f.count = f.fx.count; f.make = f.fx.make; f.step = f.fx.step; f.draw = f.fx.draw; }
  });

  var FX_BY_ID = {};
  WEATHER_FX.forEach(function (f) { FX_BY_ID[f.id] = f; });
  var WEATHER_COLS = 4;

  function fx() { return FX_BY_ID[state.weather] || null; }

  /* ---------- the room drives the scene ----------
     Turning the rain up should put rain on the window. The three layers were
     built to stay independent, and they still are — the scene, the music and
     the mix never disturb each other. But independence was reading as
     disconnection, because nothing you did in one place was visible anywhere
     else.

     So: the loudest weather-shaped channel in the mix chooses the effect, and
     its fader position sets the intensity. Choosing a weather chip by hand
     takes the wheel back until you hand it over again.                     */

  var ROOM_WEATHER = {
    rain: "rain", thunder: "rain", stream: "rain",
    fire: "embers", night: "fireflies",
    wind: "mist", soft: "mist", ocean: "mist",
    forest: "leaves"
  };

  function roomWeather() {
    var bestId = null, best = 0;
    for (var id in ROOM_WEATHER) {
      var v = state.values[id] || 0;
      // A preset that leaves soft air at 10 should not put mist on the screen;
      // this is the level at which a channel is deliberately up.
      if (state.muted[id] || v < 22) continue;
      if (v > best) { best = v; bestId = id; }
    }
    return bestId ? { effect: ROOM_WEATHER[bestId], level: best, from: bestId } : null;
  }

  function syncWeatherToRoom() {
    if (state.weatherLocked) return;
    var pick = roomWeather();
    var wantFx = pick ? pick.effect : "none";
    // Map a 0-100 fader onto the slider's own 10-100 range.
    var wantIntensity = pick ? Math.round(10 + (pick.level / 100) * 90) : state.weatherIntensity;

    if (pick && wantIntensity !== state.weatherIntensity) {
      state.weatherIntensity = wantIntensity;
      var slider = $("#weatherIntensity");
      if (slider) { slider.value = wantIntensity; slider.style.setProperty("--fill", wantIntensity + "%"); }
      seedParticles();
    }
    if (wantFx !== state.weather) setWeather(wantFx, false);
    var out = $("#weatherValue");
    if (out && !state.weatherLocked) {
      out.textContent = pick ? FX_BY_ID[wantFx].label + " · from the room" : "Off";
    }
  }

  function sizeWeather() {
    if (typeof reseatTokens === "function") reseatTokens();
    var wNow = worlds[state.worldIndex];
    if (wNow && wNow.kind === "artshow") world.classList.toggle("mounted-print", fitsMounted(wNow));
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
    var f = fx();
    if (!weatherActive() || !f || !f.count) { weather.particles = []; return; }
    var t = wt(), n = Math.round(f.count(t) * areaScale());
    weather.particles = [];
    for (var i = 0; i < n; i++) weather.particles.push(f.make(t, true));
  }

  function drawWeather() {
    var f = fx();
    // Sparks keep the loop alive on their own, so poking works with weather off.
    if ((!weatherActive() || !f) && !sparks.length && !ripples.length && !moment) { stopWeather(); return; }
    var c = weather.ctx, now = Date.now(), t = wt();
    c.clearRect(0, 0, weather.w, weather.h);
    if (!weatherActive() || !f) {
      stepSparks(c);
      stepRipples(c);
      stepMoment(c, now);
      weather.frame = requestAnimationFrame(drawWeather);
      return;
    }
    c.globalCompositeOperation = f.blend || "source-over";
    for (var i = 0; i < weather.particles.length; i++) {
      var p = weather.particles[i];
      if (f.step(p, t, now) === false) { p = weather.particles[i] = f.make(t, false); }
      f.draw(c, p, t, now);
    }
    c.globalCompositeOperation = "source-over";
    stepSparks(c);
    stepRipples(c);
    stepMoment(c, now);
    weather.frame = requestAnimationFrame(drawWeather);
  }

  function startWeather() {
    if ((!weatherActive() && !sparks.length && !ripples.length && !moment) || weather.frame !== null) return;
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
    sparks = [];
  }

  // The chips are built from the registry so a new effect never needs markup.
  function renderWeatherOptions() {
    var host = $("#weatherOptions");
    if (!host) return;
    var rows = Math.ceil(WEATHER_FX.length / WEATHER_COLS);
    host.style.setProperty("--seg-n", WEATHER_COLS);
    host.style.setProperty("--seg-rows", rows);
    var cell = function (f, lit) {
      var inner = '<svg class="icon" aria-hidden="true"><use href="#' + f.icon + '"></use></svg>' +
                  '<span>' + f.label + '</span>';
      return lit ? '<span>' + inner + '</span>'
                 : '<button type="button" data-weather="' + f.id + '" aria-pressed="false">' + inner + '</button>';
    };
    host.classList.add("seg-grid");
    host.innerHTML =
      '<div class="seg-row" role="group" aria-label="Weather">' +
        WEATHER_FX.map(function (f) { return cell(f, false); }).join("") +
      '</div>' +
      '<div class="seg-row seg-lit" aria-hidden="true">' +
        WEATHER_FX.map(function (f) { return cell(f, true); }).join("") +
      '</div>';
  }

  // `byUser` latches the lock, makes a sound and says so. Automatic changes
  // driven by the room mix pass false and stay silent.
  function setWeather(type, byUser) {
    if (byUser) {
      state.weatherLocked = true;
      UISound.play(state.weather === type ? "tick" : (type === "none" ? "off" : "on"));
    }
    state.weather = FX_BY_ID[type] ? type : "none";
    var i = WEATHERS.indexOf(state.weather);
    var host = $("#weatherOptions");
    if (host) {
      host.style.setProperty("--seg-i", i % WEATHER_COLS);
      host.style.setProperty("--seg-r", Math.floor(i / WEATHER_COLS));
    }
    $("#weatherValue").textContent = FX_BY_ID[state.weather].label;
    $$("[data-weather]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.weather === state.weather));
    });
    seedParticles();
    if (weatherActive()) startWeather(); else stopWeather();
    persist();
    if (byUser) toast(state.weather === "none"
      ? "Weather off. The room mix will not change it back until you clear this."
      : FX_BY_ID[state.weather].label + " over the scene. Yours until you pick another.");
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
    $("#focusStatus").inert = false;
    $("#focusStatusLabel").textContent = state.selectedMinutes + " min";
    tickFocus();
    closeSurface();
    if (!state.playing) playAll();
    toast("Focus timer running. The room fades out when it ends.");
  }

  function endFocus(completed) {
    clearInterval(state.focusTimer);
    state.focusTimer = null;
    state.focusEndsAt = null;
    $("#focusStatus").classList.remove("is-on");
    $("#focusStatus").inert = true;
    if (!completed) { toast("Focus timer stopped. Your room is still here."); return; }

    // The old build scheduled a 5s ramp and then cancelled it immediately with
    // pauseAll(). Here the ramp is allowed to finish before anything stops.
    toast("Time. Look away for one quiet minute \u2014 press Focus to run another.", 6000);
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
  var DOCK_IDLE_MS = 6000;
  // The first withdrawal happens before the user has touched anything, so it
  // has to leave time to actually read the controls. Later ones are quicker.
  var DOCK_FIRST_IDLE_MS = 14000;
  var dockIdleTimer = null, dockHeld = false, dockUsed = false;

  function dockHeldOpen() {
    var more = $("#moreMenu");
    return Boolean(state.surface) || dockHeld ||
           (typeof tour === "object" && tour.on) ||   // the tour points at dock keys
           (more && more.classList.contains("is-open")) ||
           $("#controlDock").contains(document.activeElement);
  }

  function wakeDock() {
    world.classList.remove("dock-idle");
    clearTimeout(dockIdleTimer);
    dockIdleTimer = setTimeout(function () {
      if (dockHeldOpen()) { wakeDock(); return; }   // re-arm, never hide it
      world.classList.add("dock-idle");
    }, dockUsed ? DOCK_IDLE_MS : DOCK_FIRST_IDLE_MS);
  }

  function bindDockIdle() {
    var dock = $("#controlDock");
    if (!dock) return;
    dock.addEventListener("pointerenter", wakeDock);
    dock.addEventListener("focusin", wakeDock);
    dock.addEventListener("focusout", wakeDock);
    // A fader drag leaves the dock's box; hold it open until the pointer is up.
    dock.addEventListener("pointerdown", function () { dockHeld = true; dockUsed = true; wakeDock(); });
    window.addEventListener("pointerup", function () { dockHeld = false; wakeDock(); });
    window.addEventListener("keydown", wakeDock);
    window.addEventListener("pointermove", wakeTokens, { passive: true });
    window.addEventListener("pointermove", function (e) {
      if (e.clientY > window.innerHeight - 140) wakeDock();
    }, { passive: true });
    wakeDock();
  }

  function openSurface(id, trigger) {
    UISound.play("open");
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
    // The focus popover used to align to the dock's right edge, which is the
    // More key — two controls away from the Focus key that opens it. Measure the
    // real trigger instead, so it still points at the right thing after the dock
    // sheds labels at 1180px.
    if (id === "focusPopover" && trigger) {
      var t = trigger.getBoundingClientRect();
      el.style.setProperty("--anchor-right", Math.max(12, window.innerWidth - t.right) + "px");
    }
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
    if (state.surface) UISound.play("close");
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
    // opacity:0 hides it from the eye but not from the keyboard. Without this
    // the return button is a permanent tab stop on a page that never showed it.
    $("#quietReturn").inert = !quiet;
    // The same trap in reverse: the hidden dock kept ~12 live tab stops, and
    // so did the shade grip and the twelve tokens still lying on the picture.
    $("#controlDock").inert = quiet;
    $("#tokenLayer").inert = quiet;
    $("#shade").inert = quiet;
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
    $("#sceneTitle").textContent = displayTitle();
    $$("#channelGrid input[type=range]").forEach(function (inp) {
      inp.style.setProperty("--fill", state.values[inp.dataset.layer] + "%");
    });
    $("#musicVolume").style.setProperty("--fill", state.musicLevel + "%");
    $("#roomVolume").style.setProperty("--fill", state.roomLevel + "%");
  }

  /* ---------- boot ----------
     Runs in front of powerOn(). It exists because audio cannot start without a
     user gesture, so the choice is between a boot screen and a "click to
     enable sound" toast. This is the same click, spent better — and it is
     where the chime lives. Any key or click ends it early.              */

  /* ---------- today's pairing ----------
     One date-seeded room that everyone gets in common — the calm version of a
     daily puzzle. Never nagging: it greets a fresh visitor, appears as one
     line on the boot screen, and pressing T during boot applies it. */

  function seasonWeather() {
    var m = new Date().getMonth();          // northern-season bias, kept simple
    if (m >= 2 && m <= 4) return "petals";
    if (m >= 5 && m <= 7) return "fireflies";
    if (m >= 8 && m <= 9) return "leaves";
    if (m >= 10 || m <= 1) return "snow";
    return "rain";
  }

  function todaysPairing() {
    var d = new Date();
    var seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
    // A date-seeded scene from the moving library, so everyone shares one.
    var pool = [];
    for (var i = 0; i < worlds.length; i++) {
      if (worlds[i].kind === "local" && !worlds[i].slideshow) pool.push(i);
    }
    var wi = pool.length ? pool[seed % pool.length] : 0;
    var preset = presets[seed % presets.length];
    return { index: wi, world: worlds[wi], preset: preset, weather: seasonWeather() };
  }

  function applyToday(announce) {
    var t = todaysPairing();
    applyPreset(t.preset.id, false);
    state.weatherLocked = false;
    setWorld(t.index, false);
    if (!roomWeather()) {
      state.weatherIntensity = Math.max(state.weatherIntensity, 46);
      setWeather(t.weather, false);
    }
    if (announce) toast("Today: " + t.world.title + " \u00b7 " + t.preset.title.toLowerCase() + ".", 4200);
  }

  var BOOT_LINES = [
    "MEMORY OK", "SCENE BUS READY", "THE FLOATING WORLD", "TWELVE SOUNDS", "READY"
  ];

  function runBoot(done) {
    var el = $("#bootScreen");
    if (!el || reduceMotion.matches) { if (el) el.remove(); done(); return; }

    var started = Date.now(), TOTAL = 2200, ended = false;
    var fill = $("#bootFill"), pct = $("#bootPct"), status = $("#bootStatus");
    var bar = $("#bootBar");
    // The app is fully built behind this opaque overlay; without inert, Tab
    // walks a machine nobody can see.
    world.inert = true;

    // the daily line: one shared object, offered, never pushed
    var today = todaysPairing();
    var todayEl = $("#bootToday");
    // NBSPs in the tail: "press T" once wrapped with the T alone on its own line.
    if (todayEl) todayEl.textContent =
      "today \u00b7 " + today.world.title.toLowerCase() +
      " \u00b7 " + today.preset.title.toLowerCase() + "\u00a0\u2014 press\u00a0T";

    function end(e) {
      if (ended) return;
      ended = true;
      window.removeEventListener("keydown", end, true);
      window.removeEventListener("pointerdown", end, true);
      if (e && e.key && String(e.key).toLowerCase() === "t") {
        setTimeout(function () { applyToday(true); }, 350);
      }
      // The gesture that skipped the boot is the gesture that unlocks audio.
      UISound.unlock();
      UISound.play("boot");
      world.inert = false;
      el.classList.add("is-done");
      setTimeout(function () { if (el.parentNode) el.remove(); }, 420);
      done();
    }

    (function tick() {
      if (ended) return;
      var t = Math.min(1, (Date.now() - started) / TOTAL);
      var p = Math.round(t * 100);
      if (fill) fill.style.width = p + "%";
      if (pct) pct.textContent = p + "%";
      // Quarter steps, not every frame: ~130 aria-valuenow writes in 2.2s is
      // a screen-reader firehose. The visual fill still runs per frame.
      if (bar) {
        var step = Math.floor(p / 25) * 25;
        if (String(step) !== bar.getAttribute("aria-valuenow")) bar.setAttribute("aria-valuenow", String(step));
      }
      if (status) status.textContent = BOOT_LINES[Math.min(BOOT_LINES.length - 1, Math.floor(t * BOOT_LINES.length))];
      if (t >= 1) { end(); return; }
      requestAnimationFrame(tick);
    })();

    window.addEventListener("keydown", end, true);
    window.addEventListener("pointerdown", end, true);
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
    var title = displayTitle();
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
      // announce=true: this is the one path that is unambiguously a choice,
      // and it is what latches sceneLocked. It was called with no second
      // argument — the toast announced a hand-picked scene that had never
      // actually locked, and the next track title would yank it away.
      if (b) setWorld(Number(b.dataset.world), true);
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
      // true = this came from a person, which is what latches the lock and
      // stops syncWeatherToRoom overwriting the choice on the next fader move.
      if (b) setWeather(b.dataset.weather, true);
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
      applyMusicLevel(Number(e.target.value));
    });
    $("#roomVolume").addEventListener("input", function (e) {
      // applyRoomLevel wakes the room: a fader that moves must make sound,
      // even before the first Play.
      applyRoomLevel(Number(e.target.value));
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
    // Interface sound. Delegated from the document so every control — including
    // ones rendered later, like the weather chips and the channel grid — is
    // covered without being wired up individually. pointerdown, not click: a
    // sound that arrives on release reads as lag.
    document.addEventListener("pointerdown", function (e) {
      UISound.unlock();
      var el = e.target.closest("button, [role=switch], .seg-row > *, input[type=range]");
      if (!el || el.disabled) return;
      if (el.matches("input[type=range]")) { UISound.play("tick"); return; }
      if (el.id === "playButton") return;                 // handled with the state flip
      if (el.matches("[data-mute]")) { UISound.play("mute"); return; }
      UISound.play("press");
    }, true);
    // Keyboard activation never produces pointerdown.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var el = document.activeElement;
      if (el && el.matches && el.matches("button, [role=switch]")) { UISound.unlock(); UISound.play("press"); }
    }, true);

    $("#modeButton").addEventListener("click", cycleMode);
    $("#postcardButton").addEventListener("click", function () { closeMore(); sharePostcard(); });
    $("#bonsai").addEventListener("click", function () {
      var mins = quietMinutes();
      var st = bonsaiStage(mins);
      toast(st >= 5 ? "The bonsai is fully grown. " + mins + " quiet minutes."
        : mins ? "Grown from " + mins + " quiet minutes here. It never wilts."
        : "A seed. It grows while sound is playing — slowly, like a real one.", 5200);
    });
    $("#momentsButton").addEventListener("click", function () {
      var seen = momentsSeen();
      var names = { boat: "the boat", cat: "the night cat", star: "a falling star" };
      var got = Object.keys(seen).map(function (k) { return names[k]; }).filter(Boolean);
      toast(got.length ? "Seen so far: " + got.join(", ") + "." :
        "Nothing yet. Some things only come out at certain hours, in certain weather.", 5200);
    });
    $("#roomLinkButton").addEventListener("click", function () { closeMore(); copyRoomLink(); });
    $("#soundButton").addEventListener("click", function () {
      state.sound = !state.sound;
      UISound.setEnabled(state.sound);
      $("#soundButton").setAttribute("aria-checked", String(state.sound));
      $("#soundValue").textContent = state.sound ? "On" : "Off";
      if (state.sound) { UISound.unlock(); UISound.play("on"); }
      persist();
    });
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

    // Geometry is re-derived unconditionally. sizeWeather used to be the only
    // viewport hook and it ran only with weather on — so rotating a phone
    // under a clear sky never re-fit the mounted print or the video framing.
    function onViewport() {
      var w = worlds[state.worldIndex];
      if (!w) return;
      world.classList.toggle("mounted-print", w.kind === "artshow" && fitsMounted(w));
      if (w.kind === "local") applyFit(videos[liveVideo], w);
      if (weatherActive()) sizeWeather();
    }
    var resizeQueued = false;
    function queueViewport() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; onViewport(); });
    }
    window.addEventListener("resize", queueViewport);
    // iOS reports the pre-rotation viewport during this event; measure again
    // once the metrics have settled.
    window.addEventListener("orientationchange", function () {
      queueViewport(); setTimeout(onViewport, 250);
    });
    reduceMotion.addEventListener("change", function () {
      if (weatherActive()) startWeather(); else stopWeather();
    });

    // A slideshow nobody can see is waste, and two buffering videos in a
    // hidden tab doubly so.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        videos.forEach(function (v) { v.pause(); });
        clearTimeout(state.rotateTimer);
        return;
      }
      var w = worlds[state.worldIndex];
      if (state.playing && w && w.kind === "local" && !reduceMotion.matches) {
        var p = videos[liveVideo].play(); if (p && p.catch) p.catch(function () {});
      }
      scheduleRotate();
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
      if (slot.open) {
        e.preventDefault();
        if (slot.spinning) skipSlotSpin(); else closeSlot();
        return;
      }
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

  /* ---------- the tour ----------
     A first-visit walkthrough: one spotlight, one pixel dialog, six stops.
     Fully skippable, shown once, replayable from the More menu. Steps whose
     target is not on this layout (tokens on a phone, say) skip themselves. */

  var TOUR_STEPS = [
    { sel: "#worldButton",
      text: "Scenes. Pick the window you look through — every one of them moves." },
    { sel: "#tokenLayer .token",
      text: "These chips are sounds. Drag one onto the scene — higher is louder, left is left." },
    { sel: "#shadeGrip",
      text: "The blind. Pull it down for night, lift it for day." },
    { sel: "#playButton",
      text: "Play. The music and the room both come alive here." },
    { sel: "#slotButton",
      text: "The slot machine. Pull the lever and let the reels pick what plays next — songs from a playlist, stations otherwise." },
    { sel: null, zone: "right",
      text: "Double-tap the right side of the scene: the cat whips the volume up. Left side brings it down." },
    { sel: "#roomButton",
      text: "The mixer. Twelve sounds on faders, presets, and the weather outside." },
    { sel: "#musicButton",
      text: "The tuner. Paste any YouTube video or playlist and it plays here." }
  ];

  var tour = { on: false, i: -1 };

  function tourEls() {
    return { root: $("#tour"), spot: $("#tourSpot"), card: $("#tourCard"),
             text: $("#tourText"), dots: $("#tourDots"), next: $("#tourNext") };
  }

  function tourTargetRect(step) {
    if (step.zone === "right") {
      var w = window.innerWidth, h = window.innerHeight;
      return { left: w * 0.62, top: h * 0.3, width: w * 0.3, height: h * 0.32 };
    }
    var el = step.sel && document.querySelector(step.sel);
    if (!el) return null;
    var visible = typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null;
    if (!visible) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function showTourStep(i) {
    var e = tourEls();
    if (!e.root) return;
    // walk forward past steps that cannot be shown on this layout
    var rect = null, step = null;
    while (i < TOUR_STEPS.length && !rect) {
      step = TOUR_STEPS[i];
      rect = tourTargetRect(step);
      if (!rect) i++;
    }
    if (!rect) { endTour(true); return; }
    tour.i = i;
    wakeDock();
    var PAD = 8;
    e.spot.style.left = (rect.left - PAD) + "px";
    e.spot.style.top = (rect.top - PAD) + "px";
    e.spot.style.width = (rect.width + PAD * 2) + "px";
    e.spot.style.height = (rect.height + PAD * 2) + "px";
    e.text.textContent = step.text;
    e.next.textContent = i >= TOUR_STEPS.length - 1 ? "Done" : "Next";
    e.dots.innerHTML = TOUR_STEPS.map(function (_, d) {
      return '<i' + (d === i ? ' class="is-on"' : '') + '></i>';
    }).join("");
    // The card sits under the spotlight when there is room, above otherwise.
    // Measured synchronously — rAF is throttled to nothing in hidden panes,
    // which left an invisible full-screen overlay eating every click.
    var card = e.card;
    var ch = card.offsetHeight, cw = card.offsetWidth;
    var below = rect.top + rect.height + 20;
    var top = (below + ch < window.innerHeight - 12) ? below : Math.max(12, rect.top - ch - 20);
    var left = Math.max(12, Math.min(window.innerWidth - cw - 12,
                rect.left + rect.width / 2 - cw / 2));
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function startTour() {
    var e = tourEls();
    if (!e.root || tour.on) return;
    tour.on = true;
    closeSurface(false); closeMore();
    // the tour explains the shade and the tokens, so their one-shot toasts retire
    try {
      localStorage.setItem("dwShadeHint", "1");
      localStorage.setItem("dwTokenHint", "1");
    } catch (err) {}
    var wasIdle = world.classList.contains("dock-idle");
    wakeDock();
    e.root.hidden = false;
    e.root.classList.add("is-on");
    UISound.play("open");
    // A withdrawn dock needs its 220ms to slide back before its keys can be
    // measured; measuring mid-flight put the spotlight on empty scene.
    setTimeout(function () {
      if (!tour.on) return;
      showTourStep(0);
      try { e.next.focus(); } catch (err) {}
    }, wasIdle ? 280 : 0);
  }

  function endTour(completed) {
    var e = tourEls();
    if (!e.root || !tour.on) return;
    tour.on = false; tour.i = -1;
    e.root.classList.remove("is-on");
    setTimeout(function () { e.root.hidden = true; }, 220);
    try { localStorage.setItem("dwTourDone", "1"); } catch (err) {}
    UISound.play("close");
    if (completed) toast("That is the whole machine. It is yours now.", 4200);
  }

  function bindTour() {
    var e = tourEls();
    if (!e.root) return;
    e.next.addEventListener("click", function () {
      if (tour.i >= TOUR_STEPS.length - 1) { endTour(true); return; }
      UISound.play("tick");
      showTourStep(tour.i + 1);
    });
    $("#tourSkip").addEventListener("click", function () { endTour(false); });
    var tb = $("#tourButton");
    if (tb) tb.addEventListener("click", function () { closeMore(); startTour(); });
    document.addEventListener("keydown", function (ev) {
      if (!tour.on) return;
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); endTour(false); }
      if (ev.key === "ArrowRight" || ev.key === "Enter") {
        // the buttons handle their own Enter; arrows always advance
        if (ev.key === "Enter" && (ev.target === e.next || ev.target === $("#tourSkip"))) return;
        ev.preventDefault();
        if (tour.i >= TOUR_STEPS.length - 1) endTour(true); else showTourStep(tour.i + 1);
      }
    }, true);
    window.addEventListener("resize", function () {
      if (tour.on && tour.i >= 0) showTourStep(tour.i);
    });
  }

  /* ---------- init ---------- */

  function init() {
    restore();
    // A shared room in the hash wins the boot — applied before anything paints,
    // so the ordinary init pipeline renders the sender's arrangement.
    var sharedRoom = decodeRoomHash();
    if (sharedRoom) applySharedRoom(sharedRoom);
    else if (freshVisit) {
      // A first visit opens on the film reel — the scene that moves on its
      // own — with today's preset in the room and the shade matching the
      // visitor's actual clock: arrive at night, the floating world is dark.
      var t0 = todaysPairing();
      state.worldIndex = defaultWorldIndex() || t0.index;
      state.values = mix(t0.preset.values);
      state.activePreset = t0.preset.id;
      // Arrive in the evening and the floating world is dark: the clock wins
      // the very first impression, before any preference exists. commitShade
      // routes it through the same path as a hand on the grip, so the chrome,
      // the blind, and the Display row all agree.
      var m0 = modeForClock();
      if (m0 !== "day") setTimeout(function () { commitShade(SHADE_POS[m0]); }, 80);
    }

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
    // useArt has only just been handed the layers, so a still world could not
    // have been painted before this point.
    if (w.kind === "artshow") showArtSlide(false);
    if (w.slideshow) {
      // Mirrors the current clip onto the world, then takes the ordinary
      // local path below through showLocalWorld's fast branch.
      liveVideo = 1;   // so the incoming element is #sceneA
      showFilmSlide(false);
    } else if (w.kind === "local") {
      videos[0].setAttribute("src", w.video);
      if (w.poster) videos[0].setAttribute("poster", w.poster);
      applyFit(videos[0], w);
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
    $("#musicOutput").textContent = state.musicLevel + "%";
    $("#roomVolume").value = state.roomLevel;
    $("#roomVolume").style.setProperty("--fill", state.roomLevel + "%");
    $("#roomOutput").textContent = state.roomLevel + "%";
    $("#weatherIntensity").value = state.weatherIntensity;
    $("#weatherIntensity").style.setProperty("--fill", state.weatherIntensity + "%");
    $("#durationGrid").style.setProperty("--seg-i", 0);
    $$("#durationGrid [data-minutes]").forEach(function (b, i) {
      b.setAttribute("aria-pressed", String(i === 0));
    });

    if (state.savedRoom) $("#savedRoomButton").disabled = false;
    applyMode();
    UISound.setEnabled(state.sound);
    if ($("#soundButton")) {
      $("#soundButton").setAttribute("aria-checked", String(state.sound));
      $("#soundValue").textContent = state.sound ? "On" : "Off";
    }
    bindShade();
    shadeHint();
    tokensHint();
    renderTokens();
    // The pane can lay out AFTER init (0×0 at boot in an embedded browser):
    // re-seat the tokens whenever the world's box actually changes.
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(function () { reseatTokens(); }).observe(world);
    }
    renderWeatherOptions();
    setWeather(state.weather, false);
    syncWeatherToRoom();
    // Restore drift silently — the old build toasted at users on every load.
    if (state.drift) { state.drift = false; toggleDrift(false); }

    bind();
    bindDockIdle();
    bindScrub();
    bindSlot();
    bindTour();

    // Poking the scene and the whip gestures. Bound on the scene layer rather
    // than the document so a press on the dock or inside a panel is never
    // mistaken for one; anything interactive is excluded outright.
    var tap = { t: 0, x: 0, y: 0 };
    var vswipe = { on: false, y0: 0, lvl0: 0, moved: false };
    var SCENE_GUARD = ".control-dock, .panel, .more-menu, .toast, .readout, " +
                      ".focus-popover, .slot-veil, .token, .shade, button, input, a";

    world.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest(SCENE_GUARD)) return;
      var now = Date.now();
      var isDouble = (now - tap.t) < 380 &&
        Math.abs(e.clientX - tap.x) < 48 && Math.abs(e.clientY - tap.y) < 48;
      tap.t = now; tap.x = e.clientX; tap.y = e.clientY;
      if (isDouble) {
        tap.t = 0;
        whipVolume(e.clientX > window.innerWidth / 2 ? 1 : -1, e.clientX, e.clientY);
        return;
      }
      // Touch only, right half: a vertical drag rides the level continuously.
      if (e.pointerType === "touch" && e.clientX > window.innerWidth * 0.55) {
        vswipe.on = true; vswipe.y0 = e.clientY; vswipe.moved = false;
        vswipe.lvl0 = whipTargetsMusic() ? state.musicLevel : state.roomLevel;
      }
      pokeScene(e.clientX, e.clientY);
    });
    world.addEventListener("pointermove", function (e) {
      if (!vswipe.on) return;
      var dy = vswipe.y0 - e.clientY;                 // up = louder
      if (Math.abs(dy) < 18 && !vswipe.moved) return;
      vswipe.moved = true;
      var lvl = vswipe.lvl0 + dy / 3;
      if (whipTargetsMusic()) { applyMusicLevel(lvl); lvl = state.musicLevel; }
      else { applyRoomLevel(lvl); lvl = state.roomLevel; }
      showWhip(dy >= 0 ? 1 : -1, e.clientX, e.clientY, lvl, true);
    }, { passive: true });
    world.addEventListener("pointerup", function () { vswipe.on = false; });
    world.addEventListener("pointercancel", function () { vswipe.on = false; });
    // The console is part of the toy. A deliberate public surface — also how
    // the test harness reaches the room codec without prying the IIFE open.
    window.UKIYO = {
      room: function (name) { return encodeRoom(name || poeticName()); },
      postcard: sharePostcard,
      // Renders the postcard and hands back a data URL — used to mint og.png,
      // and handy in the console.
      og: function (name) {
        return new Promise(function (res) {
          renderPostcard(name || poeticName(), function (cv) {
            res(cv.toDataURL("image/png"));
          });
        });
      },
      crafted: "Rushali Singh & Abiral Jain"
    };
    try {
      console.log(
        "%c 印 %c UKIYO %c a floating world machine ",
        "background:#C73E2E;color:#F7EFE0;font-weight:bold;padding:2px 4px;border-radius:2px",
        "background:#0A131E;color:#FFC24A;padding:2px 6px",
        "color:#6E5F52;padding:2px 0");
      console.log("try UKIYO.room() for a link to this exact room, or UKIYO.postcard()");
    } catch (e) {}

    startBonsaiClock();
    momentTimer = setInterval(tryStartMoment, 60000);
    setTimeout(tryStartMoment, 25000);   // one early roll, so a long first visit can be lucky
    paintMomentShelf();

    runBoot(function () {
      powerOn();
      // First visit ever: offer the walkthrough once the machine is on.
      var seenTour = null;
      try { seenTour = localStorage.getItem("dwTourDone"); } catch (e) {}
      if (!seenTour && !reduceMotion.matches) setTimeout(startTour, 1400);
    });

    if (state.source) loadYouTubeApi();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
