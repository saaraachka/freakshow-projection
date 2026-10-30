import * as THREE from "../../character-3d/vendor/three.module.js";
import {
  eyeLandmark,
  facialSolidField,
  sampleColumn,
} from "./implicit-skin.js?sculpt=9";
import { cranialPoint } from "./cranial-refinement.js?sculpt=9";
import { solve } from "./continuous-perioral-field.js?repair=1";
const smooth = THREE.MathUtils.smootherstep;
function front(x, y) {
  const c = sampleColumn(x, y);
  let a = -0.1,
    b = 0.9;
  for (let i = 0; i < 22; i++) {
    const m = (a + b) / 2;
    if (facialSolidField(x, y, m, c) > 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}
export function applyOrbitalFlow(g) {
  const source = g.attributes.position,
    N = source.count;
  const eyes = [eyeLandmark(-1), eyeLandmark(1)],
    radius = 0.56,
    inv = 1 / (radius * radius),
    steps = 64;
  const starts = [],
    roles = [];
  for (const side of [-1, 1])
    for (const a of [0.18, 0.26, 0.34, 0.42, 0.5, 0.6]) {
      const x = side * a,
        y = 0.445 + 0.52 * (a - 0.35),
        q = cranialPoint(x, y, front(x, y));
      starts.push(q.toArray());
      roles.push({ a });
    }
  for (const x of [-0.65, -0.3, 0, 0.3, 0.65]) {
    starts.push([x, 0.96, 0.35]);
    roles.push(null);
  }
  for (const q of [
    [0, 0.1, 0.56],
    [0.16, 0.18, 0.48],
    [-0.16, 0.18, 0.48],
    [0.79, 0.35, 0.08],
    [-0.79, 0.35, 0.08],
    [0, 0.75, -0.2],
    [0.4, 0.3, 0.02],
    [-0.4, 0.3, 0.02],
  ]) {
    starts.push(q);
    roles.push(null);
  }
  const K = starts.length,
    center = new Float64Array(K * 3),
    matrix = new Float64Array(K * K),
    reports = [];
  for (let pose = 0; pose < 2; pose++) {
    const surprise = pose === 1,
      delta = new Float64Array(K * 3);
    for (let j = 0; j < K; j++)
      if (roles[j]) {
        const a = roles[j].a,
          by = surprise
            ? 0.64 + 0.07 * Math.exp(-1 * ((a - 0.37) / 0.24) ** 2)
            : 0.47 + 0.05 * (a - 0.35);
        delta[j * 3 + 1] = by - starts[j][1];
      }
    const data = new Float64Array(g.morphAttributes.position[pose].array),
      normals = new Float64Array(g.morphAttributes.normal[pose].array);
    for (let step = 0; step < steps; step++) {
      const t = (step + 0.5) / steps;
      for (let j = 0; j < K; j++)
        for (let k = 0; k < 3; k++)
          center[j * 3 + k] = starts[j][k] + t * delta[j * 3 + k];
      for (let i = 0; i < K; i++)
        for (let j = 0; j < K; j++) {
          const r = Math.sqrt(
              ((center[i * 3] - center[j * 3]) ** 2 +
                (center[i * 3 + 1] - center[j * 3 + 1]) ** 2 +
                (center[i * 3 + 2] - center[j * 3 + 2]) ** 2) *
                inv,
            ),
            u = Math.max(0, 1 - r);
          matrix[i * K + j] =
            (u ** 6 * (35 * r * r + 18 * r + 3)) / 3 + (i === j ? 0.0002 : 0);
        }
      const coefficients = solve(matrix, delta, K),
        dt = 1 / steps;
      const velocity = (x, y, z) => {
        if (y < 0.08 || y > 1.0 || z < 0 || Math.abs(x) > 0.87)
          return [0, 0, 0];
        const mask =
          smooth(y, 0.08, 0.18) *
          (1 - smooth(y, 0.83, 1.0)) *
          smooth(z, 0, 0.22) *
          (1 - smooth(Math.abs(x), 0.72, 0.87));
        if (!mask) return [0, 0, 0];
        let vx = 0,
          vy = 0,
          vz = 0;
        for (let j = 0; j < K; j++) {
          const dx = x - center[j * 3],
            dy = y - center[j * 3 + 1],
            dz = z - center[j * 3 + 2],
            r = Math.sqrt((dx * dx + dy * dy + dz * dz) * inv);
          if (r >= 1) continue;
          const u = 1 - r,
            w = (u ** 6 * (35 * r * r + 18 * r + 3)) / 3;
          vx += w * coefficients[j * 3];
          vy += w * coefficients[j * 3 + 1];
          vz += w * coefficients[j * 3 + 2];
        }
        const e = eyes[x < 0 ? 0 : 1],
          dx = x - e.x,
          dy = y - e.y,
          dz = z - e.z,
          r = Math.hypot(dx, dy, dz),
          nx = dx / r,
          ny = dy / r,
          nz = dz / r;
        // Brows do not drag the seated chamber. Lids wrap tangentially around
        // their globe; inward radial brow velocity fades to zero near the socket.
        const brow = smooth(r, 0.245, 0.31);
        vx *= brow;
        vy *= brow;
        vz *= brow;
        const radial = vx * nx + vy * ny + vz * nz;
        const inward =
          (radial - Math.sqrt(radial * radial + 1e-8)) *
          0.5 *
          (1 - smooth(r, 0.27, 0.35));
        vx -= nx * inward;
        vy -= ny * inward;
        vz -= nz * inward;
        const angular =
          -(surprise ? 0.21 : 0.022) *
          Math.tanh(dy / 0.025) *
          Math.exp(-1 * (dx / 0.22) ** 4) *
          smooth(dz, 0.025, 0.13) *
          (1 - smooth(r, 0.27, 0.35));
        vy -= dz * angular;
        vz += dy * angular;
        const clearance =
          (surprise ? 0.004 : 0.0006) * (1 - smooth(r, 0.245, 0.3));
        vx += nx * clearance;
        vy += ny * clearance;
        vz += nz * clearance;
        return [mask * vx, mask * vy, mask * vz];
      };
      for (let i = 0; i < N; i++) {
        const x = data[i * 3],
          y = data[i * 3 + 1],
          z = data[i * 3 + 2];
        if (y < 0.08 || y > 1 || z < 0 || Math.abs(x) > 0.87) continue;
        const v = velocity(x, y, z),
          mx = x + (dt * v[0]) / 2,
          my = y + (dt * v[1]) / 2,
          mz = z + (dt * v[2]) / 2,
          mid = velocity(mx, my, mz),
          eps = 0.0001;
        const dx = velocity(mx + eps, my, mz),
          dy = velocity(mx, my + eps, mz),
          dz = velocity(mx, my, mz + eps);
        const transpose = (n) => [
          ((dx[0] - mid[0]) * n[0] +
            (dx[1] - mid[1]) * n[1] +
            (dx[2] - mid[2]) * n[2]) /
            eps,
          ((dy[0] - mid[0]) * n[0] +
            (dy[1] - mid[1]) * n[1] +
            (dy[2] - mid[2]) * n[2]) /
            eps,
          ((dz[0] - mid[0]) * n[0] +
            (dz[1] - mid[1]) * n[1] +
            (dz[2] - mid[2]) * n[2]) /
            eps,
        ];
        const n = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]],
          j = transpose(n),
          jn = transpose(n.map((v, k) => v - (dt * j[k]) / 2)),
          nn = n.map((v, k) => v - dt * jn[k]),
          length = Math.hypot(...nn) || 1;
        for (let k = 0; k < 3; k++) normals[i * 3 + k] = nn[k] / length;
        data[i * 3] += dt * mid[0];
        data[i * 3 + 1] += dt * mid[1];
        data[i * 3 + 2] += dt * mid[2];
      }
    }
    // Clearance is integrated into the velocity itself. No discontinuous
    // endpoint projection or per-vertex radius cutoff is applied.
    const boosted = 0,
      maxBoost = 0;
    // Filter magnified sub-cell normal noise on moving orbital skin only.
    // The bilateral angular weight retains the brow ridge and lid creases.
    const links = Array.from({ length: N }, () => new Set()),
      ix = g.index.array;
    for (let t = 0; t < ix.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = ix[t + k],
          b = ix[t + ((k + 1) % 3)];
        links[a].add(b);
        links[b].add(a);
      }
    let filtered = new Float32Array(normals);
    for (let pass = 0; pass < 6; pass++) {
      const next = filtered.slice();
      for (let i = 0; i < N; i++) {
        const motion = Math.hypot(
          data[i * 3] - source.getX(i),
          data[i * 3 + 1] - source.getY(i),
          data[i * 3 + 2] - source.getZ(i),
        );
        const mix =
          0.45 *
          smooth(motion, 0.002, 0.02) *
          smooth(source.getY(i), 0.2, 0.32) *
          (1 - smooth(source.getY(i), 0.75, 0.87)) *
          smooth(source.getZ(i), 0.15, 0.3);
        if (!mix) continue;
        const nx = filtered[i * 3],
          ny = filtered[i * 3 + 1],
          nz = filtered[i * 3 + 2];
        let x = 0,
          y = 0,
          z = 0,
          total = 0;
        for (const j of links[i]) {
          const d =
              (data[i * 3] - data[j * 3]) ** 2 +
              (data[i * 3 + 1] - data[j * 3 + 1]) ** 2 +
              (data[i * 3 + 2] - data[j * 3 + 2]) ** 2,
            dot =
              nx * filtered[j * 3] +
              ny * filtered[j * 3 + 1] +
              nz * filtered[j * 3 + 2],
            w = Math.exp(-d / 0.0016 - ((1 - dot) / 0.3) ** 2);
          x += w * filtered[j * 3];
          y += w * filtered[j * 3 + 1];
          z += w * filtered[j * 3 + 2];
          total += w;
        }
        if (total) {
          x = nx * (1 - mix) + (mix * x) / total;
          y = ny * (1 - mix) + (mix * y) / total;
          z = nz * (1 - mix) + (mix * z) / total;
          const l = Math.hypot(x, y, z) || 1;
          next[i * 3] = x / l;
          next[i * 3 + 1] = y / l;
          next[i * 3 + 2] = z / l;
        }
      }
      filtered = next;
    }
    g.morphAttributes.position[pose] = new THREE.Float32BufferAttribute(
      data,
      3,
    );
    g.morphAttributes.normal[pose] = new THREE.Float32BufferAttribute(
      filtered,
      3,
    );
    reports.push({
      pose: surprise ? "surprised" : "neutral",
      boosted,
      maxBoost,
      steps,
      method: "compact C4 orbital RK2 flow with transported normals",
    });
  }
  g.userData.orbitalFlow = reports;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
