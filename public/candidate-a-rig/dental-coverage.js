import { PIVOT } from "../candidate-a-cage/jaw-cage.js";
import * as THREE from "three";
const smooth = (v, a, b) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
// Contact data from the seated original lower dentition, in its rest jaw frame.
// This is a scalar clearance field, never a rendered mesh or tooth-hiding layer.
export function bindDentalCoverage(character, rest, normals, lipLandmarks) {
  const step = 0.01,
    x0 = -0.56,
    y0 = -0.82,
    nx = 113,
    ny = 64,
    raw = new Float32Array(nx * ny).fill(-Infinity),
    v = new THREE.Vector3();
  character.root.updateMatrixWorld(true);
  let triangles = 0;
  character.root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.name.startsWith("Lower_")) return;
    const g = mesh.geometry,
      P = g.attributes.position,
      T = g.index.array;
    for (let t = 0; t < T.length; t += 3) {
      const q = [0, 1, 2].map((k) =>
        v
          .fromBufferAttribute(P, T[t + k])
          .applyMatrix4(mesh.matrixWorld)
          .toArray(),
      );
      const [a, b, c] = q,
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      triangles++;
      const loX = Math.max(
          0,
          Math.ceil((Math.min(a[0], b[0], c[0]) - x0) / step),
        ),
        hiX = Math.min(
          nx - 1,
          Math.floor((Math.max(a[0], b[0], c[0]) - x0) / step),
        );
      const loY = Math.max(
          0,
          Math.ceil((Math.min(a[1], b[1], c[1]) - y0) / step),
        ),
        hiY = Math.min(
          ny - 1,
          Math.floor((Math.max(a[1], b[1], c[1]) - y0) / step),
        );
      for (let iy = loY; iy <= hiY; iy++)
        for (let ix = loX; ix <= hiX; ix++) {
          const x = x0 + ix * step,
            y = y0 + iy * step,
            u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den,
            w = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
          if (u >= -1e-6 && w >= -1e-6 && u + w <= 1.000001) {
            const z = u * a[2] + w * b[2] + (1 - u - w) * c[2],
              k = iy * nx + ix;
            raw[k] = Math.max(raw[k], z);
          }
        }
    }
  });
  // Fair a conservative envelope across adjacent tooth-neck detail so the
  // skin follows an arch, not the individual enamel flutes or intertooth gaps.
  const fair = raw.slice();
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      if (!Number.isFinite(raw[y * nx + x])) continue;
      let z = raw[y * nx + x];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const ix = x + dx,
            iy = y + dy;
          if (ix >= 0 && iy >= 0 && ix < nx && iy < ny)
            z = Math.max(z, raw[iy * nx + ix]);
        }
      fair[y * nx + x] = z;
    }
  // Extend the contact field with a smooth distance fade beyond the actual
  // dental footprint. A hard empty-cell cutoff would leave a second ridge.
  const grid = new Float32Array(raw.length).fill(-Infinity),
    distance = new Float32Array(raw.length).fill(Infinity),
    radius = 7;
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      let nearest = Infinity,
        front = -Infinity;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const ix = x + dx,
            iy = y + dy;
          if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) continue;
          const z = fair[iy * nx + ix];
          if (!Number.isFinite(z)) continue;
          const dist = Math.hypot(dx, dy) * step;
          if (dist < nearest - 1e-8) {
            nearest = dist;
            front = z;
          } else if (Math.abs(dist - nearest) < 1e-8)
            front = Math.max(front, z);
        }
      const k = y * nx + x;
      grid[k] = front;
      distance[k] = nearest;
    }
  const weights = new Float32Array(rest.length / 3),
    indices = [];
  for (let i = 0; i < weights.length; i++) {
    const k = i * 3,
      x = rest[k],
      y = rest[k + 1],
      z = rest[k + 2],
      d = y - lipLandmarks(x).lower;
    weights[i] =
      (1 - smooth(Math.abs(x), 0.22, 0.38)) *
      smooth(z, 0.3, 0.44) *
      smooth(normals[k + 2], 0.1, 0.5) *
      smooth(d, -0.23, -0.155) *
      (1 - smooth(d, -0.085, -0.055));
    if (weights[i] > 1e-6) indices.push(i);
  }
  function sample(x, y) {
    const gx = (x - x0) / step,
      gy = (y - y0) / step,
      ix = Math.floor(gx),
      iy = Math.floor(gy);
    if (ix < 0 || ix >= nx - 1 || iy < 0 || iy >= ny - 1) return null;
    const ks = [
        iy * nx + ix,
        iy * nx + ix + 1,
        (iy + 1) * nx + ix,
        (iy + 1) * nx + ix + 1,
      ],
      zs = ks.map((k) => grid[k]),
      ds = ks.map((k) => distance[k]);
    if (zs.some((z) => !Number.isFinite(z))) return null;
    const u = gx - ix,
      w = gy - iy,
      blend = (c) =>
        (c[0] * (1 - u) + c[1] * u) * (1 - w) + (c[2] * (1 - u) + c[3] * u) * w;
    return { front: blend(zs), weight: 1 - smooth(blend(ds), 0.012, 0.055) };
  }
  let last = { changed: 0, maxShift: 0 };
  function apply(positions, jawDegrees, activation) {
    last = { changed: 0, maxShift: 0 };
    if (!activation) return last;
    const theta = (jawDegrees * Math.PI) / 180,
      c = Math.cos(theta),
      s = Math.sin(theta),
      eps = 0.002;
    for (const i of indices) {
      const k = i * 3,
        dy = positions[k + 1] - PIVOT[1],
        dz = positions[k + 2] - PIVOT[2],
        y = PIVOT[1] + c * dy + s * dz,
        z = PIVOT[2] - s * dy + c * dz,
        field = sample(positions[k], y);
      if (field === null || field.weight === 0) continue;
      const need = field.front + 0.007 * activation - z;
      if (need <= -eps) continue;
      const push =
        (need >= eps ? need : (need + eps) ** 2 / (4 * eps)) *
        weights[i] *
        field.weight;
      if (push <= 1e-8) continue;
      positions[k + 1] -= s * push;
      positions[k + 2] += c * push;
      last.changed++;
      last.maxShift = Math.max(last.maxShift, push);
    }
    return last;
  }
  return {
    apply,
    weights,
    indices,
    sample,
    get last() {
      return { ...last };
    },
    metadata: {
      triangles,
      step,
      regionVertices: indices.length,
      renderedGeometry: false,
    },
  };
}
