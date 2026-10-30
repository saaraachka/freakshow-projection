import * as THREE from "three";
import { createProceduralHead } from "../3d-character-viewer/baseline-fed4cd1/procedural-head.js";
import {
  bindRig,
  zero,
  constrain,
  presets,
} from "../candidate-a-rig/rig.js?release=inner-seal-1";
import {
  FacialPerformance,
  Rehearsal,
} from "./performance.js?release=audio-file-3";
import { LiveInput } from "./input.js?release=audio-file-3";
const $ = (id) => document.getElementById(id),
  clock = () => performance.now() / 1000;
const params = new URL(location.href).searchParams,
  projectorId = params.get("projector"),
  id =
    projectorId || crypto.randomUUID?.() || String(Date.now()) + Math.random();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("freakshow-live-" + id)
    : null;
const controller = new FacialPerformance({ zero, constrain, presets });
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
    $("status").textContent = message;
    if (state === "off" || state === "error") $("level").value = 0;
    $("status").dataset.state = state;
    $("connect").disabled = ["pending", "live", "suspended"].includes(state);
    $("disconnect").disabled = !["pending", "live", "suspended"].includes(
      state,
    );
    $("resume").hidden = state !== "suspended";
  },
  frame: ({ level, events, time }) => {
    $("level").value = Math.min(1, level * 3);
    for (const e of events) {
      const ignored = e.kind === "hat" && !$("hats").checked;
      recent.push({ ...e, wallTime: time, ignored });
      if (
        $("reactive").checked &&
        !demonstrating &&
        !rehearsal.running &&
        !ignored
      )
        triggerEvent(e.kind, e.wallTime ?? time, e.strength, false);
    }
    recent = recent.filter((e) => time - e.wallTime < 3).slice(-12);
    if (rig && !projectorId && channel && time - lastBroadcast > 0.05) {
      advanceDemo(time);
      const s = controller.sample(time, $("idle").checked);
      channel.postMessage({
        type: "pose",
        pose: s.pose,
        motion: motion(time, s.head, $("idle").checked),
      });
      lastBroadcast = time;
    }
    const e = recent.at(-1);
    $("heard").textContent = e
      ? `${e.kind === "melody" ? "Tonal note" : e.kind[0].toUpperCase() + e.kind.slice(1)} ${e.ignored ? "· ignored" : $("reactive").checked ? "→ ${controller.mappings[e.kind].expression}" : "· reactions paused"}`
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
  $("demo").textContent = "Automatic demo";
  $("rehearsal").textContent = "Start rehearsal";
  controller.preset({}, clock(), 0.12);
  $("reactive").checked = true;
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
    controller.preset({}, clock(), 0.1);
    input.detector.reset();
    input.clockNode?.port.postMessage({ reset: true });
  };
  player.onpause = () => controller.preset({}, clock(), 0.18);
  player.onended = () => {
    $("fileStatus").textContent = file.name + " · finished";
    controller.preset({}, clock(), 0.18);
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
function triggerEvent(kind, t, strength, manual) {
  if (controller.trigger(kind, t, strength, { manual })) {
    $("heard").textContent =
      `${kind} → ${controller.mappings[kind].expression}`;
    $("lastGesture").textContent =
      `${kind} → ${controller.mappings[kind].expression}`;
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
  if (rehearsal.running) {
    rehearsal.stop();
    controller.preset({}, clock(), 0.18);
  } else {
    demonstrating = false;
    $("demo").textContent = "Automatic demo";
    $("reactive").checked = false;
    rehearsal.start($("pattern").value, clock(), Number($("tempo").value));
  }
  $("rehearsal").textContent = rehearsal.running
    ? "Stop rehearsal"
    : "Start rehearsal";
};
for (const key of ["pattern", "tempo"])
  $(key).onchange = () => {
    if (rehearsal.running)
      rehearsal.start($("pattern").value, clock(), Number($("tempo").value));
  };
function setClean(value) {
  document.body.classList.toggle("clean", value);
  $("controls").hidden = value;
  $("reveal").hidden = !value;
  $("hide").setAttribute("aria-expanded", String(!value));
}
function reset() {
  $("lastGesture").textContent = "Original sinister grin · reset";
  recent = [];
  rehearsal.stop();
  $("rehearsal").textContent = "Start rehearsal";
  demonstrating = false;
  controller.reset();
  $("reactive").checked = false;
  $("idle").checked = false;
  $("demo").textContent = "Automatic demo";
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
  controller.preset({}, clock(), 0.3);
  if ($("reactive").checked) {
    rehearsal.stop();
    $("rehearsal").textContent = "Start rehearsal";
    demonstrating = false;
    $("demo").textContent = "Automatic demo";
    controller.preset({}, clock(), 0.35);
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
  rehearsal.stop();
  $("rehearsal").textContent = "Start rehearsal";
  demonstrating = false;
  $("demo").textContent = "Automatic demo";
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
    $("demo").textContent = "Automatic demo";
    $("reactive").checked = false;
    controller.preset(pose, clock(), 0.85);
    document
      .querySelectorAll("[data-preset]")
      .forEach((x) => x.classList.toggle("selected", x === b));
  };
  $("presets").append(b);
}
$("reset").onclick = reset;
$("demo").onclick = () => {
  rehearsal.stop();
  $("rehearsal").textContent = "Start rehearsal";
  demonstrating = !demonstrating;
  $("demo").textContent = demonstrating ? "Stop demo" : "Automatic demo";
  $("reactive").checked = false;
  if (demonstrating) {
    demoNext = 0;
    demoIndex = 0;
  } else controller.preset({}, clock(), 0.7);
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
  return {
    y: idle ? 0.02 * Math.sin(t * 0.3) : 0,
    x: idle ? 0.013 * Math.sin(t * 0.34) - head.recoil : -head.recoil,
    ry: (idle ? 0.035 * Math.sin(t * 0.22) : 0) + head.turn,
    rz: (idle ? 0.012 * Math.sin(t * 0.18) : 0) + head.tilt,
    z: -head.recoil,
    scale: 1 + (idle ? 0.003 * Math.sin(t * 0.6) : 0) + head.pulse,
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
  }))
    triggerEvent(e.kind, t, e.strength, true);
  if (demonstrating && t >= demoNext) {
    const names = Object.keys(presets),
      name = names[demoIndex % names.length],
      duration = [0.9, 1.1, 0.8, 1.25, 0.9, 1.2][demoIndex % 6];
    controller.preset(presets[name], t, duration);
    demoNext = t + duration + [1, 1.2, 0.8, 1.1, 0.9, 1.3][demoIndex++ % 6];
  }
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
  const changed =
    dirty ||
    Object.keys(nextPose).some(
      (k) => Math.abs(nextPose[k] - (lastPose[k] || 0)) > 1e-6,
    ) ||
    !lastMotion ||
    Object.keys(nextMotion).some(
      (k) => Math.abs(nextMotion[k] - lastMotion[k]) > 1e-6,
    );
  if (changed) {
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
    channel.postMessage({ type: "pose", pose: lastPose, motion: lastMotion });
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
  $("load").textContent = "Candidate A ready · approved sculpt and rig 0924235";
  render();
  window.freakshowLive = {
    rig,
    character,
    controller,
    rehearsal,
    input,
    renderer,
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
  if (active && rig && !projectorId) advanceDemo(clock());
}, 16);
window.addEventListener("pagehide", () => input.stop(false));
window.addEventListener("beforeunload", () => {
  disposed = true;
  clearFile();
  clearInterval(sequenceTimer);
  input.stop(false);
  channel?.close();
  projectorWindow?.close();
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
