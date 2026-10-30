import { refineLipSampling } from "./lip-surface-sampling.js";
import * as THREE from "../../character-3d/vendor/three.module.js";
import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
const smooth = THREE.MathUtils.smootherstep,
  clamp = THREE.MathUtils.clamp;
export const LIP_KNOTS = [0, 0.1, 0.25, 1];
export function lipWeights(neutral, surprise) {
  const sum = neutral + surprise,
    out = LIP_KNOTS.map(() => 0);
  if (sum < 1e-8) return out;
  const t = surprise / sum;
  let k = 0;
  while (k < LIP_KNOTS.length - 2 && t > LIP_KNOTS[k + 1]) k++;
  const u = smooth(t, LIP_KNOTS[k], LIP_KNOTS[k + 1]);
  out[k] = sum * (1 - u);
  out[k + 1] = sum * u;
  return out;
}
function poseArrays(g, t) {
  const p = g.attributes.position.array,
    n = g.attributes.normal.array,
    a = g.morphAttributes.position.map((v) => v.array),
    b = g.morphAttributes.normal.map((v) => v.array),
    q = 4 * t * (1 - t);
  return {
    p: Float32Array.from(
      p,
      (v, i) =>
        v + (1 - t) * (a[0][i] - v) + t * (a[1][i] - v) + q * (a[2][i] - v),
    ),
    n: Float32Array.from(
      n,
      (v, i) =>
        v + (1 - t) * (b[0][i] - v) + t * (b[1][i] - v) + q * (b[2][i] - v),
    ),
  };
}
function edgeAt(rims, t, x, upper) {
  const source = rims[0],
    q = 4 * t * (1 - t),
    ids = upper
      ? Array.from({ length: 13 }, (_, i) => 12 - i)
      : [...Array.from({ length: 12 }, (_, i) => 12 + i), 0];
  let j = 0;
  while (j < ids.length - 2 && x > source[ids[j + 1] * 3]) j++;
  const a = ids[j] * 3,
    b = ids[j + 1] * 3,
    prev = ids[Math.max(0, j - 1)] * 3,
    next = ids[Math.min(ids.length - 1, j + 2)] * 3,
    width = Math.max(1e-6, source[b] - source[a]),
    u = clamp((x - source[a]) / width, 0, 1),
    src = [],
    dst = [];
  const cubic = (values, k) => {
    const v0 = values(a + k),
      v1 = values(b + k),
      m0 =
        (values(b + k) - values(prev + k)) /
        Math.max(1e-6, source[b] - source[prev]),
      m1 =
        (values(next + k) - values(a + k)) /
        Math.max(1e-6, source[next] - source[a]);
    return (
      (2 * u * u * u - 3 * u * u + 1) * v0 +
      (u * u * u - 2 * u * u + u) * width * m0 +
      (-2 * u * u * u + 3 * u * u) * v1 +
      (u * u * u - u * u) * width * m1
    );
  };
  for (let k = 0; k < 3; k++) {
    src[k] = cubic((i) => source[i], k);
    dst[k] = cubic(
      (i) =>
        (1 - t) * rims[1][i] +
        t * rims[2][i] +
        q * (rims[3][i] - 0.5 * (rims[1][i] + rims[2][i])),
      k,
    );
  }
  return { src, dst };
}

// The field acts on the whole local tissue volume, including the mucosal depth.
// Integrating a smooth spatial velocity prevents neighboring layers crossing as
// they did with a pointwise projection onto a desired front surface.
export function addLipVolumeCorrectives(g) {
  refineLipSampling(g);
  const base = g.attributes.position.array,
    baseN = g.attributes.normal.array,
    rims = g.userData.mouthRims,
    sourceRadius = Math.max(...rims[0].filter((_, i) => i % 3 === 0)),
    positions = [],
    normals = [],
    reports = [];
  for (const t of LIP_KNOTS) {
    const posed = poseArrays(g, t),
      out = Float64Array.from(posed.p),
      table = [];
    for (let j = 0; j <= 160; j++) {
      const x = -0.8 + j * 0.01,
        row = [];
      for (const upper of [true, false]) {
        let lo = -sourceRadius,
          hi = sourceRadius;
        for (let k = 0; k < 18; k++) {
          const m = (lo + hi) / 2;
          if (edgeAt(rims, t, m, upper).dst[0] < x) lo = m;
          else hi = m;
        }
        const e = edgeAt(rims, t, (lo + hi) / 2, upper).dst;
        row.push(e[1], e[2]);
      }
      table.push(row);
    }
    const right = edgeAt(rims, t, sourceRadius, true).dst,
      left = edgeAt(rims, t, -sourceRadius, true).dst,
      radius = Math.max(Math.abs(right[0]), Math.abs(left[0])),
      interpolate = (x) => {
        const u = clamp((x + 0.8) / 0.01, 0, 160),
          i = Math.min(159, Math.floor(u)),
          f = u - i,
          values = [];
        for (let k = 0; k < 4; k++) {
          const a = table[Math.max(0, i - 1)][k],
            b = table[i][k],
            c = table[i + 1][k],
            d = table[Math.min(160, i + 2)][k];
          values[k] =
            b +
            0.5 *
              f *
              (c -
                a +
                f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
        }
        return values;
      },
      velocity = (x, y, z) => {
        const envelope =
          (1 - smooth(Math.abs(x), 0.69, 0.81)) *
          smooth(y, -0.86, -0.77) *
          (1 - smooth(y, -0.25, -0.19)) *
          smooth(z, 0.2, 0.34) *
          (1 - smooth(z, 0.75, 0.86));
        if (!envelope) return [0, 0, 0];
        const e = interpolate(x),
          up = e[0],
          uz = e[1],
          low = e[2],
          lz = e[3],
          support = 1 - smooth(Math.abs(x), radius * 0.65, radius + 0.12),
          twin = Math.exp(-1 * ((Math.abs(x) - 0.085) / 0.075) ** 2),
          upper =
            Math.exp(-1 * ((y - up - 0.033 - 0.008 * twin) / 0.038) ** 2) *
            Math.exp(-1 * ((z - uz - 0.025) / 0.14) ** 2) *
            support,
          lower =
            Math.exp(-1 * ((y - low + 0.035) / 0.038) ** 2) *
            Math.exp(-1 * ((z - lz - 0.025) / 0.14) ** 2) *
            support,
          phi =
            Math.exp(-1 * (x / 0.06) ** 2) *
            Math.exp(-1 * ((y + 0.3) / 0.085) ** 2) *
            Math.exp(-1 * ((z - 0.52) / 0.15) ** 2),
          corner = [left, right].reduce(
            (v, c) =>
              v +
              Math.exp(
                -1 * ((x - c[0]) / 0.075) ** 2 -
                  ((y - c[1]) / 0.07) ** 2 -
                  ((z - c[2]) / 0.14) ** 2,
              ),
            0,
          ),
          seal =
            0.5 *
            (1 - smooth(t, 0, 0.1)) *
            (y - 0.5 * (up + low)) *
            Math.exp(-1 * ((y - 0.5 * (up + low)) / 0.035) ** 2) *
            Math.exp(-1 * ((z - 0.5 * (uz + lz)) / 0.14) ** 2) *
            support,
          narrow =
            0.16 *
            (1 - smooth(t, 0, 0.5)) *
            x *
            Math.min(1, upper + lower + 0.4 * corner);
        return [
          -envelope * narrow,
          -envelope * seal,
          envelope *
            ((0.115 + 0.03 * twin) * upper +
              (0.085 - 0.025 * smooth(t, 0.25, 1)) * lower +
              0.08 * phi +
              0.018 * corner),
        ];
      };
    const steps = 64,
      dt = 1 / steps;
    for (let step = 0; step < steps; step++)
      for (let i = 0; i < out.length; i += 3) {
        const x = out[i],
          y = out[i + 1],
          z = out[i + 2];
        if (y < -0.86 || y > -0.19 || Math.abs(x) > 0.81 || z < 0.2 || z > 0.86)
          continue;
        const v = velocity(x, y, z);
        if (!v.some(Boolean)) continue;
        const m = velocity(
          x + 0.5 * dt * v[0],
          y + 0.5 * dt * v[1],
          z + 0.5 * dt * v[2],
        );
        out[i] += dt * m[0];
        out[i + 1] += dt * m[1];
        out[i + 2] += dt * m[2];
      }
    const target = Float32Array.from(out),
      temp = new THREE.BufferGeometry();
    temp.setIndex(g.index.clone());
    temp.setAttribute("position", new THREE.BufferAttribute(target, 3));
    temp.setAttribute("normal", new THREE.BufferAttribute(posed.n.slice(), 3));
    fairSurface(temp, {
      pairs: 14,
      limit: 0.008,
      weight: (x, y, z) =>
        (1 - smooth(Math.abs(x), 0.64, 0.8)) *
        smooth(y, -0.86, -0.77) *
        (1 - smooth(y, -0.25, -0.19)) *
        smooth(z, 0.2, 0.34),
      preserveFieldNormals: false,
      normalPasses: 3,
    });
    target.set(temp.attributes.position.array);
    const p = new Float32Array(base.length),
      n = new Float32Array(base.length),
      nn = temp.attributes.normal.array;
    let max = 0;
    for (let i = 0; i < base.length; i += 3) {
      const distance = Math.hypot(
          ...[0, 1, 2].map((k) => target[i + k] - posed.p[i + k]),
        ),
        w = smooth(distance, 0.0001, 0.004);
      max = Math.max(max, distance);
      for (let k = 0; k < 3; k++) {
        p[i + k] = base[i + k] + target[i + k] - posed.p[i + k];
        n[i + k] = baseN[i + k] + w * (nn[i + k] - posed.n[i + k]);
      }
    }
    positions.push(new THREE.BufferAttribute(p, 3));
    normals.push(new THREE.BufferAttribute(n, 3));
    reports.push({ opening: t, maxDisplacement: max, steps });
    temp.dispose();
  }
  g.morphAttributes.position.push(...positions);
  g.morphAttributes.normal.push(...normals);
  g.userData.lipVolume = {
    knots: LIP_KNOTS,
    reports,
    method: "integrated 3D labial volume flow",
  };
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
