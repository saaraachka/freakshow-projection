import * as THREE from "three";
import { createProceduralHead } from "../3d-character-viewer/baseline-fed4cd1/procedural-head.js";
import {
  bindRig,
  zero,
  constrain,
  presets,
  controls,
} from "../candidate-a-rig/rig.js?release=inner-seal-1";
import { Rehearsal } from "./performance.js?release=head-6";
import { LiveInput } from "./input.js?release=head-6";
import { MusicalPerformance } from "./musical-performance.js?release=head-6";
import { AudioTimeline } from "./beat.js?release=head-6";
import { EyePulse } from "./eye-pulse.js?release=head-6";
import { EyeDetails } from "./eye-details.js?release=head-6";
import { InkRenderer } from "./ink-renderer.js?release=head-6";
import { RhythmPulse } from "./rhythm-pulse.js?release=head-6";
const eyePulse = new EyePulse();
const rhythm = new RhythmPulse(eyePulse);
let rhythmActive = true;
let eyeDetails,
  ink,
  lastEyeAmount = 0,
  lastKickTime = -100,
  lastPulseBeat = -1,
  lastPulseRevision = -1,
  appliedVisual = "";
const timeline = new AudioTimeline();
const $ = (id) => document.getElementById(id),
  clock = () => timeline.now(input?.context, performance.now() / 1000);
const params = new URL(location.href).searchParams,
  projectorId = params.get("projector"),
  id =
    projectorId || crypto.randomUUID?.() || String(Date.now()) + Math.random();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("freakshow-live-" + id)
    : null;
const controller = new MusicalPerformance(
  { zero, constrain, presets, controls },
  performance.now() / 1000,
);
const rehearsal = new Rehearsal();
let fence = null,
  dirty = true;
let rig,
  character,
  renderer,
  scene,
  camera,
  active = true,
  lastRender = -100,
  lastBroadcast = -100,
  demonstrating = false,
  demoNext = 0,
  demoIndex = 0,
  projectorWindow = null,
  lastSnapshot = null,
  lastSnapshotTime = -100,
  lastPose = zero(),
  lastMotion = null,
  recent = [],
  disposed = false;
const input = new LiveInput({
  state: (state, message) => {
    if (state === "pending") {
      controller.tracker.clear();
      controller.beatClock.setPhaseRate(0, clock());
    }
    if (state === "off" || state === "error") {
      controller.tracker.events = [];
      controller.tracker.confidence = 0;
      controller.beatClock.setPhaseRate(0, clock());
    }
    $("status").textContent = message;
    if (state === "off" || state === "error") $("level").value = 0;
    $("status").dataset.state = state;
    $("connect").disabled = ["pending", "live", "suspended"].includes(state);
    $("disconnect").disabled = !["pending", "live", "suspended"].includes(
      state,
    );
    $("resume").hidden = state !== "suspended";
  },
  frame: ({ level, events, time: wall }) => {
    const time = clock();
    events = events.map((e) => ({
      ...e,
      wallTime: time - (wall - (e.wallTime ?? wall)),
    }));
    controller.listen(
      events.map((e) => ({ ...e, time: e.wallTime })),
      time,
      level,
    );
    $("level").value = Math.min(1, level * 3);
    for (const e of events) {
      const ignored = e.kind === "hat" && !$("hats").checked;
      recent.push({ ...e, wallTime: time, ignored });
      if (e.kind === "kick" && !rehearsal.running && !demonstrating)
        kickEye(e.wallTime ?? time, e.strength);
      if (
        $("reactive").checked &&
        !demonstrating &&
        !rehearsal.running &&
        !ignored
      )
        triggerEvent(e.kind, e.wallTime ?? time, e.strength, false, false);
    }
    recent = recent.filter((e) => time - e.wallTime < 3).slice(-12);
    if (rig && !projectorId && channel && time - lastBroadcast > 0.05) {
      advanceDemo(time);
      const s = controller.sample(time, $("idle").checked);
      channel.postMessage({
        type: "pose",
        pose: s.pose,
        motion: motion(time, s.head, $("idle").checked),
        eyeAmount: eyeAmount(time),
        visual: visualSettings(),
      });
      lastBroadcast = time;
    }
    const e = recent.at(-1);
    $("heard").textContent = e
      ? `${e.kind} ${e.ignored ? "· ignored" : $("reactive").checked ? "→ " + controller.eventLabel(e.kind) : "· accents paused"}`
      : "Listening · no significant onset";
  },
});
let filePlayer = null,
  fileURL = null,
  fileGeneration = 0;
function clearFile(keepSelection = false) {
  ++fileGeneration;
  filePlayer?.pause();
  if (filePlayer) {
    filePlayer.removeAttribute("src");
    filePlayer.load();
  }
  filePlayer = null;
  if (fileURL) URL.revokeObjectURL(fileURL);
  fileURL = null;
  $("filePlayback").replaceChildren();
  if (!keepSelection) $("audioFile").value = "";
}
$("audioFile").onchange = async () => {
  const file = $("audioFile").files[0];
  if (!file) return;
  clearFile(true);
  const generation = fileGeneration;
  rehearsal.stop();
  demonstrating = false;
  $("demo").textContent = "Beat-clock demo";
  $("rehearsal").textContent = "Start rehearsal";
  controller.clearAccents();
  if (controller.mode === "beat") controller.start(clock(), true);
  $("automatic").checked = controller.automatic;
  $("reactive").checked = true;
  $("pulseEnabled").checked = true;
  rhythmActive = true;
  fileURL = URL.createObjectURL(file);
  filePlayer = document.createElement("audio");
  const player = filePlayer;
  player.controls = true;
  player.preload = "auto";
  player.src = fileURL;
  $("filePlayback").append(player);
  $("fileStatus").textContent = file.name;
  player.onerror = () => {
    $("fileStatus").textContent =
      "Cannot play this file. Try an MP3 or WAV supported by your browser.";
  };
  player.onseeking = () => {
    controller.clearAccents();
    if (controller.mode === "beat") controller.start(clock(), true);
    input.detector.reset();
    input.clockNode?.port.postMessage({ reset: true });
  };
  player.onpause = () => controller.clearAccents();
  player.onended = () => {
    $("fileStatus").textContent = file.name + " · finished";
    controller.clearAccents();
  };
  await input.start("", player);
  if (generation !== fileGeneration) return;
  if (input.media === player)
    try {
      await player.play();
    } catch {
      $("fileStatus").textContent = file.name + " · press Play to start";
    }
};
function kickEye(t, strength) {
  lastKickTime = t;
  if (rhythmActive && $("pulseSource").value === "kick")
    rhythm.trigger(t, strength);
}
function triggerEvent(kind, t, strength, manual, driveEyes = true) {
  if (kind === "kick" && driveEyes) kickEye(t, strength);
  if (controller.trigger(kind, t, strength, { manual })) {
    $("heard").textContent = `${kind} → ${controller.eventLabel(kind)}`;
    $("lastGesture").textContent = `${kind} → ${controller.eventLabel(kind)}`;
  }
}
for (const [kind, m] of Object.entries(controller.mappings)) {
  const row = document.createElement("div");
  row.className = "mapping";
  const label = document.createElement("label");
  label.textContent = {
    kick: "Kick",
    snare: "Snare",
    clap: "Clap",
    hat: "Hi-hat / other",
    melody: "Melody / lead",
  }[kind];
  const select = document.createElement("select");
  select.id = "map-" + kind;
  select.setAttribute("aria-label", label.textContent + " expression");
  for (const name of ["Eye twitch", ...Object.keys(presets)])
    select.add(new Option(name, name));
  select.value = m.expression;
  select.onchange = () =>
    controller.configure(kind, { expression: select.value });
  const test = document.createElement("button");
  test.textContent = "Trigger";
  test.dataset.testEvent = kind;
  test.onclick = () => gesture(kind);
  row.append(label, select, test);
  for (const [key, title, min, max, step] of [
    ["intensity", "Intensity", 0, 1, 0.05],
    ["cooldown", "Cooldown (seconds)", 0, 1, 0.01],
  ]) {
    const l = document.createElement("label"),
      out = document.createElement("output"),
      range = document.createElement("input");
    l.textContent = title;
    out.textContent = m[key];
    range.type = "range";
    range.min = min;
    range.max = max;
    range.step = step;
    range.value = m[key];
    range.id = kind + "-" + key;
    range.oninput = () => {
      controller.configure(kind, { [key]: Number(range.value) });
      out.textContent = range.value;
    };
    l.append(out, range);
    row.append(l);
  }
  $("mappings").append(row);
}
for (const key of ["attack", "hold", "release"]) {
  const range = $(key);
  range.value = controller.envelope[key] * 1000;
  range.oninput = () => {
    controller.setEnvelope({ [key]: Number(range.value) / 1000 });
    $(key + "Value").textContent = range.value + " ms";
  };
}
$("rehearsal").onclick = () => {
  rhythmActive = true;
  if (!rehearsal.running && controller.mode === "beat") {
    controller.start(clock(), true);
    $("automatic").checked = true;
  }
  if (rehearsal.running) {
    rehearsal.stop();
    controller.preset({}, clock(), 0.18);
  } else {
    demonstrating = false;
    $("demo").textContent = "Beat-clock demo";
    $("reactive").checked = false;
    rehearsal.start($("pattern").value, clock(), controller.beatClock.bpm);
  }
  $("rehearsal").textContent = rehearsal.running
    ? "Stop rehearsal"
    : "Start rehearsal";
};
for (const key of ["pattern"])
  $(key).onchange = () => {
    if (rehearsal.running)
      rehearsal.start($("pattern").value, clock(), controller.beatClock.bpm);
  };
function manualTempo(value) {
  controller.autoSync = false;
  $("autoSync").checked = false;
  controller.tracker.clear();
  controller.beatClock.setPhaseRate(0, clock());
  controller.beatClock.setBpm(value, clock());
  $("bpm").value = controller.beatClock.bpm.toFixed(1);
  if (rehearsal.running)
    rehearsal.start($("pattern").value, clock(), controller.beatClock.bpm);
}
$("bpm").onchange = () => manualTempo($("bpm").value);
$("tap").onclick = () => {
  controller.autoSync = false;
  $("autoSync").checked = false;
  controller.beatClock.setPhaseRate(0, clock());
  const bpm = controller.beatClock.tap(clock());
  if (bpm) {
    $("bpm").value = bpm.toFixed(1);
    if (rehearsal.running) rehearsal.start($("pattern").value, clock(), bpm);
  }
};
$("doubleBpm").onclick = () => manualTempo(controller.beatClock.bpm * 2);
$("halfBpm").onclick = () => manualTempo(controller.beatClock.bpm / 2);
$("resync").onclick = () => {
  if (controller.automatic) controller.start(clock(), true);
  else controller.beatClock.resync(clock());
  if (rehearsal.running)
    rehearsal.start($("pattern").value, clock(), controller.beatClock.bpm);
};
$("nudgeBack").onclick = () => controller.beatClock.nudge(-0.02, clock());
$("nudgeForward").onclick = () => controller.beatClock.nudge(0.02, clock());
$("autoSync").onchange = () => {
  controller.autoSync = $("autoSync").checked;
  controller.tracker.clear();
  if (!controller.autoSync) controller.beatClock.setPhaseRate(0, clock());
};
$("accentIntensity").oninput = () => {
  controller.accentIntensity = Number($("accentIntensity").value);
  $("accentValue").textContent =
    Math.round(controller.accentIntensity * 100) + "%";
};
$("automatic").onchange = () => {
  if ($("automatic").checked) controller.start(clock(), true);
  else {
    const name = controller.currentExpression,
      pose = controller.baseAt(clock());
    for (const k of Object.keys(pose))
      if (k !== "gazeX" && k !== "gazeY")
        pose[k] *= 0.9 + 0.1 * controller.energy;
    controller.automatic = false;
    controller.base = pose;
    controller.phraseTransition = null;
    controller.transition = null;
    controller.currentExpression = name;
  }
};
for (const [id, key] of [
  ["includeNeutral", "optionalNeutral"],
  ["includeSurprised", "optionalSurprised"],
  ["randomOrder", "random"],
])
  $(id).onchange = () => (controller[key] = $(id).checked);
$("behavior").onchange = () => {
  controller.setMode($("behavior").value, clock());
  $("automatic").checked = controller.automatic;
  $("previousSettings").hidden = controller.mode !== "legacy";
};
function visualSettings() {
  return ink
    ? {
        mode: ink.mode,
        outline: ink.outline,
        contrast: ink.contrast,
        bands: ink.bands,
        intensity: ink.intensity,
        background: ink.background,
        iris: eyeDetails.irisSize,
        pupil: eyeDetails.pupilSize,
      }
    : null;
}
function applyVisual(v) {
  if (!ink || !v) return;
  const signature = JSON.stringify(v);
  if (signature === appliedVisual) return;
  appliedVisual = signature;
  ink.mode = v.mode === "original" ? "original" : "ink";
  ink.outline = Math.max(0, Math.min(5, v.outline));
  ink.contrast = Math.max(0, Math.min(1, v.contrast));
  ink.bands = Math.max(2, Math.min(5, v.bands));
  ink.intensity = Math.max(0, Math.min(1, v.intensity));
  ink.background = /^#[0-9a-f]{6}$/i.test(v.background)
    ? v.background
    : "#cec6b0";
  eyeDetails.irisSize = Math.max(0.6, Math.min(1.4, v.iris));
  eyeDetails.pupilSize = Math.max(0.5, Math.min(1.8, v.pupil));
  ink.apply();
  dirty = true;
  if (!projectorId && channel)
    channel.postMessage({ type: "visual", visual: visualSettings() });
}
function eyeAmount(t) {
  if (!rhythmActive) return 0;
  const b = controller.beatClock.read(t, controller.phraseBeats);
  if (controller.beatClock.revision !== lastPulseRevision) {
    lastPulseRevision = controller.beatClock.revision;
    lastPulseBeat = -1;
  }
  const fallback =
    $("pulseSource").value === "bpm" ||
    t - lastKickTime > 120 / controller.beatClock.bpm;
  $("pulseStatus").textContent =
    $("pulseSource").value === "bpm"
      ? "BPM clock pulses"
      : fallback
        ? "Kick source · BPM fallback"
        : "Detected kick pulses";
  const beat = Math.floor(b.beat);
  if (beat !== lastPulseBeat) {
    lastPulseBeat = beat;
    if (fallback)
      rhythm.trigger(t - (b.phase * 60) / controller.beatClock.bpm, 1);
  }
  return $("pulseEnabled").checked ? eyePulse.sample(t) : 0;
}
for (const id of ["irisSize", "pupilSize", "pulseIntensity"])
  $(id).oninput = () => {
    if (eyeDetails) {
      eyeDetails.irisSize = Number($("irisSize").value);
      eyeDetails.pupilSize = Number($("pupilSize").value);
    }
    eyePulse.intensity = Number($("pulseIntensity").value);

    dirty = true;
  };
$("testPulse").onclick = () => {
  $("pulseEnabled").checked = true;
  rhythmActive = true;
  rhythm.trigger(clock(), 1);
  lastKickTime = clock();
};
for (const id of [
  "outline",
  "shadowContrast",
  "shadingBands",
  "inkIntensity",
  "background",
])
  $(id).oninput = () => {
    if (!ink) return;
    applyVisual({
      mode: $("renderMode").value,
      outline: Number($("outline").value),
      contrast: Number($("shadowContrast").value),
      bands: Number($("shadingBands").value),
      intensity: Number($("inkIntensity").value),
      background: $("background").value,
      iris: Number($("irisSize").value),
      pupil: Number($("pupilSize").value),
    });
  };
$("renderMode").onchange = () => {
  if (!ink) return;
  $("background").value =
    $("renderMode").value === "ink" ? "#cec6b0" : "#000000";
  $("outline").dispatchEvent(new Event("input"));
};
$("headPulseIntensity").onchange = () => {
  rhythmActive = true;
  dirty = true;
};
function setClean(value) {
  document.body.classList.toggle("clean", value);
  $("controls").hidden = value;
  $("reveal").hidden = !value;
  $("hide").setAttribute("aria-expanded", String(!value));
}
function reset() {
  rhythm.reset();
  rhythmActive = false;
  $("pulseEnabled").checked = false;
  lastEyeAmount = 0;
  eyeDetails?.update(zero(), 0);
  $("lastGesture").textContent = "Original sinister grin · reset";
  recent = [];
  rehearsal.stop();
  $("rehearsal").textContent = "Start rehearsal";
  demonstrating = false;
  controller.reset();
  $("automatic").checked = false;
  $("reactive").checked = false;
  $("idle").checked = false;
  $("demo").textContent = "Beat-clock demo";
  document
    .querySelectorAll("[data-preset]")
    .forEach((b) =>
      b.classList.toggle(
        "selected",
        b.dataset.preset === "Default sinister grin",
      ),
    );
  if (rig) {
    rig.set(zero());
    character.root.position.set(0, 0, 0);
    character.root.rotation.set(0, 0, 0);
    character.root.scale.setScalar(1);
    render();
  }
}
async function fullscreen() {
  try {
    const node = document.documentElement;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (node.requestFullscreen) await node.requestFullscreen();
    else if (node.webkitRequestFullscreen) node.webkitRequestFullscreen();
    else throw Error("Use the browser fullscreen command.");
  } catch (e) {
    setClean(false);
    $("projectionStatus").textContent =
      "Fullscreen unavailable here. Open the show in its own tab and use the browser fullscreen command.";
  }
}
$("fullscreen").onclick = fullscreen;
$("hide").onclick = () => setClean(true);
$("reveal").onclick = () => setClean(false);
$("connect").onclick = () => {
  clearFile();
  $("fileStatus").textContent = "MP3 / WAV · stays on your device";
  return input.start($("device").value).then(refreshDevices);
};
$("disconnect").onclick = () => {
  clearFile();
  return input.stop();
};
$("resume").onclick = () => input.resume();
$("device").onchange = () => {
  if (input.stream) input.start($("device").value).then(refreshDevices);
};
$("sensitivity").oninput = () => {
  input.sensitivity = Number($("sensitivity").value);
  $("sensitivityValue").textContent = input.sensitivity.toFixed(2) + "×";
};
$("reactive").onchange = () => {
  controller.clearAccents();
  if ($("reactive").checked) {
    rhythmActive = true;
    rehearsal.stop();
    $("rehearsal").textContent = "Start rehearsal";
    demonstrating = false;
    $("demo").textContent = "Beat-clock demo";
  }
};
async function refreshDevices() {
  try {
    const selected = $("device").value,
      devices = await input.devices();
    $("device").replaceChildren(
      new Option("System default", ""),
      ...devices.map(
        (d, i) => new Option(d.label || "Audio input " + (i + 1), d.deviceId),
      ),
    );
    if ([...$("device").options].some((o) => o.value === selected))
      $("device").value = selected;
  } catch {
    /* Input selection is optional; default device remains usable. */
  }
}
navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
refreshDevices();
function gesture(kind) {
  rhythmActive = true;
  rehearsal.stop();
  $("rehearsal").textContent = "Start rehearsal";
  demonstrating = false;
  $("demo").textContent = "Beat-clock demo";
  triggerEvent(kind, clock(), 1, true);
}
document
  .querySelectorAll("[data-gesture]")
  .forEach((b) => (b.onclick = () => gesture(b.dataset.gesture)));
for (const [name, pose] of Object.entries(presets)) {
  const b = document.createElement("button");
  b.textContent = name
    .replace("Default sinister grin", "Sinister grin")
    .replace("Unhappy / creepy frown", "Unhappy / frown");
  b.dataset.preset = name;
  b.onclick = () => {
    rehearsal.stop();
    $("rehearsal").textContent = "Start rehearsal";
    demonstrating = false;
    $("demo").textContent = "Beat-clock demo";
    controller.preset(
      pose,
      clock(),
      (60 / controller.beatClock.bpm) * controller.transitionBeats,
    );
    $("automatic").checked = false;
    document
      .querySelectorAll("[data-preset]")
      .forEach((x) => x.classList.toggle("selected", x === b));
  };
  $("presets").append(b);
}
$("reset").onclick = reset;
$("demo").onclick = () => {
  if (rehearsal.running) {
    rehearsal.stop();
    $("rehearsal").textContent = "Start rehearsal";
  } else {
    $("pattern").value = "beat";
    $("rehearsal").click();
  }
};
$("projector").onclick = () => {
  if (!channel) {
    $("projectionStatus").textContent =
      "This browser cannot synchronize a second window. Use Fullscreen here.";
    return;
  }
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("projector", id);
  projectorWindow = window.open(
    url,
    "freakshow-live-" + id,
    "width=1280,height=720",
  );
  $("projectionStatus").textContent = projectorWindow
    ? "Projector opened. Move it to your display and click Fullscreen."
    : "Popup blocked. Allow popups, or use Fullscreen in this window.";
};
if (projectorId) {
  $("enterProjector").hidden = false;
  $("enterProjector").onclick = fullscreen;
  document.addEventListener(
    "fullscreenchange",
    () => ($("enterProjector").hidden = !!document.fullscreenElement),
  );
  setClean(true);
  $("projectionStatus").textContent =
    "Projector output · following the controller";
  $("connect").disabled = true;
  $("projector").hidden = true;
}
channel?.addEventListener("message", ({ data }) => {
  if (projectorId && data?.visual) applyVisual(data.visual);
  if (projectorId && data?.type === "pose") {
    lastSnapshot = data;
    lastSnapshotTime = clock();
  }
});
window.addEventListener("message", ({ data, origin, source }) => {
  if (
    origin !== location.origin ||
    source !== window.parent ||
    data?.type !== "freakshow-live-active"
  )
    return;
  active = !!data.active;
  if (!active) {
    clearFile();
    input.stop();
    reset();
  } else lastRender = -100;
});
window.addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const map = { 1: "kick", 2: "snare", 3: "clap", 4: "hat", 5: "melody" };
  if (map[e.key]) gesture(map[e.key]);
  else if (e.key.toLowerCase() === "f") fullscreen();
  else if (e.key.toLowerCase() === "h")
    setClean(!document.body.classList.contains("clean"));
  else if (e.key.toLowerCase() === "r") reset();
  else if (e.key === " ") {
    e.preventDefault();
    $("reactive").click();
  }
});
function resize() {
  if (!renderer) return;
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 0.25, 5.3 / Math.min(1, camera.aspect / 0.95));
  camera.lookAt(0, 0.25, -0.1);
  camera.updateProjectionMatrix();
  ink?.resize();
  dirty = true;
}
window.addEventListener("resize", resize);
function gpuReady() {
  if (!fence) return true;
  const gl = renderer.getContext(),
    state = gl.clientWaitSync(fence, 0, 0);
  if (state === gl.TIMEOUT_EXPIRED) return false;
  gl.deleteSync(fence);
  fence = null;
  return true;
}
function render() {
  if (!renderer || !gpuReady()) {
    dirty = true;
    return;
  }
  renderer.render(scene, camera);
  dirty = false;
  const gl = renderer.getContext();
  if (gl.fenceSync) {
    fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }
}
function motion(t, head, idle) {
  if (!projectorId) eyeAmount(t);
  return {
    y: idle ? (0.012 + 0.008 * controller.energy) * Math.sin(t * 0.3) : 0,
    x: idle ? 0.013 * Math.sin(t * 0.34) - head.recoil : -head.recoil,
    ry: (idle ? 0.035 * Math.sin(t * 0.22) : 0) + head.turn,
    rz: (idle ? 0.012 * Math.sin(t * 0.18) : 0) + head.tilt,
    z: -head.recoil,
    scale: rhythmActive
      ? rhythm.scale(t, Number($("headPulseIntensity").value))
      : 1,
  };
}
function applyMotion(m) {
  character.root.position.set(0, m.y, m.z);
  character.root.rotation.set(m.x, m.ry, m.rz);
  character.root.scale.setScalar(m.scale);
}
function advanceDemo(t) {
  for (const e of rehearsal.advance(t, {
    claps: $("rehearsalClaps").checked,
    hats: $("rehearsalHats").checked,
  })) {
    controller.listen([], t, 0.1);
    triggerEvent(e.kind, t, e.strength, true);
  }
  if (!input.context && !rehearsal.running) controller.listen([], t, 0);
  controller.update(t);
  const beat = controller.beatClock.read(t, controller.phraseBeats);
  $("bpmReadout").textContent = beat.bpm.toFixed(1) + " BPM";
  if (document.activeElement !== $("bpm")) $("bpm").value = beat.bpm.toFixed(1);
  $("beatCounter").textContent =
    `Beat ${beat.barBeat}/4 · Phrase ${beat.phraseBeat}/${controller.phraseBeats}`;
  $("emotion").textContent = controller.currentExpression;
  const tracker = controller.tracker;
  $("syncConfidence").textContent = controller.autoSync
    ? `${Math.round(tracker.confidence * 100)}% · ${tracker.confidence >= 0.62 && tracker.locked ? "tracking" : tracker.locked ? "low confidence · holding last tempo" : "listening · manual clock continues"}`
    : "Manual clock";
}
function frame() {
  if (disposed) return;
  requestAnimationFrame(frame);
  if (!rig || !active) return;
  const t = clock();

  if (t - lastRender < 1 / 30) return;
  lastRender = t;
  if (!gpuReady()) return;
  let nextPose, nextMotion;
  if (projectorId && lastSnapshot && t - lastSnapshotTime < 2) {
    nextPose = constrain(lastSnapshot.pose);
    nextMotion = lastSnapshot.motion;
  } else {
    advanceDemo(t);
    const sample = controller.sample(t, $("idle").checked);
    nextPose = sample.pose;
    nextMotion = motion(t, sample.head, $("idle").checked);
  }
  if (projectorId && lastSnapshot?.visual) applyVisual(lastSnapshot.visual);
  const pulse = projectorId
    ? lastSnapshot && t - lastSnapshotTime < 2
      ? lastSnapshot.eyeAmount || 0
      : 0
    : eyeAmount(t);
  eyeDetails?.update(nextPose, pulse);
  const changed =
    Math.abs(pulse - lastEyeAmount) > 1e-5 ||
    dirty ||
    Object.keys(nextPose).some(
      (k) => Math.abs(nextPose[k] - (lastPose[k] || 0)) > 1e-6,
    ) ||
    !lastMotion ||
    Object.keys(nextMotion).some(
      (k) => Math.abs(nextMotion[k] - lastMotion[k]) > 1e-6,
    );
  if (changed) {
    lastEyeAmount = pulse;
    lastPose = rig.set(nextPose);
    lastMotion = nextMotion;
    applyMotion(lastMotion);
    dirty = true;
  }

  for (const b of document.querySelectorAll("[data-gesture]"))
    b.classList.toggle(
      "pulse",
      controller.events.some(
        (e) => e.kind === b.dataset.gesture && t - e.time < 0.25,
      ),
    );
  if (dirty) render();
  if (!projectorId && channel && t - lastBroadcast > 0.05) {
    channel.postMessage({
      type: "pose",
      pose: lastPose,
      motion: lastMotion,
      eyeAmount: lastEyeAmount,
      visual: visualSettings(),
    });
    lastBroadcast = t;
  }
}
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("stage"), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.5));
  for (const [power, pos] of [
    [2.4, [3, 5, 5]],
    [1.2, [-4, 2, 3]],
    [2, [2, 4, -5]],
  ]) {
    const l = new THREE.DirectionalLight(0xffffff, power);
    l.position.set(...pos);
    scene.add(l);
  }
  camera = new THREE.PerspectiveCamera(37, 1, 0.01, 100);
  resize();
  character = await createProceduralHead();
  scene.add(character.root);
  rig = bindRig(character);
  eyeDetails = new EyeDetails(character);
  ink = new InkRenderer(character, scene, renderer, eyeDetails);
  ink.resize();
  controller.start(clock());
  $("load").textContent = "Candidate A ready · approved sculpt and rig 0924235";
  render();
  window.freakshowLive = {
    rig,
    eyeDetails,
    eyePulse,
    rhythm,
    ink,
    character,
    controller,
    rehearsal,
    input,
    renderer,
    camera,
    presets,
    get pose() {
      return { ...lastPose };
    },
    get demo() {
      return demonstrating;
    },
    gesture,
    reset,
    render,
    ready: true,
  };
  requestAnimationFrame(frame);
} catch (e) {
  $("load").dataset.error = "true";
  $("load").textContent =
    "3D stage unavailable: " +
    e.message +
    ". Open Song Lab for the illustration fallback.";
  console.error(e);
}
const sequenceTimer = setInterval(() => {
  if (active && rig && !projectorId) {
    const t = clock();
    advanceDemo(t);
    if (channel && t - lastBroadcast > 0.05) {
      const s = controller.sample(t, $("idle").checked);
      channel.postMessage({
        type: "pose",
        pose: s.pose,
        motion: motion(t, s.head, $("idle").checked),
        eyeAmount: eyeAmount(t),
        visual: visualSettings(),
      });
      lastBroadcast = t;
    }
  }
}, 16);
window.addEventListener("pagehide", () => input.stop(false));
window.addEventListener("beforeunload", () => {
  disposed = true;
  clearFile();
  clearInterval(sequenceTimer);
  input.stop(false);
  channel?.close();
  projectorWindow?.close();
  ink?.dispose();
  renderer?.dispose();
});

// Direct HTTPS show links warm the same offline assets as the main app.
if (
  "serviceWorker" in navigator &&
  !["localhost", "127.0.0.1"].includes(location.hostname)
)
  navigator.serviceWorker
    .register(new URL("../../sw.js", import.meta.url), {
      updateViaCache: "none",
    })
    .catch(() => {});
