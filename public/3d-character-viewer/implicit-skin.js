import * as THREE from "three";
import { mergeVertices } from "./vendor/BufferGeometryUtils.js";
const smoothMin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const mouthLine = (x) => -0.48 + 0.21 * (x / 0.65) ** 2;
const bump = (x, y, cx, cy, sx, sy) =>
  Math.exp(-1 * ((x - cx) / sx) ** 2 - ((y - cy) / sy) ** 2);
function ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  x -= cx;
  y -= cy;
  z -= cz;
  const a = x / rx,
    b = y / ry,
    c = z / rz,
    k0 = Math.hypot(a, b, c),
    k1 = Math.hypot(a / rx, b / ry, c / rz);
  return k1 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
export function anatomyField(x, y, z) {
  // Occiput and frontal vault are narrower than the cheekbones, not one sphere.
  let d = ellipsoid(x, y, z, 0, 0.15, -0.17, 0.91, 0.99, 0.78);
  d = smoothMin(d, ellipsoid(x, y, z, 0, -0.23, 0.3, 0.78, 0.62, 0.4), 0.19);
  for (const s of [-1, 1]) {
    d = smoothMin(
      d,
      ellipsoid(x, y, z, s * 0.65, -0.055, 0.28, 0.345, 0.31, 0.37),
      0.14,
    );
    d = smoothMin(
      d,
      ellipsoid(
        x,
        y,
        z,
        s * 0.415,
        0.485 + 0.12 * Math.abs(x),
        0.35,
        0.365,
        0.13,
        0.23,
      ),
      0.1,
    );
    d = smoothMin(
      d,
      ellipsoid(x, y, z, s * 0.91, -0.04, -0.14, 0.17, 0.27, 0.21),
      0.14,
    );
  }
  d = smoothMin(d, ellipsoid(x, y, z, 0, -0.73, 0.055, 0.66, 0.4, 0.49), 0.2);
  d = smoothMin(d, ellipsoid(x, y, z, 0, -0.94, 0.24, 0.34, 0.19, 0.29), 0.17);
  // The jaw and chin finish one continuous underside; there is no neck end-volume.
  d = smoothMin(d, ellipsoid(x, y, z, 0, 0.18, 0.52, 0.13, 0.32, 0.17), 0.12);
  d = smoothMin(
    d,
    ellipsoid(x, y, z, 0, 0.015, 0.715, 0.185, 0.17, 0.195),
    0.075,
  );
  for (const s of [-1, 1])
    d = smoothMin(
      d,
      ellipsoid(x, y, z, s * 0.125, -0.075, 0.66, 0.1, 0.085, 0.14),
      0.055,
    );
  const q = Math.hypot(x / 0.65, (y - mouthLine(x)) / 0.142),
    front = THREE.MathUtils.smoothstep(z, 0.36, 0.68);
  // Vermilion relief, nasolabial folds, corner dimples and cheek tension are skin.
  d -= front * (0.012 * Math.exp(-1 * ((q - 1.11) / 0.16) ** 2));
  for (const s of [-1, 1]) {
    d +=
      front *
      0.022 *
      bump(x, y, s * (0.24 + Math.max(0, -y) * 0.56), -0.28, 0.045, 0.24);
    d += front * 0.028 * bump(x, y, s * 0.65, -0.27, 0.045, 0.095);
    d = smoothMin(
      d,
      ellipsoid(x, y, z, s * 0.405, 0.285, 0.4, 0.31, 0.205, 0.31),
      0.1,
    );
    const tilt = y - (0.285 + 0.09 * (Math.abs(x) - 0.4));
    const socket = ellipsoid(
      x,
      tilt,
      z,
      s * 0.405,
      0,
      0.765,
      0.237,
      0.086,
      0.275,
    );
    d = -smoothMin(-d, socket, 0.012);
  }
  const oral = ellipsoid(x, y - mouthLine(x), z, 0, 0, 0.7, 0.65, 0.142, 0.55);
  d = -smoothMin(-d, oral, 0.012);
  return d;
}
export function skinColor(x, y, z) {
  const skin = new THREE.Color(0xc9beaa),
    red = new THREE.Color(0xa22d32),
    lip = new THREE.Color(0x863a3c),
    inside = new THREE.Color(0x3b2029);
  const q = Math.hypot(x / 0.65, (y - mouthLine(x)) / 0.142);
  if (
    Math.abs(ellipsoid(x, y - mouthLine(x), z, 0, 0, 0.7, 0.65, 0.142, 0.55)) <
      0.045 &&
    q < 1.05 &&
    z < 0.7 &&
    y < -0.12
  )
    skin.lerp(inside, THREE.MathUtils.clamp((0.74 - z) * 5, 0, 1));
  if (q > 0.86 && q < 1.31 && z > 0.54 && y < -0.12)
    skin.lerp(lip, 0.82 * Math.exp(-1 * ((q - 1.08) / 0.18) ** 2));
  const nose = ellipsoid(x, y, z, 0, 0.015, 0.715, 0.185, 0.17, 0.195);
  if (nose < 0.035 && z > 0.66)
    skin.lerp(red, THREE.MathUtils.smoothstep(z, 0.66, 0.75));
  const hairline =
    0.63 + 0.055 * Math.sin(x * 13 + z * 7) + 0.025 * Math.sin(x * 29 - z * 19);
  if (
    (z < -0.24 && y > -0.9) ||
    (y > hairline && z < 0.16) ||
    (Math.abs(x) > 0.81 && y > -0.45 && z < 0.11)
  )
    skin.setHex(0x182330);
  return skin;
}
export function createSkinGeometry(step = 0.029) {
  const lo = [-1.16, -1.3, -1.09],
    hi = [1.16, 1.34, 1.02],
    n = hi.map((v, i) => Math.ceil((v - lo[i]) / step)),
    [nx, ny, nz] = n;
  const stride = nx + 1,
    plane = stride * (ny + 1),
    values = new Float32Array(plane * (nz + 1));
  const at = (x, y, z) => x + y * stride + z * plane;
  for (let z = 0; z <= nz; z++)
    for (let y = 0; y <= ny; y++)
      for (let x = 0; x <= nx; x++)
        values[at(x, y, z)] = anatomyField(
          lo[0] + x * step,
          lo[1] + y * step,
          lo[2] + z * step,
        );
  const positions = [],
    offsets = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    tetra = [
      [0, 5, 1, 6],
      [0, 1, 2, 6],
      [0, 2, 3, 6],
      [0, 3, 7, 6],
      [0, 7, 4, 6],
      [0, 4, 5, 6],
    ],
    edges = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const v = offsets.map(
          ([dx, dy, dz]) => values[at(x + dx, y + dy, z + dz)],
        );
        if (v.every((a) => a >= 0) || v.every((a) => a < 0)) continue;
        const p = offsets.map(
          ([dx, dy, dz]) =>
            new THREE.Vector3(
              lo[0] + (x + dx) * step,
              lo[1] + (y + dy) * step,
              lo[2] + (z + dz) * step,
            ),
        );
        for (const t of tetra) {
          const inside = t.filter((i) => v[i] < 0),
            outside = t.filter((i) => v[i] >= 0);
          if (!inside.length || !outside.length) continue;
          const dir = new THREE.Vector3();
          for (const i of outside)
            dir.addScaledVector(p[i], 1 / outside.length);
          for (const i of inside) dir.addScaledVector(p[i], -1 / inside.length);
          dir.normalize();
          const cuts = [];
          for (const [a, b] of edges) {
            const i = t[a],
              j = t[b];
            if (v[i] < 0 !== v[j] < 0)
              cuts.push(p[i].clone().lerp(p[j], v[i] / (v[i] - v[j])));
          }
          const center = new THREE.Vector3();
          cuts.forEach((a) => center.addScaledVector(a, 1 / cuts.length));
          const u = cuts[0].clone().sub(center).normalize(),
            w = new THREE.Vector3().crossVectors(dir, u).normalize();
          cuts.sort(
            (a, b) =>
              Math.atan2(
                a.clone().sub(center).dot(w),
                a.clone().sub(center).dot(u),
              ) -
              Math.atan2(
                b.clone().sub(center).dot(w),
                b.clone().sub(center).dot(u),
              ),
          );
          for (let i = 1; i < cuts.length - 1; i++) {
            let a = cuts[0],
              b = cuts[i],
              c = cuts[i + 1];
            const normal = new THREE.Vector3().crossVectors(
              b.clone().sub(a),
              c.clone().sub(a),
            );
            if (normal.dot(dir) < 0) [b, c] = [c, b];
            positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
          }
        }
      }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const g = mergeVertices(raw, 1e-5);
  raw.dispose();
  g.computeVertexNormals();
  const normals = [],
    colors = [],
    p = g.attributes.position,
    e = 0.002;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const normal = new THREE.Vector3(
      anatomyField(x + e, y, z) - anatomyField(x - e, y, z),
      anatomyField(x, y + e, z) - anatomyField(x, y - e, z),
      anatomyField(x, y, z + e) - anatomyField(x, y, z - e),
    ).normalize();
    normals.push(...normal.toArray());
    colors.push(...skinColor(x, y, z).toArray());
  }
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}
