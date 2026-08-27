const scenes = [
  {
    id: "piano-rain",
    title: "Piano rain",
    eyebrow: "Rain window radio",
    note: "Rainy window · placid piano · reading",
    kind: "local",
    video: "assets/rain-window.mp4",
    poster: "assets/rain-window-poster.png",
    position: "center",
    mix: { rain: 24, forest: 5, cafe: 0, brown: 0 }
  },
  {
    id: "pond-spirit",
    title: "Pond spirit",
    eyebrow: "Water garden loop",
    note: "Pond · piano · quiet forest",
    kind: "local",
    video: "assets/garden-loop.mp4",
    poster: "assets/garden-loop-poster.png",
    position: "center",
    mix: { rain: 12, forest: 26, cafe: 0, brown: 0 }
  },
  {
    id: "wide-awake",
    title: "Wide awake",
    eyebrow: "A bright lakeside reel",
    note: "Lake light · gentle ambient · focus",
    kind: "local",
    video: "assets/lake-loop.mp4",
    poster: "assets/lake-loop-poster.png",
    position: "center",
    mix: { rain: 0, forest: 34, cafe: 0, brown: 0 }
  },
  {
    id: "ghibli-collection",
    title: "Ghibli collection",
    eyebrow: "The supplied piano playlist",
    note: "Ghibli piano · online source",
    kind: "youtube",
    videoId: "jvM3rO4Ihd4",
    poster: "https://i.ytimg.com/vi/jvM3rO4Ihd4/maxresdefault.jpg",
    position: "center",
    mix: { rain: 18, forest: 20, cafe: 0, brown: 4 }
  }
];

const layers = [
  { id: "rain", name: "Window rain", glyph: "☂", color: "#b9d8e8", audio: "rainAudio" },
  { id: "forest", name: "Dawn forest", glyph: "♧", color: "#b8d9c6", audio: "forestAudio" },
  { id: "cafe", name: "Café room", glyph: "♨", color: "#f4c5a7", audio: "cafeAudio" },
  { id: "brown", name: "Brown hush", glyph: "≈", color: "#efbdc8", audio: "brownAudio" }
];

const presets = [
  { id: "low", title: "Low but working", note: "rain + a little room", color: "#f2d997", values: { rain: 30, forest: 12, cafe: 5, brown: 4 } },
  { id: "bright", title: "Bright focus", note: "birds in a clean room", color: "#b9d9c8", values: { rain: 0, forest: 42, cafe: 7, brown: 0 } },
  { id: "sleep", title: "Sleep garden", note: "soft rain + brown hush", color: "#c6c4e4", values: { rain: 34, forest: 8, cafe: 0, brown: 28 } },
  { id: "window", title: "Window seat", note: "rain + distant café", color: "#f0bdc7", values: { rain: 40, forest: 0, cafe: 18, brown: 5 } }
];

const cues = [
  "Start small. Ten honest minutes count.",
  "Lower the volume until the room feels like it is helping.",
  "You do not need a perfect mood to begin.",
  "Let the room hold the noise for a while.",
  "A quiet beginning still counts as a beginning."
];

const state = {
  sceneIndex: 0,
  playing: false,
  master: 68,
  drift: false,
  timerMinutes: 0,
  timerId: null,
  driftId: null,
  panel: null,
  values: { rain: 24, forest: 5, cafe: 0, brown: 0 },
  youtubeApiReady: false,
  youtubeReady: false
};

const $ = (selector) => document.querySelector(selector);
const world = $("#world");
const playerWrap = $("#youtubeWrap");
const localScene = $("#localScene");
const baseAudio = $("#baseAudio");
let ytPlayer = null;

function posterStyle(url) {
  return `url('${url}')`;
}

function renderScenes() {
  $("#postcardRow").innerHTML = scenes.map((scene, index) => `
    <button class="postcard pressable ${index === state.sceneIndex ? "active" : ""}" data-scene="${index}">
      <span class="postcard-image" style="background-image:${posterStyle(scene.poster)};background-position:${scene.position}">
        <span class="postcard-stamp">${scene.kind === "local" ? "video + audio" : "online source"}</span>
      </span>
      <strong>${scene.title}</strong>
      <small>${scene.note}</small>
    </button>
  `).join("");
}

function renderPresets() {
  $("#presetRow").innerHTML = presets.map(preset => `
    <button class="preset-button pressable" data-preset="${preset.id}" style="--tape-color:${preset.color}">
      <strong>${preset.title}</strong>
      <small>${preset.note}</small>
    </button>
  `).join("");
}

function renderChannels() {
  $("#channels").innerHTML = layers.map(layer => `
    <div class="channel">
      <div class="channel-top">
        <div class="channel-name">
          <span class="channel-glyph" style="--channel-color:${layer.color}">${layer.glyph}</span>
          <strong>${layer.name}</strong>
        </div>
        <output id="${layer.id}Output">${state.values[layer.id]}%</output>
      </div>
      <input type="range" min="0" max="100" value="${state.values[layer.id]}" data-layer="${layer.id}" aria-label="${layer.name} volume">
    </div>
  `).join("");
  updateRangeFills();
}

function updateRangeFills() {
  document.querySelectorAll('input[type="range"]').forEach(input => {
    input.style.setProperty("--fill", `${input.value}%`);
  });
}

function setLayerValue(id, value, updateInput = true) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  state.values[id] = safeValue;
  const layer = layers.find(item => item.id === id);
  const audio = document.getElementById(layer.audio);
  audio.volume = (safeValue / 100) * (state.master / 100) * .7;
  if (state.playing && safeValue > 0 && audio.paused) audio.play().catch(() => {});
  if (safeValue === 0 && !audio.paused) audio.pause();
  const output = document.getElementById(`${id}Output`);
  if (output) output.textContent = `${safeValue}%`;
  if (updateInput) {
    const input = document.querySelector(`[data-layer="${id}"]`);
    if (input) {
      input.value = safeValue;
      input.style.setProperty("--fill", `${safeValue}%`);
    }
  }
}

function syncAllAudio() {
  baseAudio.volume = (state.master / 100) * .82;
  layers.forEach(layer => setLayerValue(layer.id, state.values[layer.id]));
  if (ytPlayer && state.youtubeReady) {
    try { ytPlayer.setVolume(state.master); } catch (_) {}
  }
}

function playLayers() {
  layers.forEach(layer => {
    if (state.values[layer.id] > 0) document.getElementById(layer.audio).play().catch(() => {});
  });
}

function pauseLayers() {
  layers.forEach(layer => document.getElementById(layer.audio).pause());
}

function playCurrent() {
  const scene = scenes[state.sceneIndex];
  state.playing = true;
  world.classList.add("playing");
  $("#playButton").setAttribute("aria-label", "Pause");
  $("#playButton").setAttribute("aria-pressed", "true");
    if (scene.kind === "youtube" && ytPlayer && state.youtubeReady) {
      baseAudio.pause();
      localScene.pause();
      ytPlayer.playVideo();
  } else {
    if (ytPlayer && state.youtubeReady) ytPlayer.pauseVideo();
    localScene.play().catch(() => {});
    baseAudio.play().catch(() => {});
  }
  playLayers();
  showCue();
}

function pauseCurrent() {
  state.playing = false;
  world.classList.remove("playing");
  $("#playButton").setAttribute("aria-label", "Play");
  $("#playButton").setAttribute("aria-pressed", "false");
  if (ytPlayer && state.youtubeReady) ytPlayer.pauseVideo();
  localScene.pause();
  baseAudio.pause();
  pauseLayers();
}

function togglePlay() {
  state.playing ? pauseCurrent() : playCurrent();
}

function showCue(message) {
  const dateIndex = Math.floor(Date.now() / 86400000) % cues.length;
  $("#cueText").textContent = message || cues[dateIndex];
  $("#dailyCue").classList.add("show");
  clearTimeout(showCue.timeout);
  showCue.timeout = setTimeout(() => $("#dailyCue").classList.remove("show"), 3900);
}

function setScene(index, applyRecommended = true) {
  const wasPlaying = state.playing;
  const scene = scenes[index];
  world.classList.add("scene-changing");
  state.sceneIndex = index;

  setTimeout(() => {
    $("#scenePoster").style.backgroundImage = posterStyle(scene.poster);
    $("#scenePoster").style.backgroundPosition = scene.position;
    $("#sceneThumb").style.backgroundImage = posterStyle(scene.poster);
    $("#dockSceneTitle").textContent = scene.title;
    $("#sceneTitle").textContent = scene.title;
    $("#sceneEyebrow").textContent = scene.eyebrow;

    if (scene.kind === "youtube") {
      localScene.classList.remove("active");
      playerWrap.classList.remove("active");
      localScene.pause();
      baseAudio.pause();
      ensureYoutubePlayer(scene.videoId);
      if (ytPlayer && state.youtubeReady) {
        ytPlayer.loadVideoById(scene.videoId);
        if (!wasPlaying) ytPlayer.pauseVideo();
      }
    } else {
      playerWrap.classList.remove("active");
      localScene.classList.add("active");
      if (localScene.getAttribute("src") !== scene.video) {
        localScene.src = scene.video;
        localScene.load();
      }
      if (ytPlayer && state.youtubeReady) ytPlayer.pauseVideo();
      if (wasPlaying) {
        localScene.play().catch(() => {});
        baseAudio.play().catch(() => {});
      }
    }

    if (applyRecommended) {
      Object.entries(scene.mix).forEach(([id, value]) => setLayerValue(id, value));
      document.querySelectorAll("[data-preset]").forEach(button => button.classList.remove("active"));
    }
    renderScenes();
    bindDynamicButtons();
    world.classList.remove("scene-changing");
  }, 260);

  closePanels();
}

function openPanel(panel) {
  closePanels(false);
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  panel.removeAttribute("inert");
  $("#panelBackdrop").classList.add("show");
  state.panel = panel.id;
  $("#sceneButton").setAttribute("aria-expanded", String(panel.id === "sceneShelf"));
  $("#mixerButton").setAttribute("aria-expanded", String(panel.id === "mixerDrawer"));
}

function closePanels(updateState = true) {
  const activeElement = document.activeElement;
  if ($("#sceneShelf").contains(activeElement)) $("#sceneButton").focus({ preventScroll: true });
  if ($("#mixerDrawer").contains(activeElement)) $("#mixerButton").focus({ preventScroll: true });
  [$("#sceneShelf"), $("#mixerDrawer")].forEach(panel => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("inert", "");
  });
  $("#panelBackdrop").classList.remove("show");
  $("#sceneButton").setAttribute("aria-expanded", "false");
  $("#mixerButton").setAttribute("aria-expanded", "false");
  if (updateState) state.panel = null;
}

function togglePanel(panel) {
  const isOpen = panel.classList.contains("open");
  isOpen ? closePanels() : openPanel(panel);
}

function saveMix() {
  localStorage.setItem("dreamWorldsMix", JSON.stringify({ sceneIndex: state.sceneIndex, master: state.master, values: state.values }));
  $("#saveStatus").textContent = "Saved to this little machine ✓";
  showCue("This room will remember your mix.");
  playSaveChime();
  setTimeout(() => $("#saveStatus").textContent = "", 3500);
}

function playSaveChime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.035, context.currentTime + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .7);
  [659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * .09);
    oscillator.stop(context.currentTime + .7);
  });
  setTimeout(() => context.close(), 900);
}

function loadSavedMix() {
  try {
    const saved = JSON.parse(localStorage.getItem("dreamWorldsMix"));
    if (!saved) return;
    state.master = Number(saved.master) || 68;
    state.values = { ...state.values, ...saved.values };
    $("#masterVolume").value = state.master;
    $("#masterOutput").textContent = state.master;
    const sceneIndex = Math.min(scenes.length - 1, Math.max(0, Number(saved.sceneIndex) || 0));
    state.sceneIndex = sceneIndex;
  } catch (_) {}
}

function applyPreset(id) {
  const preset = presets.find(item => item.id === id);
  if (!preset) return;
  Object.entries(preset.values).forEach(([layer, value]) => setLayerValue(layer, value));
  document.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === id));
  showCue(`${preset.title} slipped into the deck.`);
}

function toggleDrift() {
  state.drift = !state.drift;
  const button = $("#driftButton");
  button.classList.toggle("active", state.drift);
  button.setAttribute("aria-pressed", String(state.drift));
  button.lastChild.textContent = state.drift ? " Drift on" : " Drift off";
  clearInterval(state.driftId);
  if (state.drift) {
    state.driftId = setInterval(() => {
      layers.forEach(layer => {
        const current = state.values[layer.id];
        if (current > 0) setLayerValue(layer.id, current + (Math.random() * 8 - 4));
      });
    }, 8500);
  }
}

function surprise() {
  let next = state.sceneIndex;
  while (next === state.sceneIndex && scenes.length > 1) next = Math.floor(Math.random() * scenes.length);
  const preset = presets[Math.floor(Math.random() * presets.length)];
  setScene(next, false);
  setTimeout(() => applyPreset(preset.id), 350);
}

function toggleQuiet(force) {
  const shouldQuiet = typeof force === "boolean" ? force : !world.classList.contains("quiet");
  closePanels();
  $("#moreMenu").classList.remove("open");
  world.classList.toggle("quiet", shouldQuiet);
}

function cycleTimer() {
  const options = [0, 30, 45, 60, 90];
  const nextIndex = (options.indexOf(state.timerMinutes) + 1) % options.length;
  state.timerMinutes = options[nextIndex];
  $("#timerValue").textContent = state.timerMinutes ? `${state.timerMinutes} min` : "Off";
  clearTimeout(state.timerId);
  if (state.timerMinutes) {
    state.timerId = setTimeout(fadeForSleep, state.timerMinutes * 60000);
    showCue(`Sleep fade set for ${state.timerMinutes} minutes.`);
  }
}

function fadeForSleep() {
  const start = state.master;
  const steps = 30;
  let step = 0;
  const fade = setInterval(() => {
    step += 1;
    state.master = Math.max(0, Math.round(start * (1 - step / steps)));
    $("#masterVolume").value = state.master;
    $("#masterOutput").textContent = state.master;
    syncAllAudio();
    updateRangeFills();
    if (step >= steps) {
      clearInterval(fade);
      pauseCurrent();
      toggleQuiet(true);
    }
  }, 2000);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function addRipple(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "ripple-dot";
  dot.style.left = `${event.clientX ? event.clientX - rect.left : rect.width / 2}px`;
  dot.style.top = `${event.clientY ? event.clientY - rect.top : rect.height / 2}px`;
  button.appendChild(dot);
  setTimeout(() => dot.remove(), 520);
}

function bindRipples() {
  document.querySelectorAll(".pressable").forEach(button => {
    if (button.dataset.rippleBound) return;
    button.dataset.rippleBound = "true";
    button.addEventListener("pointerdown", addRipple);
  });
}

function bindDynamicButtons() {
  document.querySelectorAll("[data-scene]").forEach(button => {
    button.addEventListener("click", () => setScene(Number(button.dataset.scene)));
  });
  document.querySelectorAll("[data-preset]").forEach(button => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });
  bindRipples();
}

function initializeScene() {
  const scene = scenes[state.sceneIndex];
  $("#scenePoster").style.backgroundImage = posterStyle(scene.poster);
  $("#scenePoster").style.backgroundPosition = scene.position;
  $("#sceneThumb").style.backgroundImage = posterStyle(scene.poster);
  $("#dockSceneTitle").textContent = scene.title;
  $("#sceneTitle").textContent = scene.title;
  $("#sceneEyebrow").textContent = scene.eyebrow;
  if (scene.kind === "local") {
    localScene.src = scene.video;
    localScene.classList.add("active");
  }
}

function bindStaticControls() {
  $("#playButton").addEventListener("click", togglePlay);
  $("#sceneButton").addEventListener("click", () => togglePanel($("#sceneShelf")));
  $("#mixerButton").addEventListener("click", () => togglePanel($("#mixerDrawer")));
  $("#panelBackdrop").addEventListener("click", closePanels);
  document.querySelectorAll("[data-close-panel]").forEach(button => button.addEventListener("click", closePanels));
  $("#masterVolume").addEventListener("input", event => {
    state.master = Number(event.target.value);
    $("#masterOutput").textContent = state.master;
    event.target.style.setProperty("--fill", `${state.master}%`);
    syncAllAudio();
  });
  $("#channels").addEventListener("input", event => {
    const id = event.target.dataset.layer;
    if (id) setLayerValue(id, Number(event.target.value), false);
    event.target.style.setProperty("--fill", `${event.target.value}%`);
    document.querySelectorAll("[data-preset]").forEach(button => button.classList.remove("active"));
  });
  $("#saveMix").addEventListener("click", saveMix);
  $("#driftButton").addEventListener("click", toggleDrift);
  $("#surpriseButton").addEventListener("click", surprise);
  $("#moreButton").addEventListener("click", () => {
    const menu = $("#moreMenu");
    const open = menu.classList.toggle("open");
    menu.setAttribute("aria-hidden", String(!open));
    $("#moreButton").setAttribute("aria-expanded", String(open));
  });
  $("#timerButton").addEventListener("click", cycleTimer);
  $("#quietButton").addEventListener("click", () => toggleQuiet());
  $("#quietReturn").addEventListener("click", () => toggleQuiet(false));
  $("#fullscreenButton").addEventListener("click", toggleFullscreen);
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "q") toggleQuiet();
    if (event.key.toLowerCase() === "f") toggleFullscreen();
    if (event.key === "Escape") closePanels();
    if (event.code === "Space" && !event.target.matches("input, button")) {
      event.preventDefault();
      togglePlay();
    }
  });
}

function ensureYoutubePlayer(videoId) {
  if (!state.youtubeApiReady || ytPlayer) return;
  ytPlayer = new YT.Player("youtubePlayer", {
    videoId,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      loop: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      playlist: videoId
    },
    events: {
      onReady: event => {
        state.youtubeReady = true;
        event.target.setVolume(state.master);
      },
      onStateChange: event => {
        if (event.data === YT.PlayerState.PLAYING && scenes[state.sceneIndex].kind === "youtube") {
          playerWrap.classList.add("active");
        }
        if (event.data === YT.PlayerState.ENDED && state.playing) event.target.playVideo();
      },
      onError: () => {
        if (scenes[state.sceneIndex].kind === "youtube") {
          setScene(0);
          if (state.playing) setTimeout(playCurrent, 450);
          showCue("That online tape is resting. Piano rain is playing instead.");
        }
      }
    }
  });
}

window.onYouTubeIframeAPIReady = function () {
  state.youtubeApiReady = true;
  const scene = scenes[state.sceneIndex];
  if (scene.kind === "youtube") ensureYoutubePlayer(scene.videoId);
};

loadSavedMix();
renderScenes();
renderPresets();
renderChannels();
initializeScene();
bindStaticControls();
bindDynamicButtons();
syncAllAudio();
updateRangeFills();
