import {
  RigMotion,
  addRigMotion,
  RIG_POSES,
  rehearsalPreview,
} from "./rig-motion.js";
import {
  Engine,
  DEFAULTS,
  STEP,
  simulate,
  evaluateAnnotations,
} from "./engine.js";
import { FeatureExtractor, SAMPLE_RATE } from "./analysis.js";
import { SongEditor, validRules } from "./song-editor.js";
import { drawScene } from "./renderer.js";
import { approvedStatus } from "./approved-character.js";
const $ = (id) => document.getElementById(id),
  preview = $("preview"),
  timeline = $("timeline");

let timelineDirty = true;
const rigMotion = new RigMotion();
let characterDemo = false,
  characterDemoStart = 0;
function presentation(studio = mode === "studio") {
  const gaze = studio
    ? {
        idle: { gazeIdle: 1 },
        center: { gazeIdle: 0 },
        left: { gazeX: -1, gazeIdle: 0 },
        right: { gazeX: 1, gazeIdle: 0 },
        up: { gazeY: -1, gazeIdle: 0 },
        down: { gazeY: 1, gazeIdle: 0 },
      }[$("rigGaze").value]
    : { gazeIdle: 1 };
  return {
    speech: studio ? $("meshSpeech").value : "animated",
    emotion: $("meshEmotion").value,
    affect: Number($("meshAffect").value),
    opening: studio ? Number($("meshOpening").value) : 1,
    strength: 1,
    drama:
      { subtle: 0.4, dramatic: 0.72, extreme: 1 }[options.exaggeration] ?? 1,
    motion: options.motion,
    rules: options.rules,
    rehearsal: studio && rehearsal,
    start: characterDemo ? characterDemoStart : rehearsalStart,
    demo: studio && characterDemo,
    ...gaze,
    pupil:
      studio && $("rigPupil").value !== "animated"
        ? Number($("rigPupil").value)
        : null,
  };
}
function sceneOptions() {
  if (isProjector) return options;
  return {
    ...options,
    character: $("character").value,
    characterQuality: $("characterQuality").value,
    characterWire: mode === "studio" && $("meshWire").checked,
  };
}
let lastPreviewRender = -Infinity;
function renderPreview(now = performance.now()) {
  if (mode === "live") return;
  const settings = sceneOptions(),
    fps =
      settings.character !== "mesh" || settings.characterQuality === "high"
        ? 60
        : settings.characterQuality === "economy" ||
            (settings.characterQuality === "auto" &&
              approvedStatus(preview)?.economy)
          ? 24
          : 30;
  const period = 1000 / fps,
    elapsed = now - lastPreviewRender;
  if (elapsed + 0.2 < period) return;
  fitPreview();
  drawScene(preview, state, settings, studioTime);
  if ($("rigBadge"))
    $("rigBadge").textContent =
      settings.scene !== "clown"
        ? "SHARED STAGE ANIMATION"
        : preview.dataset.characterRenderer === "approved-mesh"
          ? "APPROVED CONNECTED MESH · 20 RIGID TEETH"
          : "ORIGINAL CHARACTER · FALLBACK";
  lastPreviewRender = Number.isFinite(lastPreviewRender)
    ? lastPreviewRender +
      Math.max(1, Math.floor((elapsed + 0.2) / period)) * period
    : now;
}
function fitPreview() {
  const mesh = sceneOptions().character === "mesh";
  document.body.classList.toggle("mesh-character", mesh);
  const box = preview.getBoundingClientRect(),
    dpr = Math.min(3, window.devicePixelRatio || 1),
    budget = 3686400;
  const ratio = Math.min(
    dpr,
    Math.sqrt(budget / Math.max(1, box.width * box.height)),
  );
  const w = Math.max(1, Math.round(box.width * ratio)),
    h = Math.max(1, Math.round(box.height * ratio));
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
}

const rigPreview = () =>
  mode === "studio"
    ? {
        anatomy: presentation(),
        pose: $("rigPose").value,
        amount: Number($("rigMouth").value),
        ...(rehearsal ? rehearsalPreview(studioTime - rehearsalStart) : {}),
        ...{
          idle: { gazeIdle: 1 },
          center: { gazeIdle: 0 },
          left: { gazeX: -1, gazeIdle: 0 },
          right: { gazeX: 1, gazeIdle: 0 },
          up: { gazeY: -1, gazeIdle: 0 },
          down: { gazeY: 1, gazeIdle: 0 },
        }[$("rigGaze").value],
        pupil:
          $("rigPupil").value === "animated"
            ? null
            : Number($("rigPupil").value),
      }
    : { anatomy: presentation() };
const audio = new Audio();
audio.preload = "auto";
let mode = "song",
  options = { ...DEFAULTS },
  engine = new Engine(options),
  state = engine.step({ bass: 0, mid: 0, high: 0 }, 0),
  frames = [],
  features = [],
  pcm = null,
  duration = 0,
  notes = [],
  results = [],
  song = null,
  pendingSession = null;
let audioUrl = null,
  worker = null,
  loadGeneration = 0,
  mic = null,
  micGeneration = 0,
  studioTime = 0,
  lastFrame = 0,
  paused = false,
  rehearsal = false,
  rehearsalStart = 0,
  manual = [],
  projection = null;
const channel =
  "BroadcastChannel" in window
    ? new BroadcastChannel("freakshow-projector-v5")
    : null;
const isProjector = new URLSearchParams(location.search).has("projector");
const tell = (message) => ($("status").textContent = message);
const clock = (t) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
const safeStorage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      tell("Device storage is full. Export your session to preserve notes.");
    }
  },
};
const editor = new SongEditor(
  timeline,
  () => ({
    frames,
    features,
    pcm,
    duration,
    notes,
    time: audio.currentTime,
    playing: !audio.paused,
    rules: options.rules || [],
  }),
  seek,
  (rule) => {
    options.rules = rule
      ? [...(options.rules || []).filter((r) => r.source !== rule.source), rule]
      : [];
    engine = new Engine(options);
    rebuild();
    persist();
    tell(
      rule
        ? "Mapping applied across this song and Live Show. No reactions are scheduled at timestamps."
        : "Default sound mappings restored.",
    );
  },
);
function allEvents() {
  return frames.flatMap((f) => f.events);
}
function rebuild() {
  timelineDirty = true;
  frames = addRigMotion(simulate(features, options), presentation(false));
  results = [];
  renderNotes();
  drawTimeline();
}
function persist() {
  safeStorage.set("freakshow:preferences", options);
  if (song)
    safeStorage.set("freakshow:" + song.hash, {
      version: 1,
      song,
      options,
      annotations: notes,
    });
}
function syncSettings() {
  for (const k of Object.keys(DEFAULTS).filter((k) => $(k))) {
    if (k === "flash") $(k).checked = options[k];
    else $(k).value = options[k];
  }
}
const preferences = safeStorage.get("freakshow:preferences");
for (const [key, value] of Object.entries(preferences || {})) {
  if (key === "rules" && validRules(value)) options.rules = value;
  else if (key === "flash" && typeof value === "boolean") options[key] = value;
  else if (
    key in DEFAULTS &&
    key !== "flash" &&
    key !== "rules" &&
    Array.from($(key).options).some((o) => o.value === value)
  )
    options[key] = value;
}
const characterControls = [
  "character",
  "characterQuality",
  "meshSpeech",
  "meshEmotion",
  "meshAffect",
  "meshOpening",
  "meshWire",
];
const characterSaved = safeStorage.get("freakshow:character-v1") || {};
for (const id of characterControls) {
  const el = $(id),
    v = characterSaved[id];
  if (v == null) continue;
  if (el.type === "checkbox") el.checked = v === true;
  else if (el.type === "range" && Number.isFinite(Number(v)))
    el.value = Math.max(0, Math.min(1, Number(v)));
  else if (Array.from(el.options || []).some((o) => o.value === v))
    el.value = v;
}
let characterRebuildTimer = null;
for (const id of characterControls)
  $(id).addEventListener("input", () => {
    paused = false;
    characterDemo = false;
    $("meshDemo").textContent = "Demonstrate six emotions";
    const values = Object.fromEntries(
      characterControls.map((k) => [
        k,
        $(k).type === "checkbox" ? $(k).checked : $(k).value,
      ]),
    );
    safeStorage.set("freakshow:character-v1", values);
    if (id === "meshEmotion" || id === "meshAffect") {
      clearTimeout(characterRebuildTimer);
      characterRebuildTimer = setTimeout(() => {
        frames = addRigMotion(frames, presentation(false));
      }, 75);
    }
  });
$("meshDemo").onclick = () => {
  stopRehearsal();
  characterDemo = !characterDemo;
  characterDemoStart = studioTime;
  paused = false;
  $("meshDemo").textContent = characterDemo
    ? "Stop emotional demo"
    : "Demonstrate six emotions";
};
syncSettings();
engine = new Engine(options);
for (const key of Object.keys(DEFAULTS).filter((k) => $(k)))
  $(key).addEventListener("change", () => {
    options[key] = key === "flash" ? $(key).checked : $(key).value;
    engine = new Engine(options);
    rebuild();
    persist();
  });
let liveFrame = null;
function activateCandidateLive(enabled) {
  document.body.classList.toggle("candidate-live", enabled);
  if (enabled && !liveFrame) {
    const container = document.createElement("section");
    container.id = "candidate-live-show";
    const link = document.createElement("a");
    link.href = new URL(
      "../public/live-show/index.html?release=expression-events-2",
      import.meta.url,
    ).href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open Live Show in its own tab";
    liveFrame = document.createElement("iframe");
    liveFrame.title = "FREAKSHOW Candidate A Live Show";
    liveFrame.allow = "microphone; fullscreen";
    liveFrame.allowFullscreen = true;
    liveFrame.src = link.href;
    container.append(link, liveFrame);
    document.querySelector("main").prepend(container);
  }
  if (liveFrame) {
    liveFrame.parentElement.hidden = !enabled;
    liveFrame.contentWindow?.postMessage(
      { type: "freakshow-live-active", active: enabled },
      location.origin,
    );
  }
}
function setMode(next) {
  if (mode === next) return;
  audio.pause();
  stopMic();
  mode = next;
  activateCandidateLive(mode === "live");
  rigMotion.reset();
  paused = false;
  $("pauseMotion").textContent = "Pause motion";
  engine = new Engine(options);
  studioTime = 0;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-current", b.dataset.mode === mode ? "page" : "false");
  });
  document
    .querySelectorAll("[data-for]")
    .forEach((s) => (s.hidden = s.dataset.for !== mode));
  const copy = {
    song: [
      "LISTEN. OBSERVE. REFINE.",
      "Every reaction has a moment.",
      "Bring in a song. See what the clown hears. Mark what should happen.",
      "Your listening room",
    ],
    studio: [
      "THE CHARACTER, UP CLOSE.",
      "Give the darkness a little life.",
      "Explore idle motion and rehearse expressions. No audio required.",
      "Movement workshop",
    ],
    live: [
      "FROM THE ROOM TO THE BIG TOP.",
      "Let the show take over.",
      "Listen through a microphone. Send the shared stage to your projector.",
      "Show controls",
    ],
  }[mode];
  ["eyebrow", "title", "description", "controlTitle"].forEach(
    (id, i) => ($(id).textContent = copy[i]),
  );
  tell(
    mode === "live"
      ? "Ready for microphone permission."
      : mode === "studio"
        ? "Trigger an expression or start a rehearsal."
        : "Song Lab ready.",
  );
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
function analyze(data) {
  return new Promise((resolve, reject) => {
    worker = new Worker(new URL("./analysis-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      worker = null;
      data.error ? reject(Error(data.error)) : resolve(data.features);
    };
    worker.onerror = (e) => {
      worker.terminate();
      worker = null;
      reject(Error(e.message));
    };
    worker.postMessage({ pcm: data }, [data.buffer]);
  });
}
async function loadSong(file) {
  if (!file) return;
  const generation = ++loadGeneration;
  audio.pause();
  $("play").disabled = true;
  $("audioFile").disabled = true;
  $("fileStatus").textContent = "Loading and analyzing locally…";
  $("audioDrop").setAttribute("aria-busy", "true");
  tell("Decoding locally and analyzing at a fixed 60 steps per second…");
  $("analysisLabel").textContent = "ANALYZING…";
  try {
    if (file.size > 200 * 1024 * 1024)
      throw Error("Choose a file smaller than 200 MB.");
    const bytes = await file.arrayBuffer(),
      hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    const decode = new AudioContext({ sampleRate: SAMPLE_RATE });
    let decoded;
    try {
      decoded = await decode.decodeAudioData(bytes);
    } finally {
      await decode.close();
    }
    const mono = new OfflineAudioContext(
        1,
        Math.ceil(decoded.duration * SAMPLE_RATE),
        SAMPLE_RATE,
      ),
      source = mono.createBufferSource();
    source.buffer = decoded;
    source.connect(mono.destination);
    source.start();
    const rendered = await mono.startRendering();
    const nextPCM = rendered.getChannelData(0).slice(),
      nextFeatures = await analyze(nextPCM.slice());
    if (generation !== loadGeneration) return;
    pcm = nextPCM;
    features = nextFeatures;
    duration = rendered.duration;
    song = { name: file.name, hash, duration, sampleRate: SAMPLE_RATE };
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;
    const saved =
      pendingSession?.song.hash === hash
        ? pendingSession
        : safeStorage.get("freakshow:" + hash);
    notes = saved?.annotations || [];
    if (saved?.options) {
      options = { ...DEFAULTS, ...saved.options };
      syncSettings();
    }
    if (pendingSession && pendingSession.song.hash !== hash)
      tell(
        "Song loaded, but the pending session belongs to a different file. Import the matching song.",
      );
    else {
      pendingSession = null;
      tell(
        "Song ready. Play or select a sound to decide how it should move. Notes save on this device.",
      );
    }
    rebuild();
    persist();
    $("songName").textContent = file.name;
    $("seek").max = duration;
    $("noteTime").max = duration;
    for (const id of [
      "play",
      "rewind",
      "seek",
      "addNote",
      "exportNotes",
      "runRegression",
    ])
      $(id).disabled = false;
    $("analysisLabel").textContent = `${allEvents().length} REACTIONS READY`;
    $("fileStatus").textContent =
      `Ready: ${file.name} · ${duration.toFixed(1)}s`;
    editor.start = 0;
    editor.zoom = 1;
    $("zoom").value = "1";
    editor.invalidate();
  } catch (error) {
    $("fileStatus").textContent = "Load failed: " + error.message;
    tell("Could not load song: " + error.message);
    $("analysisLabel").textContent = "LOAD FAILED";
    $("play").disabled = !song;
  } finally {
    $("audioFile").disabled = false;
    $("audioDrop").setAttribute("aria-busy", "false");
  }
}
$("audioFile").onchange = (e) => loadSong(e.target.files[0]);
$("audioFile").addEventListener("click", (e) => {
  e.currentTarget.value = "";
});
$("audioFile").addEventListener("cancel", () => {
  $("fileStatus").textContent =
    "No file chosen. Choose an MP3/WAV or drop one here.";
});
for (const event of ["dragover", "dragenter"])
  $("audioDrop").addEventListener(event, (e) => {
    e.preventDefault();
    $("audioDrop").classList.add("dragging");
  });
$("audioDrop").ondragleave = () => $("audioDrop").classList.remove("dragging");
$("audioDrop").ondrop = (e) => {
  e.preventDefault();
  $("audioDrop").classList.remove("dragging");
  if (!$("audioFile").disabled) loadSong(e.dataTransfer.files[0]);
};
$("play").onclick = async () => {
  if (audio.paused) {
    try {
      await audio.play();
    } catch (e) {
      tell("Playback could not start: " + e.message);
    }
  } else audio.pause();
};
audio.onplay = () => ($("play").textContent = "Ⅱ Pause");
audio.onpause = audio.onended = () => ($("play").textContent = "▶ Play");
function seek(time) {
  audio.currentTime = Math.max(0, Math.min(duration, time));
  $("noteTime").value = audio.currentTime.toFixed(2);
  if (
    audio.currentTime < editor.start ||
    audio.currentTime > editor.start + editor.span()
  ) {
    editor.start = Math.max(
      0,
      Math.min(duration - editor.span(), audio.currentTime),
    );
    editor.invalidate();
  }
  drawTimeline();
}
$("rewind").onclick = () => seek(0);
$("seek").oninput = (e) => seek(Number(e.target.value));
$("triggerEye").onclick = () => {
  $("rigPupil").value = "animated";
  $("rigPose").value = "animated";
  manual.push("eye");
};
$("triggerMouth").onclick = () => {
  $("meshSpeech").value = "animated";
  characterDemo = false;
  stopRehearsal();
  $("rigPose").value = "animated";
  manual.push("mouth");
};
$("rigMouth").oninput = () => {
  stopRehearsal();
  $("rigPose").value = "custom";
  paused = false;
  $("pauseMotion").textContent = "Pause motion";
};
$("rigPose").onchange = () => {
  stopRehearsal();
  if (RIG_POSES[$("rigPose").value])
    $("rigMouth").value = RIG_POSES[$("rigPose").value].mouth;
  paused = false;
  $("pauseMotion").textContent = "Pause motion";
};
function stopRehearsal() {
  rehearsal = false;
  $("rehearse").textContent = "Three-note mouth rehearsal";
}
for (const button of document.querySelectorAll("[data-rig-pose]"))
  button.onclick = () => {
    stopRehearsal();
    $("rigPose").value = button.dataset.rigPose;
    $("rigPose").onchange();
  };
$("rehearse").onclick = () => {
  characterDemo = false;
  $("meshSpeech").value = "animated";
  rehearsal = !rehearsal;
  rehearsalStart = studioTime;
  $("rigPose").value = rehearsal ? "animated" : "closed";
  paused = false;
  $("pauseMotion").textContent = "Pause motion";
  $("rehearse").textContent = rehearsal
    ? "Stop rehearsal"
    : "Three-note mouth rehearsal";
};
$("pauseMotion").onclick = () => {
  if (mode === "song" && song) {
    audio.pause();
    tell("Song paused. Use Play to resume synchronized animation.");
    return;
  }
  paused = !paused;
  $("pauseMotion").textContent = paused ? "Resume motion" : "Pause motion";
};
function enterFullscreen(target, onFailure) {
  const request = target.requestFullscreen || target.webkitRequestFullscreen;
  if (!request) {
    onFailure(
      "Fullscreen is unavailable in this browser; the fitted preview remains usable.",
    );
    return;
  }
  try {
    Promise.resolve(request.call(target)).catch((error) =>
      onFailure(error.message),
    );
  } catch (error) {
    onFailure(error.message);
  }
}
$("fullPreview").onclick = () =>
  enterFullscreen(preview, (message) => tell("Fullscreen: " + message));
function validateSession(value) {
  if (
    value?.version !== 1 ||
    !value.song ||
    typeof value.song.hash !== "string" ||
    !Array.isArray(value.annotations) ||
    value.annotations.length > 10000
  )
    throw Error("Not a supported FREAKSHOW session.");
  if (
    value.annotations.some(
      (n) =>
        !Number.isFinite(n.time) ||
        n.time < 0 ||
        n.time > value.song.duration ||
        !["eye", "mouth", "ignore"].includes(n.kind) ||
        typeof n.text !== "string",
    )
  )
    throw Error("Invalid annotation.");
  for (const k of Object.keys(value.options || {})) {
    if (!(k in DEFAULTS)) throw Error("Unknown setting.");
    if (k === "rules") {
      if (!validRules(value.options[k])) throw Error("Invalid sound mappings.");
      continue;
    }
    const el = $(k);
    if (k === "flash") {
      if (typeof value.options[k] !== "boolean")
        throw Error("Invalid accent setting.");
    } else if (
      !Array.from(el.options).some((o) => o.value === value.options[k])
    )
      throw Error("Invalid setting: " + k);
  }
  return value;
}
$("addNote").onclick = () => {
  const time = Number($("noteTime").value);
  if (!Number.isFinite(time) || time < 0 || time > duration) {
    tell("Choose a timestamp within the song.");
    return;
  }
  notes.push({
    time,
    kind: $("noteKind").value,
    text: $("noteText").value.slice(0, 500),
  });
  notes.sort((a, b) => a.time - b.time);
  $("noteText").value = "";
  results = [];
  timelineDirty = true;
  persist();
  renderNotes();
  drawTimeline();
};
function renderNotes() {
  const list = $("notes");
  list.replaceChildren();
  if (!notes.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent =
      "Your ears set the expectation. The traces show what happened.";
    list.append(li);
  }
  notes.forEach((note, index) => {
    const li = document.createElement("li"),
      jump = document.createElement("button"),
      content = document.createElement("span"),
      result = document.createElement("span"),
      remove = document.createElement("button");
    jump.className = "text-button";
    jump.textContent = clock(note.time) + " · " + note.time.toFixed(2) + "s";
    jump.onclick = () => seek(note.time);
    content.className = "note-content";
    content.textContent =
      { eye: "Eyes", mouth: "Jaw", ignore: "Ignore sound" }[note.kind] +
      (note.text ? " — " + note.text : "");
    result.textContent = results[index]
      ? results[index].pass
        ? "✓ Match"
        : "× Mismatch"
      : "Not checked";
    result.className = results[index]
      ? results[index].pass
        ? "result-pass"
        : "result-fail"
      : "muted";
    remove.className = "text-button";
    remove.textContent = "Remove";
    remove.setAttribute(
      "aria-label",
      "Remove annotation at " + note.time + " seconds",
    );
    remove.onclick = () => {
      notes.splice(index, 1);
      results = [];
      timelineDirty = true;
      persist();
      renderNotes();
      drawTimeline();
    };
    li.append(jump, content, result, remove);
    list.append(li);
  });
  $("regressionSummary").textContent = results.length
    ? `${results.filter((r) => r.pass).length} of ${results.length} expectations matched (±150 ms). Unannotated events are visible in the trace.`
    : "Mark the playhead or enter an exact timestamp. Checks allow ±150 ms.";
}
$("runRegression").onclick = () => {
  results = evaluateAnnotations(allEvents(), notes);
  renderNotes();
  if (!notes.length)
    tell("Add an expected reaction or ignored sound before checking.");
};
$("exportNotes").onclick = () => {
  const value = {
    version: 1,
    featureVersion: 2,
    song,
    options,
    annotations: notes,
    features,
  };
  const blob = new Blob([JSON.stringify(value)], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = song.name + ".freakshow.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("importNotes").onclick = () => $("notesFile").click();
$("notesFile").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) throw Error("Session is too large.");
    const value = validateSession(JSON.parse(await file.text()));
    if (song?.hash === value.song.hash) {
      notes = value.annotations;
      options = { ...DEFAULTS, ...value.options };
      syncSettings();
      rebuild();
      persist();
      tell("Session restored for this exact audio file.");
    } else {
      pendingSession = value;
      tell(
        "Session imported. Load the matching audio file: " + value.song.name,
      );
    }
  } catch (error) {
    tell("Import failed: " + error.message);
  } finally {
    e.target.value = "";
  }
};
function drawTimeline() {
  if (timelineDirty) {
    editor.invalidate();
    timelineDirty = false;
  }
  editor.draw();
}

async function stopMic() {
  micGeneration++;
  const current = mic;
  mic = null;
  if (current) {
    current.stream.getTracks().forEach((t) => t.stop());
    current.source.disconnect();
    current.worklet.disconnect();
    await current.context.close();
  }
  $("startMic").disabled = false;
  $("stopMic").disabled = true;
}
async function startMic() {
  await stopMic();
  const generation = micGeneration;
  $("startMic").disabled = true;
  let stream, context;
  try {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error("Use localhost or HTTPS for microphone access.");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: $("inputDevice").value
          ? { exact: $("inputDevice").value }
          : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: SAMPLE_RATE,
    });
    await context.audioWorklet.addModule(
      new URL("./mic-worklet.js", import.meta.url),
    );
    if (generation !== micGeneration || mode !== "live") {
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
      return;
    }
    engine = new Engine(options);
    rigMotion.reset();
    const source = context.createMediaStreamSource(stream),
      worklet = new AudioWorkletNode(context, "pcm-frames"),
      mute = context.createGain();
    mute.gain.value = 0;
    source.connect(worklet);
    worklet.connect(mute).connect(context.destination);
    const extractor = new FeatureExtractor(context.sampleRate);
    worklet.port.onmessage = ({ data }) => {
      if (!mic) return;
      state = rigMotion.step(
        engine.step(extractor.process(data.pcm), data.time),
        { anatomy: presentation(false) },
      );
      studioTime = data.time;
    };
    mic = { stream, context, source, worklet };
    await context.resume();
    $("stopMic").disabled = false;
    tell("Microphone live. Bass drives eyes; midrange drives the jaw.");
    const selected = $("inputDevice").value,
      devices = await navigator.mediaDevices.enumerateDevices();
    $("inputDevice").replaceChildren(
      new Option("System default", ""),
      ...devices
        .filter((d) => d.kind === "audioinput")
        .map(
          (d, i) => new Option(d.label || "Microphone " + (i + 1), d.deviceId),
        ),
    );
    $("inputDevice").value = selected;
  } catch (error) {
    stream?.getTracks().forEach((t) => t.stop());
    if (context && context.state !== "closed") await context.close();
    mic = null;
    $("startMic").disabled = false;
    tell("Microphone unavailable: " + error.message);
  }
}
$("startMic").onclick = startMic;
$("stopMic").onclick = async () => {
  await stopMic();
  tell("Microphone stopped. Idle motion continues.");
};
$("inputDevice").onchange = () => {
  if (mic) startMic();
};
$("projector").onclick = () => {
  projection = window.open(
    new URL("?projector", location.href),
    "freakshowProjector",
    "width=1280,height=720",
  );
  if (!projection)
    tell("Popup blocked. Allow popups for this site and try again.");
  else
    tell(
      "Projector opened. Move it to the extended display, then click Enter fullscreen.",
    );
};
if (isProjector) {
  document.body.classList.add("projector");
  const hint = document.createElement("button");
  hint.id = "projectorHint";
  hint.textContent =
    "Enter fullscreen · move this window to the projector first";
  hint.onclick = () =>
    enterFullscreen(document.documentElement, () => {
      hint.textContent = "Use the browser fullscreen command.";
    });
  document.body.append(hint);
  channel?.addEventListener("message", ({ data }) => {
    if (data.type === "frame") {
      state = data.state;
      options = data.options;
      studioTime = data.time;
      renderPreview();
      const lastHeard =
        mode === "song" && frames.length
          ? frames
              .slice(
                Math.max(0, Math.floor(studioTime * 60) - 20),
                Math.floor(studioTime * 60) + 1,
              )
              .flatMap((f) => f.detections || [])
          : state.detections || [];
      const recent = lastHeard.at(-1);
      $("detectionMonitor").textContent = recent
        ? `Heard: ${recent.source === "kick" ? "low thump" : recent.source === "lead" ? "tonal note" : "bright tick"} → ${recent.ignored ? "ignored" : recent.kind === "eye" ? "eye trigger" : "mouth trigger"} | Eyes ${Math.round((state.rig?.eye ?? state.eyeAccent) * 100)}% · Mouth ${Math.round((state.rig?.mouth ?? state.mouthAccent) * 100)}%`
        : `No recent onset | Eyes ${Math.round((state.rig?.eye ?? state.eyeAccent) * 100)}% · Mouth ${Math.round((state.rig?.mouth ?? state.mouthAccent) * 100)}% · idle motion continues`;
    }
  });
}
let disposed = false,
  lastDraw = 0,
  lastBroadcast = 0,
  accumulator = 0;
function tick(now) {
  if (disposed) return;
  requestAnimationFrame(tick);
  if (isProjector) return;
  const delta = Math.min(0.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  if (mode === "live") return;
  if (mode === "song" && frames.length) {
    const index = Math.min(
      frames.length - 1,
      Math.floor(audio.currentTime / STEP),
    );
    state = frames[index];
    studioTime = audio.currentTime;
    $("seek").value = audio.currentTime;
    $("duration").textContent =
      clock(audio.currentTime) + " / " + clock(duration);
    if (!audio.paused && document.activeElement !== $("noteTime"))
      $("noteTime").value = audio.currentTime.toFixed(2);
  } else if (!mic && !paused) {
    accumulator += delta;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      studioTime += STEP;
      const commands = manual.splice(0);
      state = rigMotion.step(
        engine.step({ bass: 0, mid: 0, high: 0 }, studioTime, commands),
        rigPreview(),
      );
    }
  }
  renderPreview(now);
  const lastHeard =
    mode === "song" && frames.length
      ? frames
          .slice(
            Math.max(0, Math.floor(studioTime * 60) - 20),
            Math.floor(studioTime * 60) + 1,
          )
          .flatMap((f) => f.detections || [])
      : state.detections || [];
  const recent = lastHeard.at(-1);
  $("detectionMonitor").textContent = recent
    ? `Heard: ${recent.source === "kick" ? "low thump" : recent.source === "lead" ? "tonal note" : "bright tick"} → ${recent.ignored ? "ignored" : recent.kind === "eye" ? "eye trigger" : "mouth trigger"} | Eyes ${Math.round((state.rig?.eye ?? state.eyeAccent) * 100)}% · Mouth ${Math.round((state.rig?.mouth ?? state.mouthAccent) * 100)}%`
    : `No recent onset | Eyes ${Math.round((state.rig?.eye ?? state.eyeAccent) * 100)}% · Mouth ${Math.round((state.rig?.mouth ?? state.mouthAccent) * 100)}% · idle motion continues`;
  $("characterStatus").textContent =
    preview.dataset.characterRenderer === "approved-mesh"
      ? "Approved connected mesh · " +
        preview.dataset.meshTriangles +
        " triangles · " +
        preview.dataset.characterQuality
      : preview.dataset.characterRenderer === "legacy-fallback"
        ? "Original fallback: " +
          (preview.dataset.characterError || "WebGL unavailable")
        : "Original illustration fallback";
  $("stateLabel").textContent =
    mode === "studio" && $("rigPose").value !== "animated"
      ? "INSPECTING / " + $("rigPose").value.toUpperCase()
      : (state.rig?.eye ?? state.eyeAccent) > 0.15
        ? "EYES / BASS ACCENT"
        : (state.rig?.mouth ?? state.mouthAccent) > 0.15
          ? "JAW / MIDRANGE ACCENT"
          : "IDLE / ALWAYS ALIVE";
  $("sourceLabel").textContent =
    mode === "song" && song
      ? audio.paused
        ? "Song paused"
        : "Song audio"
      : mic
        ? "Microphone · live"
        : mode === "studio"
          ? "Visual Studio · audio independent"
          : "Autonomous motion";
  if (mode === "song" && now - lastDraw > 80) {
    drawTimeline();
    lastDraw = now;
  }
  if (channel && now - lastBroadcast > 32) {
    channel.postMessage({
      type: "frame",
      state,
      options: sceneOptions(),
      time: studioTime,
    });
    lastBroadcast = now;
  }
}
requestAnimationFrame(tick);
drawTimeline();
if (
  "serviceWorker" in navigator &&
  !isProjector &&
  document.querySelector('meta[name="freakshow-build"]')
)
  navigator.serviceWorker
    .register(new URL("sw.js", document.baseURI), { updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .then(
      () =>
        ($("offlineStatus").textContent =
          "Offline shell cached · local audio stays private."),
    )
    .catch(() => {
      $("offlineStatus").textContent =
        "Offline caching unavailable in this browser.";
    });
if (!document.querySelector('meta[name="freakshow-build"]'))
  $("offlineStatus").textContent = "Development mode · offline cache disabled.";
window.addEventListener("beforeunload", () => {
  disposed = true;
  mic?.stream.getTracks().forEach((t) => t.stop());
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  worker?.terminate();
  channel?.close();
  if (projection && !projection.closed) projection.close();
});
document.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
      document.activeElement?.tagName,
    )
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    if (mode === "song" && song) $("play").click();
    else $("pauseMotion").click();
  }
});

if (new URLSearchParams(location.search).get("mode") === "live")
  setMode("live");
