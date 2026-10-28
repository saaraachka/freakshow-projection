import * as THREE from "three";
import {
  applyMouthDiagnostic,
  restoreMouthMaterials,
} from "./mouth-diagnostic.js?sculpt=4";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProceduralHead } from "./procedural-head.js?sculpt=4";
const $ = (id) => document.getElementById(id),
  canvas = $("scene"),
  stage = $("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x191d24);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(37, 1, 0.01, 100);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.minPolarAngle = 0;
orbit.maxPolarAngle = Math.PI;
orbit.enablePan = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.5));
for (const [color, power, pos] of [
  [0xffffff, 2.4, [3, 5, 5]],
  [0xffffff, 1.2, [-4, 2, 3]],
  [0xffffff, 2, [2, 4, -5]],
]) {
  const light = new THREE.DirectionalLight(color, power);
  light.position.set(...pos);
  scene.add(light);
}
let character;
try {
  character = await createProceduralHead();
} catch (error) {
  $("status").textContent = "Sculpt generation failed: " + error.message;
  throw error;
}
scene.add(character.root);
const center = new THREE.Vector3(0, 0, 0);
let renderedModelRevision = character.state.revision;
let dirty = true,
  frames = 0,
  start = performance.now(),
  distance = 7;
function setCamera(view = "front") {
  const dirs = {
    front: [0, 0, 1],
    "three-quarter": [0.75, 0.12, 1],
    "left-three-quarter": [-0.75, 0.12, 1],
    side: [1, 0, 0],
    "left-side": [-1, 0, 0],
    "rear-three-quarter": [0.8, 0.12, -1],
    "left-rear-three-quarter": [-0.8, 0.12, -1],
    back: [0, 0, -1],
    top: [0, 1, 0.04],
    underside: [0, -1, 0.12],
    eyes: [0, 0.02, 1],
    "eyes-three-quarter": [0.65, 0.03, 1],
    "eyes-side": [1, 0, 0],
    "mouth-three-quarter": [0.7, 0, 1],
    "mouth-side": [1, 0, 0],
    "mouth-left-corner": [-0.3, 0, 1],
    "mouth-right-corner": [0.3, 0, 1],
    nose: [0.15, 0.03, 1],
    mouth: [0, -0.08, 1],
    ears: [0.5, 0.02, 1],
    hair: [0.3, 0.16, 1],
  };
  const details = {
    eyes: [[0, 0.31, 0.36], 0.34],
    "eyes-three-quarter": [[0, 0.31, 0.26], 0.37],
    "eyes-side": [[0, 0.31, 0.15], 0.37],
    "mouth-three-quarter": [[0, -0.49, 0.3], 0.4],
    "mouth-side": [[0, -0.49, 0.3], 0.4],
    "mouth-left-corner": [[-0.5, -0.3, 0.15], 0.22],
    "mouth-right-corner": [[0.5, -0.3, 0.15], 0.22],
    nose: [[0, -0.015, 0.64], 0.3],
    mouth: [[0, -0.49, 0.34], 0.37],
    ears: [[1, 0.035, -0.1], 0.25],
    hair: [[0, 0.87, -0.1], 0.65],
  };
  const [target, scale] = details[view] || [[0, 0, 0], 1];
  const aim = new THREE.Vector3(...target);
  distance =
    (1.95 /
      Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) /
      Math.min(1, camera.aspect)) *
    1.03;
  camera.position
    .copy(aim)
    .addScaledVector(
      new THREE.Vector3(...dirs[view]).normalize(),
      distance * scale,
    );
  orbit.target.copy(aim);
  orbit.minDistance = 1.2;
  orbit.maxDistance = 18;
  orbit.update();
  dirty = true;
}
const reviewClay = new THREE.MeshStandardMaterial({
  color: 0xaaa59d,
  roughness: 0.9,
});
function setClay(enabled) {
  if (enabled) {
    $("diagnostic").checked = false;
    $("diagnostic-key").hidden = true;
    restoreMouthMaterials(character);
  }
  scene.overrideMaterial = enabled ? reviewClay : null;
  dirty = true;
}
function setDiagnostic(enabled) {
  $("diagnostic").checked = enabled;
  $("diagnostic-key").hidden = !enabled;
  if (enabled) {
    $("clay").checked = false;
    scene.overrideMaterial = null;
    applyMouthDiagnostic(character);
  } else restoreMouthMaterials(character);
  dirty = true;
}
$("diagnostic").onchange = (e) => setDiagnostic(e.target.checked);
$("clay").onchange = (e) => setClay(e.target.checked);
setClay(true);
$("reset").onclick = () => setCamera();
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setCamera(b.dataset.view)));
$("wire").onchange = (e) => {
  character.root.traverse((o) => {
    if (o.isMesh) o.material.wireframe = e.target.checked;
  });
  dirty = true;
};
$("hair").onchange = (e) => {
  character.hair.visible = e.target.checked;
  dirty = true;
};
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, +$("quality").value));
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  setCamera();
}
new ResizeObserver(resize).observe(stage);
$("quality").onchange = resize;
resize();
orbit.addEventListener("change", () => (dirty = true));
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  $("status").textContent =
    "WebGL context lost. Reload this development viewer.";
});
function draw(now) {
  requestAnimationFrame(draw);
  orbit.update();
  if (dirty) {
    const modelChanged =
      canvas.dataset.renderedRevision !== renderedModelRevision;
    renderer.render(scene, camera);
    if (modelChanged)
      $("metrics").textContent =
        `${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio()} · static sculpt`;
    canvas.dataset.renderedRevision = renderedModelRevision;
    dirty = false;
    frames++;
  }
  if (now - start > 1000) {
    $("metrics").textContent =
      `${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio()} · ${frames} draws/s · idle rendering pauses`;
    frames = 0;
    start = now;
  }
}
requestAnimationFrame(draw);
canvas.dataset.modelLoaded = "true";
canvas.dataset.modelSource = "procedural-code";
const headCache = new Map([["refined", character]]);
function modelStatus() {
  $("status").textContent =
    character.state.revision === "precision-correction-4"
      ? "Precision correction · full crown, complete eyes and fitted dental arches. Static review."
      : "Before correction · 6b838a5. Preserved geometry.";
}
async function setModel(version) {
  $("model-version").disabled = true;
  $("status").textContent = "Loading comparison sculpt…";
  try {
    if (!headCache.has(version)) {
      const module = await import(
        "./baseline-6b838a5/procedural-head.js?sculpt=3"
      );
      headCache.set(version, await module.createProceduralHead());
    }
    scene.remove(character.root);
    character = headCache.get(version);
    renderedModelRevision = character.state.revision;
    scene.add(character.root);
    character.hair.visible = $("hair").checked;
    character.root.traverse((o) => {
      if (o.isMesh) o.material.wireframe = $("wire").checked;
    });
    if ($("diagnostic").checked) applyMouthDiagnostic(character);
    else restoreMouthMaterials(character);
    $("model-version").value = version;
    dirty = true;
    modelStatus();
  } catch (error) {
    $("status").textContent = "Comparison could not load: " + error.message;
    throw error;
  } finally {
    $("model-version").disabled = false;
  }
}
$("model-version").onchange = (e) => setModel(e.target.value);
$("model-version").disabled = false;
modelStatus();
window.assetViewer = {
  renderer,
  scene,
  camera,
  orbit,
  get character() {
    return character;
  },
  setModel,
  setCamera,
  setClay,
  setDiagnostic,
  get model() {
    return character.root;
  },
  get modelState() {
    return { loaded: true, ...character.state };
  },
};
