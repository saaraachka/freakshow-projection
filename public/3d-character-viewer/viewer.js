import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProceduralHead } from "./procedural-head.js?anatomy=1";
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
scene.add(new THREE.HemisphereLight(0xeaf1ff, 0x45404a, 1.5));
for (const [color, power, pos] of [
  [0xffe4ce, 2.4, [3, 5, 5]],
  [0xadc7ff, 1.2, [-4, 2, 3]],
  [0xf1e9ff, 2, [2, 4, -5]],
]) {
  const light = new THREE.DirectionalLight(color, power);
  light.position.set(...pos);
  scene.add(light);
}
const character = createProceduralHead();
scene.add(character.root);
const center = new THREE.Vector3(0, 0, 0);
let dirty = true,
  frames = 0,
  start = performance.now(),
  distance = 7;
function setCamera(view = "front") {
  const dirs = {
    front: [0, 0, 1],
    "three-quarter": [0.75, 0.12, 1],
    side: [1, 0, 0],
    back: [0, 0, -1],
    underside: [0, -1, 0.2],
    mouth: [0, -0.15, 1],
  };
  distance =
    (1.95 /
      Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) /
      Math.min(1, camera.aspect)) *
    1.03;
  camera.position
    .copy(center)
    .addScaledVector(
      new THREE.Vector3(...dirs[view]).normalize(),
      distance * (view === "mouth" ? 0.62 : 1),
    );
  orbit.target.copy(center);
  orbit.minDistance = 1.2;
  orbit.maxDistance = 18;
  orbit.update();
  dirty = true;
}
$("expression").onchange = () => {
  character.setPose($("expression").value, +$("intensity").value);
  dirty = true;
};
$("intensity").oninput = $("expression").onchange;
$("jaw").oninput = () => {
  character.setJaw(+$("jaw").value);
  dirty = true;
};
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
    renderer.render(scene, camera);
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
$("status").textContent =
  "Anatomy refinement · continuous skull, sockets, lips and chin · 24 rigid teeth · irregular tapered curl strands. No image assets.";
window.assetViewer = {
  renderer,
  scene,
  camera,
  orbit,
  character,
  setCamera,
  get model() {
    return character.root;
  },
  get modelState() {
    return { loaded: true, ...character.state };
  },
};
