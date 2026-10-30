import * as THREE from "three";
import {
  applyMouthDiagnostic,
  restoreMouthMaterials,
} from "./mouth-diagnostic.js?sculpt=9";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProceduralHead } from "./procedural-head.js?expressions=10";
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
    hairline: [0, 0.05, 1],
    crown: [0, 1, 0.1],
    "back-hair": [0.25, 0.1, -1],
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
    hairline: [[0, 1.05, 0.35], 0.44],
    crown: [[0, 1.0, -0.4], 0.5],
    "back-hair": [[0, 0.35, -1.1], 0.5],
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
let savedInfluenceColors = null;
const reviewClay = new THREE.MeshStandardMaterial({
  color: 0xaaa59d,
  roughness: 0.9,
});
const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
function setSilhouette(enabled) {
  $("silhouette").checked = enabled;
  stage.classList.toggle("silhouette", enabled);
  renderer.setClearColor(enabled ? 0xffffff : 0x191d24);
  if (enabled) {
    $("clay").checked = false;
    $("diagnostic").checked = false;
    $("diagnostic-key").hidden = true;
    restoreMouthMaterials(character);
    scene.overrideMaterial = silhouetteMaterial;
  } else scene.overrideMaterial = $("clay").checked ? reviewClay : null;
  dirty = true;
}
$("silhouette").onchange = (e) => setSilhouette(e.target.checked);
function setClay(enabled) {
  $("clay").checked = enabled;
  if (enabled) restoreInfluence();
  if (enabled) {
    $("silhouette").checked = false;
    stage.classList.remove("silhouette");
    renderer.setClearColor(0x191d24);
  }
  if (enabled) {
    $("diagnostic").checked = false;
    $("diagnostic-key").hidden = true;
    restoreMouthMaterials(character);
  }
  scene.overrideMaterial = enabled ? reviewClay : null;
  dirty = true;
}
function setDiagnostic(enabled) {
  if (enabled) restoreInfluence();
  if (enabled) {
    $("silhouette").checked = false;
    stage.classList.remove("silhouette");
    renderer.setClearColor(0x191d24);
  }
  $("diagnostic").checked = enabled;
  $("diagnostic-key").hidden = !enabled;
  if (enabled) {
    $("clay").checked = false;
    scene.overrideMaterial = null;
    applyMouthDiagnostic(character);
  } else restoreMouthMaterials(character);
  dirty = true;
}
function restoreInfluence() {
  if (savedInfluenceColors) {
    character.face.geometry.setAttribute("color", savedInfluenceColors);
    savedInfluenceColors = null;
  }
  const control = $("tissue-influence");
  if (control) control.checked = false;
}
function setInfluence(enabled) {
  restoreInfluence();
  if (!enabled || !character.expressions) {
    dirty = true;
    return;
  }
  setClay(false);
  setDiagnostic(false);
  setSilhouette(false);
  const g = character.face.geometry,
    w = g.attributes.perioralWeight;
  if (!w) return;
  savedInfluenceColors = g.attributes.color;
  const colors = new Float32Array(w.count * 3),
    cold = new THREE.Color(0x225b91),
    hot = new THREE.Color(0xf16d46),
    color = new THREE.Color();
  for (let i = 0; i < w.count; i++)
    color
      .copy(cold)
      .lerp(hot, w.getX(i))
      .toArray(colors, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  $("tissue-influence").checked = true;
  dirty = true;
}
$("tissue-influence").onchange = (e) => setInfluence(e.target.checked);
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
let previousFrame = performance.now();
function draw(now) {
  const dt = (now - previousFrame) / 1000;
  previousFrame = now;
  if (character.expressions?.update(dt, now)) {
    dirty = true;
    updateExpressionReadout();
  }
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
    character.state.revision === "perioral-flow-11"
      ? "Blendable facial expressions · approved head and hair preserved."
      : "Preserved comparison sculpt · " +
        (character.state.revision === "angry-fairing-9"
          ? "fed4cd1"
          : "3b89be9") +
        ".";
}
async function setModel(version) {
  const matchedExpression = character.expressions?.state;
  $("model-version").disabled = true;
  $("status").textContent = "Loading comparison sculpt…";
  try {
    if (!headCache.has(version)) {
      const module = await import(
        version === "lip13"
          ? "../lip-base-local-13/procedural-head.js"
          : version === "mouth12"
            ? "../mouth-base-local-12/procedural-head.js"
            : version === "previous"
              ? "../expression-base-6db43f6/procedural-head.js"
              : version === "earlier"
                ? "../baseline-3b89be9/procedural-head.js?sculpt=8"
                : "../baseline-fed4cd1/procedural-head.js?sculpt=9"
      );
      headCache.set(version, await module.createProceduralHead());
    }
    restoreInfluence();
    character.expressions?.stop();
    scene.remove(character.root);
    character = headCache.get(version);
    if (matchedExpression && character.expressions)
      character.expressions.set(matchedExpression, { immediate: true });
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
    $("expression-panel").hidden = !character.expressions;
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
function updateExpressionReadout() {
  if (!character.expressions) return;
  const s = character.expressions.state;
  $("expression-readout").textContent =
    `Neutral ${Math.round(s.neutral * 100)}% · Angry ${Math.round(s.anger * 100)}% · Surprised ${Math.round(s.surprise * 100)}%${s.demo ? " · demo running" : ""}`;
}
function setExpression(weights, options) {
  character.expressions?.set(weights, options);
  dirty = true;
  updateExpressionReadout();
}
for (const button of document.querySelectorAll("[data-expression]"))
  button.onclick = () => {
    const name = button.dataset.expression;
    $("anger-blend").value = name === "angry" ? 1 : 0;
    $("surprise-blend").value = name === "surprised" ? 1 : 0;
    setExpression({
      anger: +$("anger-blend").value,
      surprise: +$("surprise-blend").value,
    });
  };
for (const id of ["anger-blend", "surprise-blend"])
  $(id).oninput = () =>
    setExpression({
      anger: +$("anger-blend").value,
      surprise: +$("surprise-blend").value,
    });
for (const button of document.querySelectorAll("[data-lip-opening]"))
  button.onclick = () => {
    const surprise = Number(button.dataset.lipOpening);
    $("anger-blend").value = 0;
    $("surprise-blend").value = surprise;
    setExpression({ anger: 0, surprise });
  };
$("expression-demo").onclick = () => character.expressions?.play();
$("expression-primary").onclick = () => character.expressions?.playPrimary();
$("expression-stop").onclick = () => character.expressions?.stop();
updateExpressionReadout();
window.assetViewer = {
  setExpression,
  setInfluence,
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
  setSilhouette,
  setDiagnostic,
  get model() {
    return character.root;
  },
  get modelState() {
    return { loaded: true, ...character.state };
  },
};

const cagePanel=document.createElement('section');cagePanel.style.cssText='padding:12px;background:#252930;color:white';
cagePanel.innerHTML='<h3>Hidden-cage early test</h3><p>Only Local-17 skin is rendered.</p><button data-cage-jaw="0">Exact Rest</button> <button data-cage-jaw=".30">30% jaw</button> <button data-cage-jaw=".35">35% jaw</button> <button data-cage-jaw=".40">40% jaw</button><p id="cage-readout">Rest</p>';
document.querySelector('aside')?.prepend(cagePanel);if(!cagePanel.parentNode)document.body.append(cagePanel);
document.querySelector('#expression-panel').style.display='none';document.querySelector('#model-version').disabled=true;
for(const b of cagePanel.querySelectorAll('button'))b.onclick=()=>{character.expressions.set({anger:0,surprise:0},{immediate:true});character.deformation.set(+b.dataset.cageJaw);document.querySelector('#cage-readout').textContent=JSON.stringify(character.deformation.state);dirty=true;};
