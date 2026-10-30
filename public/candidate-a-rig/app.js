import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProceduralHead } from "../3d-character-viewer/baseline-fed4cd1/procedural-head.js";
import {
  bindRig,
  controls,
  presets,
  experimentalPresets,
  gestures,
  constrain,
  zero,
} from "./rig.js";
const $ = (id) => document.getElementById(id),
  renderer = new THREE.WebGLRenderer({
    canvas: $("prototype"),
    antialias: true,
  });
renderer.setClearColor(0x191d24);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(),
  clay = new THREE.MeshStandardMaterial({ color: 0xaaa59d, roughness: 0.9 });
scene.overrideMaterial = clay;
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
const camera = new THREE.PerspectiveCamera(37, 1, 0.01, 100),
  orbit = new OrbitControls(camera, $("prototype"));
orbit.minDistance = 1.4;
orbit.maxDistance = 18;
let dirty = true,
  character,
  rig,
  current = zero(),
  transition = null,
  sequence = null,
  next = 0,
  seqIndex = 0,
  lastBlink = 0,
  gestureName = null,
  frames = [];
function render() {
  renderer.render(scene, camera);
  dirty = false;
}
function setView(name = "front") {
  const target = new THREE.Vector3(0, 0.28, -0.1),
    dir = new THREE.Vector3(
      ...{ front: [0, 0, 1], three: [0.75, 0.1, 1], side: [1, 0, 0] }[name],
    );
  orbit.target.copy(target);
  camera.position
    .copy(dir)
    .normalize()
    .multiplyScalar(5.4 / Math.min(1, camera.aspect / 0.96))
    .add(target);
  orbit.update();
  dirty = true;
}
function resize() {
  const e = $("prototype").parentElement;
  renderer.setSize(e.clientWidth, e.clientHeight, false);
  camera.aspect = e.clientWidth / e.clientHeight;
  camera.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe($("prototype").parentElement);
resize();
setView();
orbit.addEventListener("change", () => (dirty = true));
function sync() {
  for (const key of Object.keys(controls)) {
    $(key).value = current[key];
    $(`${key}-value`).textContent = current[key].toFixed(
      key === "jawOpen" ? 1 : 2,
    );
  }
}
function pose(q) {
  if (!rig) return;
  current = rig.set(q);
  sync();
  dirty = true;
}
function to(q, duration = +$("duration").value, onComplete = null) {
  transition = {
    from: { ...current },
    to: constrain(q),
    start: performance.now(),
    duration: Math.max(0.05, duration) * 1000,
    onComplete,
  };
}
function gesture(name, keepSequence = false) {
  $("auto-blink").checked = false;
  lastBlink = 0;
  if (!keepSequence) sequence = null;
  gestureName = name;
  $("activity").textContent = "Gesture: " + name;
  to(gestures[name], 0.09, () =>
    to(zero(), 0.27, () => {
      gestureName = null;
      $("activity").textContent = "Returned to approved grin";
    }),
  );
}
for (const [name] of Object.entries(experimentalPresets)) {
  const b = document.createElement("button");
  b.textContent = name + " · experimental";
  b.disabled = true;
  b.title = "Retained for future development; excluded from playback";
  $("experimental").append(b);
}
for (const b of document.querySelectorAll("[data-gesture]"))
  b.onclick = () => gesture(b.dataset.gesture);
document.addEventListener("keydown", (e) => {
  if (e.repeat || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
    return;
  const key = { 1: "kick", 2: "snare", 3: "clap", 4: "hat" }[e.key];
  if (key) {
    e.preventDefault();
    gesture(key);
  }
});
for (const [name, value] of Object.entries(presets)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.dataset.preset = name;
  b.onclick = () => {
    sequence = null;
    gestureName = null;
    to(value);
    $("activity").textContent = name;
    document
      .querySelectorAll("[data-preset]")
      .forEach((x) => x.classList.toggle("active", x === b));
  };
  $("presets").append(b);
}
for (const [key, [label, min, max, value]] of Object.entries(controls)) {
  const l = document.createElement("label");
  l.textContent = label;
  const o = document.createElement("output");
  o.id = key + "-value";
  o.textContent = value;
  const i = document.createElement("input");
  i.id = key;
  i.type = "range";
  i.min = min;
  i.max = max;
  i.value = value;
  i.step = key === "jawOpen" ? 0.05 : 0.01;
  i.oninput = () => {
    transition = sequence = null;
    gestureName = null;
    pose({ ...current, [key]: +i.value });
  };
  l.append(o, i);
  $("channels").append(l);
}
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => setView(b.dataset.view);
$("clay").onchange = () => {
  scene.overrideMaterial = $("clay").checked ? clay : null;
  dirty = true;
};
$("rest").onclick = () => {
  transition = sequence = null;
  gestureName = null;
  $("activity").textContent = "Exact approved grin";
  $("auto-blink").checked = false;
  pose(zero());
};
$("stop").onclick = () => {
  transition = sequence = null;
  if (gestureName) {
    gestureName = null;
    pose(zero());
  }
  $("activity").textContent = "Paused";
};
$("duration").oninput = () => {
  $("duration-value").textContent = $("duration").value + " s";
};
$("cycle").onclick = () => {
  sequence = "slow";
  seqIndex = 0;
  next = 0;
};
$("rapid").onclick = () => {
  sequence = "rapid";
  seqIndex = 0;
  next = 0;
};
$("rehearsal").onclick = () => {
  sequence = "percussion";
  seqIndex = 0;
  next = 0;
};
try {
  character = await createProceduralHead();
  scene.add(character.root);
  rig = bindRig(character);
  $("status").textContent =
    "Candidate A · five bounded expressions · smooth transitions · percussion rehearsal";
  pose(zero());
} catch (e) {
  $("status").textContent = e.message;
  throw e;
}
window.candidateARig = {
  character,
  rig,
  controls,
  presets,
  experimentalPresets,
  gestures,
  gesture,
  pose(q) {
    transition = sequence = null;
    pose(q);
    render();
  },
  transition(q, d) {
    to(q, d);
  },
  setView(name) {
    setView(name);
    render();
  },
  get current() {
    return { ...current };
  },
  get transitioning() {
    return !!transition;
  },
  get sequence() {
    return sequence;
  },
  get frameCosts() {
    return frames.slice();
  },
  render,
};
function frame(now) {
  requestAnimationFrame(frame);
  if (!rig) return;
  const started = performance.now();
  if (
    sequence &&
    now >= next &&
    !(sequence !== "slow" && gestureName && transition)
  ) {
    if (sequence === "slow") {
      const names = Object.keys(presets),
        i = seqIndex++ % names.length,
        durations = [1.1, 0.85, 0.6, 1.25, 0.75],
        holds = [1.1, 1.5, 1.25, 1.4, 1.0];
      to(presets[names[i]], +$("duration").value * durations[i]);
      $("activity").textContent = names[i];
      next = now + (+$("duration").value * durations[i] + holds[i]) * 1000;
    } else {
      const rhythm =
        sequence === "percussion"
          ? ["kick", "hat", "snare", "hat", "kick", "clap", "snare", "hat"]
          : ["kick", "snare", "clap", "hat"];
      gesture(rhythm[seqIndex++ % rhythm.length], true);
      next = now + (sequence === "rapid" ? 470 : 650);
    }
  }
  if (transition) {
    const active = transition,
      t = Math.min(1, (now - active.start) / active.duration),
      w = t * t * t * (10 + t * (-15 + 6 * t)),
      q = {};
    for (const key of Object.keys(controls))
      q[key] = active.from[key] + (active.to[key] - active.from[key]) * w;
    pose(q);
    if (t === 1) {
      transition = null;
      active.onComplete?.();
    }
  }
  // Gentle lid motion only; this release deliberately excludes full blinks.
  if ($("auto-blink").checked) {
    const phase = now % 4200,
      b = phase < 420 ? 0.25 * Math.sin((Math.PI * phase) / 420) ** 2 : 0;
    if (b !== lastBlink) {
      rig.set({ ...current, blink: Math.max(b, current.blink) });
      lastBlink = b;
      dirty = true;
    }
  } else if (lastBlink) {
    rig.set(current);
    lastBlink = 0;
    dirty = true;
  }
  if (dirty) {
    render();
    frames.push(performance.now() - started);
    if (frames.length > 180) frames.shift();
    $("timing").textContent =
      `${rig.jaw.degrees.toFixed(1)}° jaw · original Candidate A skin`;
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sequence = transition = null;
    gestureName = null;
    $("auto-blink").checked = false;
    lastBlink = 0;
    pose(zero());
  }
});
requestAnimationFrame(frame);
