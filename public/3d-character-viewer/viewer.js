import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
const $ = (id) => document.getElementById(id),
  canvas = $("scene"),
  stage = $("stage");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  $("status").textContent =
    "WebGL initialization failed. Try opening this viewer directly in Safari.";
  $("metrics").textContent = error.message;
  throw error;
}
renderer.setClearColor(0x191d24);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
camera.position.set(0, 0, 5);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.minPolarAngle = 0;
orbit.maxPolarAngle = Math.PI;
orbit.enablePan = true;
scene.add(new THREE.HemisphereLight(0xeaf1ff, 0x45404a, 2));
for (const [color, power, pos] of [
  [0xffe4ce, 3, [3, 5, 5]],
  [0xadc7ff, 2, [-4, 2, 3]],
  [0xf1e9ff, 3, [2, 4, -5]],
]) {
  const light = new THREE.DirectionalLight(color, power);
  light.position.set(...pos);
  scene.add(light);
}
let model = null,
  bone = null,
  bind = null,
  morphs = [],
  selected = null,
  radius = 1,
  center = new THREE.Vector3(),
  loading = false,
  frames = 0,
  start = performance.now();
const aliases = /^(evil[_ -]?grin|grin|evil[_ -]?smile|smile)$/i;
function setCamera(view = "front") {
  const directions = {
    front: [0, 0, 1],
    side: [1, 0, 0],
    back: [0, 0, -1],
    underside: [0, -1, 0.18],
    mouth: [0, -0.2, 1],
  };
  const d = new THREE.Vector3(...directions[view]).normalize();
  const distance =
    (radius /
      Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) /
      Math.min(1, camera.aspect)) *
    1.12;
  camera.position
    .copy(center)
    .addScaledVector(d, distance * (view === "mouth" ? 0.65 : 1));
  camera.up.set(0, 1, 0);
  orbit.target.copy(center);
  orbit.update();
}
function applyPose() {
  for (const item of morphs) item.mesh.morphTargetInfluences.fill(0);
  if (selected)
    for (const item of morphs) {
      const index = item.mesh.morphTargetDictionary[selected];
      if (index !== undefined)
        item.mesh.morphTargetInfluences[index] = +$("intensity").value;
    }
  const amount = +$("jaw").value;
  let jawMorph = false;
  for (const item of morphs)
    for (const [name, index] of Object.entries(item.mesh.morphTargetDictionary))
      if (/^jaw[_ -]?open$/i.test(name)) {
        item.mesh.morphTargetInfluences[index] = amount;
        jawMorph = true;
      }
  if (bone && bind) {
    bone.quaternion.copy(bind);
    if (!jawMorph)
      bone.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          (amount * Math.PI) / 6,
        ),
      );
  }
}
function dispose(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of o.material
      ? Array.isArray(o.material)
        ? o.material
        : [o.material]
      : []) {
      materials.add(m);
      for (const value of Object.values(m))
        if (value?.isTexture) textures.add(value);
    }
  });
  for (const t of textures) t.dispose();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}
async function loadBuffer(buffer, name) {
  if (loading) return;
  loading = true;
  $("status").textContent = "Loading model…";
  try {
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    if (model) {
      scene.remove(model);
      dispose(model);
    }
    model = gltf.scene;
    bone = null;
    bind = null;
    morphs = [];
    let meshes = 0,
      triangles = 0;
    const names = new Set();
    model.traverse((o) => {
      if (o.isBone && /^(jaw|mandible|lowerjaw)$/i.test(o.name)) {
        bone = o;
        bind = o.quaternion.clone();
      }
      if (!o.isMesh) return;
      meshes++;
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      const label = o.name.toLowerCase();
      const color = /pupil/.test(label)
        ? 0x0b1014
        : /iris/.test(label)
          ? 0x5a984a
          : /nose/.test(label)
            ? 0xad333d
            : /hair/.test(label)
              ? 0x29303e
              : /teeth|tooth/.test(label)
                ? 0xd8d0bf
                : /gum|tongue|lip/.test(label)
                  ? 0x9b7c7c
                  : 0xbfb3a5;
      const old = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of old) {
        for (const value of Object.values(m || {}))
          if (value?.isTexture) value.dispose();
        m?.dispose();
      }
      o.material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      if (o.morphTargetDictionary) {
        morphs.push({ mesh: o });
        Object.keys(o.morphTargetDictionary)
          .filter((n) => !/^jaw[_ -]?open$/i.test(n))
          .forEach((n) => names.add(n));
      }
    });
    if (!meshes) throw new Error("The asset contains no mesh geometry.");
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) throw new Error("The asset has no visible bounds.");
    box.getCenter(center);
    radius = box.getSize(new THREE.Vector3()).length() / 2;
    camera.near = Math.max(0.001, radius / 1000);
    camera.far = Math.max(100, radius * 100);
    camera.updateProjectionMatrix();
    orbit.minDistance = radius * 0.2;
    orbit.maxDistance = radius * 15;
    const select = $("expression");
    select.replaceChildren(new Option("Asset bind pose", ""));
    for (const n of names) select.add(new Option(n, n));
    selected = [...names].find((n) => aliases.test(n)) || null;
    select.value = selected || "";
    select.disabled = names.size === 0;
    $("intensity").disabled = names.size === 0;
    const jawMorph = morphs.some((i) =>
      Object.keys(i.mesh.morphTargetDictionary).some((n) =>
        /^jaw[_ -]?open$/i.test(n),
      ),
    );
    $("jaw").disabled = !(bone || jawMorph);
    $("jaw").value = 0;
    $("jawStatus").textContent = jawMorph
      ? "Jaw uses the model’s jawOpen morph target."
      : bone
        ? "Jaw rotates the model’s skeletal jaw bone around local X."
        : "No compatible jaw control found; the slider is disabled.";
    applyPose();
    setCamera();
    $("empty").hidden = true;
    $("empty").style.display = "none";
    $("reset").disabled = false;
    $("wire").disabled = false;
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => (b.disabled = false));
    $("status").textContent =
      `${name} · ${meshes} meshes · ${Math.round(triangles).toLocaleString()} triangles · ${names.size} expression targets.${selected ? " Default: " + selected + "." : " No named evil-grin target found; showing the asset bind pose."}`;
    canvas.dataset.modelLoaded = "true";
    canvas.dataset.modelSource = name;
    canvas.dataset.morphTargets = names.size;
  } catch (error) {
    $("status").textContent = "Model could not be loaded: " + error.message;
    if (model) {
      scene.remove(model);
      dispose(model);
      model = null;
    }
    $("empty").style.display = "grid";
    canvas.dataset.modelLoaded = "false";
    for (const id of ["expression", "intensity", "jaw", "reset", "wire"])
      $(id).disabled = true;
    document
      .querySelectorAll("[data-view]")
      .forEach((button) => (button.disabled = true));
  } finally {
    loading = false;
  }
}
$("asset").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".glb")) {
    $("status").textContent =
      "Export a binary .glb with embedded geometry and buffers.";
    return;
  }
  await loadBuffer(await file.arrayBuffer(), file.name);
};
$("expression").onchange = (e) => {
  selected = e.target.value || null;
  applyPose();
};
$("intensity").oninput = applyPose;
$("jaw").oninput = applyPose;
$("reset").onclick = () => setCamera();
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setCamera(b.dataset.view)));
$("wire").onchange = (e) =>
  model?.traverse((o) => {
    if (o.isMesh) o.material.wireframe = e.target.checked;
  });
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, +$("quality").value));
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  if (model) setCamera();
}
new ResizeObserver(resize).observe(stage);
$("quality").onchange = resize;
resize();
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  $("status").textContent =
    "WebGL context lost. Reload this viewer to restore the model.";
});
function draw(now) {
  requestAnimationFrame(draw);
  orbit.update();
  renderer.render(scene, camera);
  frames++;
  if (now - start > 1000) {
    $("metrics").textContent =
      `${model ? "Model loaded" : "No model loaded"} · ${Math.round((frames * 1000) / (now - start))} FPS · ${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio()}`;
    frames = 0;
    start = now;
  }
}
requestAnimationFrame(draw);
window.assetViewer = {
  renderer,
  scene,
  camera,
  orbit,
  loadBuffer,
  get model() {
    return model;
  },
  get modelState() {
    return { loaded: !!model, morphs: morphs.length, selected, jaw: !!bone };
  },
};
