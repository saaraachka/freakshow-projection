import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const canvas = document.querySelector("#scene"),
  viewport = document.querySelector("#viewport");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setClearColor(0x171b22);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.25, 8.6);
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 0.08, 0);
orbit.enableDamping = true;
orbit.minDistance = 4.4;
orbit.maxDistance = 13;
orbit.maxPolarAngle = Math.PI * 0.86;
scene.add(new THREE.HemisphereLight(0xe4edff, 0x49404a, 2));
function light(color, power, x, y, z) {
  const l = new THREE.DirectionalLight(color, power);
  l.position.set(x, y, z);
  scene.add(l);
}
light(0xffe1c5, 3, 3, 5, 5);
light(0x9cbcff, 2, -4, 1, 2);
light(0xe9e4ff, 3, 1, 3, -4);
const mat = (color, roughness = 0.75) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const skin = mat(0xb9a79b),
  lip = mat(0x946f6b),
  gum = mat(0x876063),
  tooth = mat(0xe8ddc3, 0.42),
  dark = mat(0x21151c),
  tongueMat = mat(0x9d6c71),
  hairMat = mat(0x202733),
  red = mat(0xa92f37, 0.34),
  white = mat(0xd2c9b6, 0.4),
  green = mat(0x64a34a, 0.38),
  black = mat(0x080c10, 0.25);
const head = new THREE.Group();
scene.add(head);
function ellipsoid(parent, material, x, y, z, sx, sy, sz, segments = 32) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(
      1,
      segments,
      Math.max(8, Math.round(segments * 0.6)),
    ),
    material,
  );
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const hinge = new THREE.Group();
hinge.position.set(0, -0.18, -0.22);
head.add(hinge);
// All lower mouth structures share this transform and retain fixed crown dimensions.
function jawPoint(v, angle) {
  const p = v.clone().sub(hinge.position);
  p.applyAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  return p.add(hinge.position);
}
function gaussian(x, y, cx, cy, sx, sy) {
  return Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
}
let smile = 1,
  opening = 0.14;
const N = 128,
  R = 40,
  positions = [],
  indices = [],
  neutral = [];
// Annular facial topology: inner loop is the oral border, outer loop the skull equator.
function facePoint(i, j, s = smile, a = opening) {
  const theta = (i / N) * Math.PI * 2,
    t = j / R,
    c = Math.cos(theta),
    sn = Math.sin(theta);
  const upper = sn >= 0;
  const mx = (0.57 + 0.11 * s) * c,
    my = -0.52 + (0.008 + 0.08 * s + 0.07 * a) * sn + 0.19 * s * c * c;
  const ox = 1.19 * c,
    oy = 0.08 + 1.43 * sn;
  const ease = t * t * (3 - 2 * t),
    x = THREE.MathUtils.lerp(mx, ox, ease),
    y = THREE.MathUtils.lerp(my, oy, ease);
  let z =
    0.12 +
    1.14 *
      Math.sqrt(Math.max(0, 1 - (x / 1.28) ** 2 - ((y - 0.05) / 1.58) ** 2));
  z +=
    0.17 *
    (gaussian(x, y, 0.69, -0.12, 0.38, 0.38) +
      gaussian(x, y, -0.69, -0.12, 0.38, 0.38)); // malar volume
  z += 0.12 * gaussian(x, y, 0, -1.02, 0.48, 0.24); // mental prominence
  z += 0.12 * Math.exp(-t * 32);
  z += 0.12 * (1 - s) * (1 - a) * gaussian(x, y, 0, -0.45, 0.72, 0.2); // attached lip roll
  z -=
    0.07 *
    (gaussian(x, y, 0.54, -0.38, 0.09, 0.24) +
      gaussian(x, y, -0.54, -0.38, 0.09, 0.24)); // nasolabial valleys
  z *= Math.sqrt(Math.max(0, 1 - t ** 8));
  let v = new THREE.Vector3(x, y, z);
  const lower =
    (1 - sn) * 0.5 * (1 - t) +
    (1 - THREE.MathUtils.smoothstep(y, -0.6, -0.18)) * t;
  const moved = jawPoint(v, a * 0.57);
  v.lerp(moved, lower * (1 - t) * (1 - t));
  return v;
}
for (let j = 0; j <= R; j++)
  for (let i = 0; i <= N; i++) {
    const p = facePoint(i, j);
    positions.push(p.x, p.y, p.z);
    neutral.push(p.clone());
    if (j < R && i < N) {
      const k = j * (N + 1) + i;
      indices.push(k, k + N + 2, k + 1, k, k + N + 1, k + N + 2);
    }
  }
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
geo.setIndex(indices);
geo.computeVertexNormals();
const face = new THREE.Mesh(geo, skin);
head.add(face);
// Closed rear skull hemisphere shares the outer facial silhouette; no flat card.
const skullGeo = new THREE.SphereGeometry(1, 64, 48, 0, Math.PI);
const skull = new THREE.Mesh(skullGeo, skin);
skull.rotation.y = Math.PI;
skull.scale.set(1.19, 1.43, 1.05);
skull.position.y = 0.08;
head.add(skull);
// Oral tunnel follows the exact aperture and reaches a deep pharyngeal bowl.
const cavityGeo = new THREE.BufferGeometry(),
  cavityPos = new Float32Array((N + 1) * 9 * 3),
  cavityIdx = [];
for (let j = 0; j < 8; j++)
  for (let i = 0; i < N; i++) {
    const k = j * (N + 1) + i;
    cavityIdx.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
  }
cavityGeo.setAttribute("position", new THREE.BufferAttribute(cavityPos, 3));
cavityGeo.setIndex(cavityIdx);
const cavity = new THREE.Mesh(
  cavityGeo,
  new THREE.MeshStandardMaterial({
    color: 0x291a20,
    roughness: 1,
    side: THREE.DoubleSide,
  }),
);
head.add(cavity);
ellipsoid(head, dark, 0, -0.48, -0.05, 0.65, 0.49, 0.28);
// Lip volume is a continuous tube welded visually to the aperture boundary, never a plane overlay.
let lipMesh;
function lips() {
  const points = [];
  for (let i = 0; i < N; i++) points.push(facePoint(i, 0));
  const curve = new THREE.CatmullRomCurve3(points, true);
  const g = new THREE.TubeGeometry(curve, N, 0.047, 8, true);
  if (!lipMesh) {
    lipMesh = new THREE.Mesh(g, lip);
    head.add(lipMesh);
  } else {
    lipMesh.geometry.dispose();
    lipMesh.geometry = g;
  }
}
const upperArch = new THREE.Group();
head.add(upperArch);
const lowerArch = new THREE.Group();
hinge.add(lowerArch);
lowerArch.position.copy(hinge.position).multiplyScalar(-1);
function crownGeometry(w, h, d, canine) {
  const g = new THREE.SphereGeometry(1, 16, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const taper = canine
      ? 0.7 + (0.3 * (y + 1)) / 2
      : 0.88 + (0.12 * (y + 1)) / 2;
    x = Math.sign(x) * Math.pow(Math.abs(x), 0.55) * w * 0.5 * taper;
    z = Math.sign(z) * Math.pow(Math.abs(z), 0.65) * d * 0.5;
    y *= h * 0.5;
    if (canine && y < 0) {
      x *= 0.6 + (0.4 * (y + h * 0.5)) / (h * 0.5);
      y -= h * 0.1 * (1 - Math.abs(x) / w);
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
const dental = [];
for (const lower of [false, true]) {
  const arch = lower ? lowerArch : upperArch;
  for (let i = 0; i < 12; i++) {
    const theta = (i - 5.5) * 0.205,
      x = Math.sin(theta) * 0.57,
      z = (lower ? 0.55 : 0.65) + Math.cos(theta) * 0.51,
      central = Math.abs(i - 5.5),
      canine = central === 2.5,
      w = central < 2 ? 0.145 : canine ? 0.13 : 0.115,
      h = (lower ? 0.12 : 0.17) * (canine ? 1.38 : 1),
      y = (lower ? -0.63 : -0.51) + 0.19 * smile * (x / 0.68) ** 2;
    const mesh = new THREE.Mesh(crownGeometry(w, h, 0.14, canine), tooth);
    mesh.position.set(x, y, z);
    mesh.rotation.y = theta;
    mesh.rotation.z = ((i % 3) - 1) * 0.025;
    if (lower) mesh.rotation.z += Math.PI;
    arch.add(mesh);
    dental.push(mesh);
    ellipsoid(
      arch,
      gum,
      x,
      y + (lower ? -0.09 : 0.1),
      z - 0.08,
      w * 0.65,
      0.055,
      0.065,
      16,
    );
  }
}
ellipsoid(lowerArch, gum, 0, -0.78, 0.38, 0.53, 0.13, 0.43);
ellipsoid(upperArch, gum, 0, -0.24, 0.35, 0.55, 0.1, 0.43);
ellipsoid(lowerArch, tongueMat, 0, -0.73, 0.5, 0.34, 0.065, 0.28);
// Eyeballs sit in modeled orbital rims; curved upper and lower lids enclose the spheres.
const eyes = [];
for (const sign of [-1, 1]) {
  const x = sign * 0.47,
    y = 0.35,
    z = 1.09;
  ellipsoid(head, skin, x, y, z - 0.06, 0.39, 0.31, 0.23);
  const eye = ellipsoid(head, white, x, y, z + 0.055, 0.255, 0.195, 0.2);
  ellipsoid(head, green, x, y, z + 0.247, 0.108, 0.108, 0.027);
  ellipsoid(head, black, x, y, z + 0.273, 0.045, 0.062, 0.014);
  ellipsoid(
    head,
    white,
    x - 0.027,
    y + 0.036,
    z + 0.285,
    0.019,
    0.019,
    0.008,
    16,
  );
  eyes.push(eye);
  for (const upper of [true, false]) {
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const t = (i / 36) * Math.PI;
      pts.push(
        new THREE.Vector3(
          x + 0.266 * Math.cos(t),
          y + (upper ? 0.15 : -0.145) * Math.sin(t),
          z + 0.135 + 0.072 * Math.sin(t),
        ),
      );
    }
    const lid = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        40,
        upper ? 0.057 : 0.042,
        8,
        false,
      ),
      skin,
    );
    head.add(lid);
  }
  const brow = ellipsoid(head, skin, x, 0.65, 1.14, 0.34, 0.095, 0.1);
  brow.rotation.z = sign * 0.22;
  ellipsoid(head, skin, sign * 1.16, -0.03, 0.06, 0.18, 0.32, 0.18);
  ellipsoid(head, lip, sign * 1.23, -0.03, 0.17, 0.075, 0.19, 0.055);
}
ellipsoid(head, skin, 0, 0.25, 1.22, 0.16, 0.29, 0.19);
ellipsoid(head, red, 0, 0.03, 1.43, 0.255, 0.235, 0.245);
// Sculpted curl masses are true lit 3D geometry, distributed around crown and temples.
const hair = new THREE.Group();
head.add(hair);
for (let i = 0; i < 46; i++) {
  const a = (i / 46) * Math.PI * 2;
  const x = 1.19 * Math.cos(a),
    y = 0.12 + 1.39 * Math.sin(a);
  if (y < -0.7) continue;
  const z = -0.19 + Math.sin(i * 2.4) * 0.17;
  const m = ellipsoid(
    hair,
    hairMat,
    x,
    y,
    z,
    0.27 + 0.05 * Math.sin(i),
    0.3,
    0.32,
    20,
  );
  m.rotation.z = -a;
  const curl = ellipsoid(
    hair,
    hairMat,
    x * 1.12,
    y + 0.04,
    z + 0.12,
    0.19,
    0.24,
    0.23,
    16,
  );
  curl.rotation.z = a * 0.7;
}
// Neck provides a visible attachment and scale cue.
ellipsoid(head, skin, 0, -1.49, -0.23, 0.42, 0.43, 0.43);
ellipsoid(head, mat(0x555d6b), 0, -1.84, -0.25, 0.9, 0.16, 0.58);
function update() {
  hinge.rotation.x = opening * 0.57;
  const p = geo.attributes.position;
  for (let j = 0; j <= R; j++)
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i,
        v = facePoint(i, j);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  for (let j = 0; j <= 8; j++)
    for (let i = 0; i <= N; i++) {
      const v = facePoint(i, 0),
        t = j / 8;
      v.x *= 1 - 0.32 * t;
      v.y = THREE.MathUtils.lerp(v.y, -0.5 - opening * 0.18, t * 0.5);
      v.z = THREE.MathUtils.lerp(v.z, -0.08, t);
      const k = (j * (N + 1) + i) * 3;
      cavityPos[k] = v.x;
      cavityPos[k + 1] = v.y;
      cavityPos[k + 2] = v.z;
    }
  cavityGeo.attributes.position.needsUpdate = true;
  cavityGeo.computeVertexNormals();
  lips();
}
update();
const jaw = document.querySelector("#jaw");
jaw.oninput = () => {
  opening = +jaw.value;
  update();
};
document.querySelector("#pose").onchange = (e) => {
  const p = e.target.value;
  smile = p === "neutral" || p === "closed" ? 0 : 1;
  opening =
    p === "open" ? 0.95 : p === "closed" ? 0 : p === "neutral" ? 0.02 : 0.14;
  jaw.value = opening;
  update();
};
const views = {
  front: [0, 0.25, 8.6],
  "three-quarter": [5, 0.8, 6.6],
  side: [8.6, 0.25, 0.01],
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      camera.position.set(...views[b.dataset.view]);
      orbit.target.set(0, 0.08, 0);
      orbit.update();
    }),
);
document.querySelector("#wire").onchange = (e) => {
  skin.wireframe = e.target.checked;
};
document.querySelector("#hair").onchange = (e) =>
  (hair.visible = e.target.checked);
function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      document.querySelector("#quality").value === "low" ? 1 : 2,
    ),
  );
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
document.querySelector("#quality").onchange = resize;
resize();
let frames = 0,
  stamp = performance.now();
function draw(now) {
  requestAnimationFrame(draw);
  orbit.update();
  renderer.render(scene, camera);
  frames++;
  if (now - stamp > 1000) {
    document.querySelector("#metrics").textContent =
      `${Math.round((frames * 1000) / (now - stamp))} FPS · ${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio()} · Three.js ${THREE.REVISION}`;
    stamp = now;
    frames = 0;
  }
}
requestAnimationFrame(draw);
window.characterStudy = {
  renderer,
  scene,
  camera,
  orbit,
  face,
  hinge,
  dental,
  setPose(p) {
    document.querySelector("#pose").value = p;
    document.querySelector("#pose").dispatchEvent(new Event("change"));
  },
  setView(v) {
    document.querySelector(`[data-view="${v}"]`).click();
  },
  get state() {
    return { smile, opening, teeth: dental.length, hinge: hinge.rotation.x };
  },
};
