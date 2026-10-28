import {
  Engine,
  DEFAULTS,
  STEP,
  simulate,
  evaluateAnnotations,
} from "./engine.js";
import {
  magnitudes,
  featuresFromSpectrum,
  SAMPLE_RATE,
  FFT_SIZE,
} from "./analysis.js";
import { drawScene } from "./renderer.js";
const $ = (id) => document.getElementById(id),
  preview = $("preview"),
  timeline = $("timeline");
const timelineBase = document.createElement("canvas");
timelineBase.width = timeline.width;
timelineBase.height = timeline.height;
let timelineDirty = true;
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
function allEvents() {
  return frames.flatMap((f) => f.events);
}
function rebuild() {
  timelineDirty = true;
  frames = simulate(features, options);
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
  for (const k of Object.keys(DEFAULTS)) {
    if (k === "flash") $(k).checked = options[k];
    else $(k).value = options[k];
  }
}
const preferences = safeStorage.get("freakshow:preferences");
for (const [key, value] of Object.entries(preferences || {})) {
  if (key === "flash" && typeof value === "boolean") options[key] = value;
  else if (
    key in DEFAULTS &&
    key !== "flash" &&
    Array.from($(key).options).some((o) => o.value === value)
  )
    options[key] = value;
}
syncSettings();
engine = new Engine(options);
for (const key of Object.keys(DEFAULTS))
  $(key).addEventListener("change", () => {
    options[key] = key === "flash" ? $(key).checked : $(key).value;
    engine = new Engine(options);
    rebuild();
    persist();
  });
function setMode(next) {
  if (mode === next) return;
  audio.pause();
  stopMic();
  mode = next;
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
        "Song ready. Playback and seeking use the same precomputed detection. Notes save on this device.",
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
    $("analysisLabel").textContent =
      `${frames.length.toLocaleString()} FIXED STEPS`;
  } catch (error) {
    tell("Could not load song: " + error.message);
    $("analysisLabel").textContent = "LOAD FAILED";
    $("play").disabled = !song;
  } finally {
    $("audioFile").disabled = false;
  }
}
$("audioFile").onchange = (e) => loadSong(e.target.files[0]);
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
  drawTimeline();
}
$("rewind").onclick = () => seek(0);
$("seek").oninput = (e) => seek(Number(e.target.value));
timeline.onclick = (e) => {
  if (duration) {
    const rect = timeline.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  }
};
$("triggerEye").onclick = () => manual.push("eye");
$("triggerMouth").onclick = () => manual.push("mouth");
$("rehearse").onclick = () => {
  rehearsal = !rehearsal;
  $("rehearse").textContent = rehearsal ? "Stop rehearsal" : "Start rehearsal";
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
$("fullPreview").onclick = () =>
  preview.requestFullscreen().catch((e) => tell("Fullscreen: " + e.message));
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
  const value = { version: 1, song, options, annotations: notes, features };
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
  const c = timeline.getContext("2d"),
    w = timeline.width,
    h = timeline.height,
    row = h / 5;
  if (!timelineDirty && pcm) {
    c.drawImage(timelineBase, 0, 0);
    drawPlayhead(c, w, h);
    return;
  }
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#17151a";
  c.fillRect(0, 0, w, h);
  for (let i = 1; i < 5; i++) {
    c.strokeStyle = "#332c35";
    c.beginPath();
    c.moveTo(0, i * row);
    c.lineTo(w, i * row);
    c.stroke();
  }
  if (!pcm || !duration) {
    c.fillStyle = "#655d69";
    c.font = "14px Arial";
    c.fillText("Your song, mapped from first note to final echo.", 30, 38);
    return;
  }
  c.strokeStyle = "#8b8276";
  c.beginPath();
  for (let x = 0; x < w; x++) {
    const start = Math.floor((x / w) * pcm.length),
      end = Math.max(start + 1, Math.floor(((x + 1) / w) * pcm.length));
    let peak = 0;
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(pcm[j]));
    c.moveTo(x, row / 2 - peak * (row / 2 - 5));
    c.lineTo(x, row / 2 + peak * (row / 2 - 5));
  }
  c.stroke();
  const trace = (field, lane, color) => {
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = 0; x < w; x++) {
      const f =
        frames[
          Math.min(frames.length - 1, Math.floor((x / w) * frames.length))
        ];
      const v = field(f);
      const y = (lane + 1) * row - 6 - Math.min(1, v) * (row - 12);
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  };
  trace((f) => f.levels.bass, 1, "#dfbc76");
  trace((f) => f.levels.mid, 2, "#ce7b6f");
  trace(
    (f) => Math.min(1, f.bassDrive * 0.62 + f.eyeAccent * 0.92),
    4,
    "#dfbc76",
  );
  trace(
    (f) => Math.min(1, f.midDrive * 0.66 + f.mouthAccent * 1.03),
    4,
    "#ce7b6f",
  );
  for (const event of allEvents()) {
    const x = (event.time / duration) * w,
      y = row * 3 + (event.kind === "eye" ? 20 : 43);
    c.fillStyle = event.kind === "eye" ? "#dfbc76" : "#ce7b6f";
    c.beginPath();
    if (event.kind === "eye") c.arc(x, y, 3, 0, Math.PI * 2);
    else {
      c.moveTo(x, y - 4);
      c.lineTo(x + 4, y);
      c.lineTo(x, y + 4);
      c.lineTo(x - 4, y);
      c.closePath();
    }
    c.fill();
  }
  notes.forEach((n) => {
    const x = (n.time / duration) * w;
    c.strokeStyle = n.kind === "ignore" ? "#b7afc0" : "#ddd3bb";
    c.setLineDash([3, 5]);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = c.strokeStyle;
    c.fillRect(x - 3, 0, 6, 8);
  });
  timelineBase.getContext("2d").drawImage(timeline, 0, 0);
  timelineDirty = false;
  drawPlayhead(c, w, h);
}
function drawPlayhead(c, w, h) {
  c.strokeStyle = "#f5eee4";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo((audio.currentTime / duration) * w, 0);
  c.lineTo((audio.currentTime / duration) * w, h);
  c.stroke();
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
    const source = context.createMediaStreamSource(stream),
      worklet = new AudioWorkletNode(context, "pcm-frames"),
      mute = context.createGain();
    mute.gain.value = 0;
    source.connect(worklet);
    worklet.connect(mute).connect(context.destination);
    const smooth = new Float64Array(FFT_SIZE / 2);
    worklet.port.onmessage = ({ data }) => {
      if (!mic) return;
      const spectrum = magnitudes(data.pcm);
      for (let i = 0; i < smooth.length; i++)
        smooth[i] = smooth[i] * 0.16 + spectrum[i] * 0.84;
      state = engine.step(
        featuresFromSpectrum(smooth, context.sampleRate),
        data.time,
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
    document.documentElement.requestFullscreen().catch(() => {
      hint.textContent = "Use the browser fullscreen command.";
    });
  document.body.append(hint);
  channel?.addEventListener("message", ({ data }) => {
    if (data.type === "frame") {
      state = data.state;
      options = data.options;
      studioTime = data.time;
      drawScene(preview, state, options, studioTime);
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
      if (mode === "studio" && rehearsal) {
        if (Math.floor(studioTime / STEP) % 90 === 0) commands.push("eye");
        if (Math.floor(studioTime / STEP) % 130 === 0) commands.push("mouth");
      }
      state = engine.step({ bass: 0, mid: 0, high: 0 }, studioTime, commands);
    }
  }
  drawScene(preview, state, options, studioTime);
  $("stateLabel").textContent =
    state.eyeAccent > 0.15
      ? "EYES / BASS ACCENT"
      : state.mouthAccent > 0.15
        ? "JAW / MIDRANGE ACCENT"
        : "IDLE / ALWAYS ALIVE";
  $("sourceLabel").textContent =
    mode === "song" && song
      ? audio.paused
        ? "Song paused"
        : "Recorded song · deterministic"
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
    channel.postMessage({ type: "frame", state, options, time: studioTime });
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
    .register("./sw.js")
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
