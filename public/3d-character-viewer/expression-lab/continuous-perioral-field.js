import * as THREE from "../../character-3d/vendor/three.module.js";
import {
  facialSolidField,
  oralCavityField,
  sampleColumn,
  mouthLine,
} from "./implicit-skin.js?sculpt=9";
const smooth = THREE.MathUtils.smootherstep;
function front(x, y) {
  const c = sampleColumn(x, y);
  let lo = -0.35,
    hi = 1.05,
    last = hi,
    hit = false;
  for (let z = hi; z >= lo; z -= 0.035) {
    if (facialSolidField(x, y, z, c) < 0) {
      lo = z;
      hi = last;
      hit = true;
      break;
    }
    last = z;
  }
  if (!hit) return 0.42;
  for (let i = 0; i < 16; i++) {
    const m = (hi + lo) / 2;
    if (facialSolidField(x, y, m, c) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
function rim(theta) {
  const at = (r) => {
    const x = 0.665 * Math.cos(theta) * r,
      y = mouthLine(x) + 0.125 * Math.sin(theta) * r,
      z = front(x, y);
    return { p: [x, y, z], f: oralCavityField(x, y, z) };
  };
  let lo = 0.45,
    hi = 1.38;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (at(m).f < 0) lo = m;
    else hi = m;
  }
  return at((lo + hi) / 2 + 0.001).p;
}
export function solve(matrix, rhs, n) {
  const a = matrix.slice(),
    b = rhs.slice();
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++)
      if (Math.abs(a[i * n + k]) > Math.abs(a[pivot * n + k])) pivot = i;
    if (Math.abs(a[pivot * n + k]) < 1e-12)
      throw Error("Singular perioral constraint system");
    if (pivot !== k) {
      for (let j = k; j < n; j++)
        [a[k * n + j], a[pivot * n + j]] = [a[pivot * n + j], a[k * n + j]];
      for (let j = 0; j < 3; j++)
        [b[k * 3 + j], b[pivot * 3 + j]] = [b[pivot * 3 + j], b[k * 3 + j]];
    }
    for (let i = k + 1; i < n; i++) {
      const f = a[i * n + k] / a[k * n + k];
      if (!f) continue;
      for (let j = k + 1; j < n; j++) a[i * n + j] -= f * a[k * n + j];
      for (let j = 0; j < 3; j++) b[i * 3 + j] -= f * b[k * 3 + j];
    }
  }
  const out = new Float64Array(n * 3);
  for (let i = n - 1; i >= 0; i--)
    for (let k = 0; k < 3; k++) {
      let v = b[i * 3 + k];
      for (let j = i + 1; j < n; j++) v -= a[i * n + j] * out[j * 3 + k];
      out[i * 3 + k] = v / a[i * n + i];
    }
  return out;
}
export function applyPerioralFlow(g) {
  const p = g.attributes.position,
    N = p.count,
    base = p.array,
    sigma = 0.62,
    inv = 1 / (sigma * sigma),
    steps = 64;
  const rings = 24,
    source = Array.from({ length: rings }, (_, i) =>
      rim((2 * Math.PI * i) / rings),
    );
  const hash = new Map(),
    cell = 0.075,
    key = (x, y, z) =>
      [Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)].join(
        ":",
      );
  for (let i = 0; i < N; i++) {
    const k = key(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k).push(i);
  }
  const cage = (point, pose) => {
    let sum = 0;
    const d = [0, 0, 0],
      cx = Math.floor(point[0] / cell),
      cy = Math.floor(point[1] / cell),
      cz = Math.floor(point[2] / cell),
      target = g.morphAttributes.position[pose].array;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const i of hash.get([cx + x, cy + y, cz + z].join(":")) || []) {
            const dist =
                (point[0] - base[i * 3]) ** 2 +
                (point[1] - base[i * 3 + 1]) ** 2 +
                (point[2] - base[i * 3 + 2]) ** 2,
              w = 1 / (dist + 0.000004) ** 1.5;
            for (let k = 0; k < 3; k++)
              d[k] += w * (target[i * 3 + k] - base[i * 3 + k]);
            sum += w;
          }
    return point.map((v, k) => v + (sum ? d[k] / sum : 0));
  };
  const reports = [],
    mouthRims = [source.flat()],
    influence = new Float32Array(N);
  for (let pose = 0; pose < 2; pose++) {
    const surprise = pose === 1,
      starts = [],
      ends = [];
    for (let j = 0; j < rings; j++) {
      const theta = (2 * Math.PI * j) / rings,
        src = source[j],
        before = source[(j + rings - 1) % rings],
        after = source[(j + 1) % rings];
      const tangent = new THREE.Vector3(
        after[0] - before[0],
        after[1] - before[1],
        after[2] - before[2],
      ).normalize();
      const radial = new THREE.Vector3(tangent.y, -tangent.x, 0).normalize();
      const rx = surprise ? 0.315 : 0.56,
        ry = surprise ? 0.225 : 0.016;
      const dst = [
        rx * Math.cos(theta),
        surprise
          ? -0.545 + ry * Math.sin(theta)
          : -0.435 + ry * Math.sin(theta) + 0.018 * Math.cos(theta) ** 2,
        (surprise ? 0.505 : 0.5) -
          (surprise ? 0.045 : 0.045) * Math.cos(theta) ** 2,
      ];
      const targetRadial = new THREE.Vector3(
        Math.cos(theta) / rx,
        Math.sin(theta) / Math.max(0.08, ry),
        0,
      ).normalize();
      for (const [out, back] of [
        [0, 0],
        [0.045, 0.005],
        [0, -0.065],
      ]) {
        const a = src.map(
          (v, k) => v + radial.getComponent(k) * out + (k === 2 ? back : 0),
        );
        const b = dst.map(
          (v, k) =>
            v + targetRadial.getComponent(k) * out + (k === 2 ? back : 0),
        );
        starts.push(cage(a, pose));
        ends.push(b);
      }
    }
    // Anatomical anchors are already in the current cage/jaw pose. They constrain
    // the residual lip motion, not the skeletal jaw or the approved head itself.
    const anchors = [
      [0, -0.12, 0.75],
      [0.18, -0.11, 0.59],
      [-0.18, -0.11, 0.59],
      [0, -0.2, 0.55],
      [0.63, -0.04, 0.43],
      [-0.63, -0.04, 0.43],
      [0.8, -0.3, 0.06],
      [-0.8, -0.3, 0.06],
      [0, -1.02, 0.38],
      [0.58, -0.81, 0.1],
      [-0.58, -0.81, 0.1],
      [0, -0.45, -0.3],
      [0.42, -0.4, -0.13],
      [-0.42, -0.4, -0.13],
      [0, 0.13, 0.56],
      [0.36, 0.1, 0.4],
      [-0.36, 0.1, 0.4],
    ];
    // Protect a mandibular surface, not a single chin point. The anchors are
    // evaluated in the existing hinged-jaw pose, so closure does not leave a
    // stationary constraint inside moving tissue.
    for (const y of [-0.86, -1.0, -1.12])
      for (const x of [-0.28, 0, 0.28]) anchors.push([x, y, front(x, y)]);
    for (const sign of [-1, 1])
      anchors.push([sign * 0.48, -0.76, front(sign * 0.48, -0.76)]);
    for (const anchor of anchors) {
      const q = cage(anchor, pose);
      starts.push(q);
      ends.push(q);
    }
    const K = starts.length,
      delta = Float64Array.from(
        { length: K * 3 },
        (_, i) => ends[(i / 3) | 0][i % 3] - starts[(i / 3) | 0][i % 3],
      );
    const data = new Float64Array((N + rings) * 3),
      normals = new Float64Array((N + rings) * 3);
    data.set(g.morphAttributes.position[pose].array);
    normals.set(g.morphAttributes.normal[pose].array);
    for (let j = 0; j < rings; j++) {
      data.set(cage(source[j], pose), (N + j) * 3);
      normals[(N + j) * 3 + 2] = 1;
    }
    const centers = new Float64Array(K * 3),
      matrix = new Float64Array(K * K);
    for (let step = 0; step < steps; step++) {
      const t = (step + 0.5) / steps;
      for (let i = 0; i < K; i++)
        for (let k = 0; k < 3; k++)
          centers[i * 3 + k] = starts[i][k] + t * delta[i * 3 + k];
      for (let i = 0; i < K; i++)
        for (let j = 0; j < K; j++) {
          const d =
            (centers[i * 3] - centers[j * 3]) ** 2 +
            (centers[i * 3 + 1] - centers[j * 3 + 1]) ** 2 +
            (centers[i * 3 + 2] - centers[j * 3 + 2]) ** 2;
          const r = Math.sqrt(d * inv),
            u = Math.max(0, 1 - r);
          matrix[i * K + j] =
            (u ** 6 * (35 * r * r + 18 * r + 3)) / 3 + (i === j ? 0.0002 : 0);
        }
      const coefficients = solve(matrix, delta, K),
        dt = 1 / steps;
      for (let i = 0; i < N + rings; i++) {
        const x = data[i * 3],
          y = data[i * 3 + 1],
          z = data[i * 3 + 2];
        if (y > 0.12 || y < -1.13 || z < -0.58 || Math.abs(x) > 1.02) continue;
        const ax = Math.abs(x),
          my = 1 - smooth(y, -0.02, 0.12),
          mz = smooth(z, -0.58, -0.32),
          mx = 1 - smooth(ax, 0.83, 1.02);
        const nr = Math.hypot(x / 0.25, (y + 0.025) / 0.2, (z - 0.72) / 0.28),
          mn = smooth(nr, 1, 1.5),
          mc = smooth(y, -1.13, -0.85),
          mask = my * mz * mx * mn * mc;
        if (mask === 0) continue;
        const derivative = (v, a, b) => {
          const u = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
          return (30 * u * u * (1 - u) * (1 - u)) / (b - a);
        };
        const dn = derivative(nr, 1, 1.5) / Math.max(nr, 1e-8),
          noseGradient = [
            (dn * x) / (0.25 * 0.25),
            (dn * (y + 0.025)) / (0.2 * 0.2),
            (dn * (z - 0.72)) / (0.28 * 0.28),
          ],
          body = my * mz * mx;
        const gradMask = [
          -Math.sign(x) * derivative(ax, 0.83, 1.02) * my * mz * mn * mc +
            body * mc * noseGradient[0],
          -derivative(y, -0.02, 0.12) * mz * mx * mn * mc +
            body * (mc * noseGradient[1] + mn * derivative(y, -1.13, -0.85)),
          derivative(z, -0.58, -0.32) * my * mx * mn * mc +
            body * mc * noseGradient[2],
        ];
        const nx = normals[i * 3],
          ny = normals[i * 3 + 1],
          nz = normals[i * 3 + 2];
        let vx = 0,
          vy = 0,
          vz = 0,
          gx = 0,
          gy = 0,
          gz = 0;
        for (let j = 0; j < K; j++) {
          const dx = x - centers[j * 3],
            dy = y - centers[j * 3 + 1],
            dz = z - centers[j * 3 + 2],
            r = Math.sqrt((dx * dx + dy * dy + dz * dz) * inv);
          if (r >= 1) continue;
          const u = 1 - r,
            phi = (u ** 6 * (35 * r * r + 18 * r + 3)) / 3;
          const a = coefficients[j * 3],
            b = coefficients[j * 3 + 1],
            c = coefficients[j * 3 + 2];
          vx += a * phi;
          vy += b * phi;
          vz += c * phi;
          const f =
            -(56 / 3) * inv * (5 * r + 1) * u ** 5 * (a * nx + b * ny + c * nz);
          gx += f * dx;
          gy += f * dy;
          gz += f * dz;
        }
        data[i * 3] += dt * mask * vx;
        data[i * 3 + 1] += dt * mask * vy;
        data[i * 3 + 2] += dt * mask * vz;
        const nv = vx * nx + vy * ny + vz * nz;
        let a = nx - dt * (mask * gx + gradMask[0] * nv),
          b = ny - dt * (mask * gy + gradMask[1] * nv),
          c = nz - dt * (mask * gz + gradMask[2] * nv),
          l = Math.hypot(a, b, c) || 1;
        normals[i * 3] = a / l;
        normals[i * 3 + 1] = b / l;
        normals[i * 3 + 2] = c / l;
      }
    }
    const before = g.morphAttributes.position[pose].array;
    for (let i = 0; i < N; i++)
      influence[i] = Math.max(
        influence[i],
        Math.min(
          1,
          Math.hypot(
            data[i * 3] - before[i * 3],
            data[i * 3 + 1] - before[i * 3 + 1],
            data[i * 3 + 2] - before[i * 3 + 2],
          ) / 0.3,
        ),
      );
    mouthRims.push(Array.from(data.subarray(N * 3)));
    g.morphAttributes.position[pose] = new THREE.Float32BufferAttribute(
      data.subarray(0, N * 3),
      3,
    );
    g.morphAttributes.normal[pose] = new THREE.Float32BufferAttribute(
      normals.subarray(0, N * 3),
      3,
    );
    reports.push({
      pose: surprise ? "surprised" : "neutral",
      steps,
      controls: K,
      method: "integrated compact C4 velocity field with transported normals",
    });
  }
  g.setAttribute("perioralWeight", new THREE.BufferAttribute(influence, 1));
  g.userData.perioralFlow = reports;
  g.userData.mouthRims = mouthRims;
  g.userData.sharedSkinTopology = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
