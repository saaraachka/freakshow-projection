import * as THREE from "../character-3d/vendor/three.module.js";
import { volumeMesh } from "./volume-mesh.js?sculpt=4";
import { ellipsoid } from "./implicit-skin.js?sculpt=4";
const smooth = THREE.MathUtils.smoothstep;
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
const V = (a) => new THREE.Vector3(...a);
// Named masses establish an asymmetric full-crown silhouette. The field is a
// solid groom, not a smooth scalp shell populated with loose repeated rings.
const masses = [
  [-0.36, 1.07, 0.08, 0.44, 0.23, 0.45],
  [0.36, 1.15, -0.12, 0.44, 0.22, 0.44],
  [-0.12, 0.87, 0.3, 0.61, 0.16, 0.29],
  [-0.83, 0.5, -0.2, 0.27, 0.4, 0.39],
  [0.84, 0.53, -0.29, 0.28, 0.4, 0.39],
  [0.02, 0.36, -1.23, 0.64, 0.66, 0.23],
  [-0.06, -0.34, -1.12, 0.56, 0.3, 0.25],
];
const guides = [
  {
    name: "forelock-left",
    r: 0.115,
    p: [
      [-0.42, 0.82, 0.42],
      [-0.65, 1.12, 0.68],
      [-0.39, 1.48, 0.72],
      [0.02, 1.52, 0.65],
      [0.24, 1.29, 0.67],
      [0.06, 1.13, 0.73],
      [-0.07, 1.27, 0.76],
    ],
  },
  {
    name: "crest-right",
    r: 0.13,
    p: [
      [0.3, 0.85, 0.42],
      [0.64, 1.14, 0.57],
      [0.55, 1.57, 0.46],
      [0.13, 1.68, 0.26],
      [-0.13, 1.49, 0.19],
      [0.04, 1.34, 0.34],
      [0.26, 1.45, 0.44],
    ],
  },
  {
    name: "left-temple",
    r: 0.103,
    p: [
      [-0.74, 0.63, 0.12],
      [-1.03, 0.9, 0.32],
      [-1.12, 1.16, 0.31],
      [-0.88, 1.35, 0.33],
      [-0.66, 1.15, 0.45],
      [-0.84, 0.98, 0.5],
    ],
  },
  {
    name: "right-temple",
    r: 0.1,
    p: [
      [0.78, 0.66, 0.02],
      [1.08, 0.98, 0.2],
      [1.24, 1.1, 0.09],
      [1.32, 0.87, -0.05],
      [1.16, 0.72, -0.08],
      [1.05, 0.86, 0.06],
    ],
  },
  {
    name: "crown-left",
    r: 0.12,
    p: [
      [-0.39, 1.02, -0.3],
      [-0.69, 1.41, -0.25],
      [-0.49, 1.62, -0.46],
      [-0.15, 1.55, -0.61],
      [-0.16, 1.33, -0.47],
      [-0.34, 1.36, -0.29],
    ],
  },
  {
    name: "crown-back",
    r: 0.13,
    p: [
      [0.26, 0.96, -0.72],
      [0.64, 1.32, -0.63],
      [0.5, 1.56, -0.94],
      [0.12, 1.4, -1.16],
      [0.08, 1.14, -1.03],
      [0.31, 1.19, -0.91],
    ],
  },
  {
    name: "occiput-upper",
    r: 0.113,
    p: [
      [0.12, 0.86, -1.03],
      [0.43, 1.13, -1.29],
      [0.24, 1.23, -1.54],
      [-0.12, 0.96, -1.62],
      [0.02, 0.7, -1.52],
      [0.25, 0.86, -1.38],
    ],
  },
  {
    name: "back-left",
    r: 0.12,
    p: [
      [-0.62, 0.8, -0.77],
      [-0.98, 0.78, -1.09],
      [-1.1, 0.37, -1.12],
      [-0.86, 0.16, -1.39],
      [-0.63, 0.37, -1.44],
      [-0.84, 0.58, -1.38],
    ],
  },
  {
    name: "back-right",
    r: 0.116,
    p: [
      [0.64, 0.77, -0.82],
      [1.02, 0.61, -1.12],
      [1.09, 0.22, -1.17],
      [0.8, 0.03, -1.41],
      [0.61, 0.25, -1.44],
      [0.83, 0.38, -1.34],
    ],
  },
  {
    name: "back-center",
    r: 0.12,
    p: [
      [-0.19, 0.44, -1.16],
      [-0.46, 0.49, -1.5],
      [-0.42, 0.1, -1.68],
      [-0.05, -0.05, -1.63],
      [0.14, 0.17, -1.52],
      [-0.04, 0.27, -1.46],
    ],
  },
  {
    name: "nape-left",
    r: 0.106,
    p: [
      [-0.45, -0.13, -1.03],
      [-0.74, -0.3, -1.31],
      [-0.67, -0.66, -1.32],
      [-0.35, -0.79, -1.23],
      [-0.2, -0.59, -1.24],
      [-0.38, -0.49, -1.38],
    ],
  },
  {
    name: "nape-right",
    r: 0.105,
    p: [
      [0.47, -0.14, -1.02],
      [0.77, -0.28, -1.24],
      [0.72, -0.58, -1.39],
      [0.4, -0.72, -1.4],
      [0.24, -0.51, -1.36],
      [0.41, -0.39, -1.29],
    ],
  },
  {
    name: "sideburn-left",
    r: 0.103,
    p: [
      [-0.81, 0.19, -0.47],
      [-1.07, -0.12, -0.52],
      [-1.12, -0.53, -0.49],
      [-0.94, -0.78, -0.34],
      [-0.76, -0.62, -0.32],
      [-0.91, -0.42, -0.37],
    ],
  },
  {
    name: "sideburn-right",
    r: 0.11,
    p: [
      [0.82, 0.18, -0.49],
      [1.12, -0.13, -0.58],
      [1.2, -0.57, -0.56],
      [1.02, -0.87, -0.41],
      [0.82, -0.73, -0.32],
      [0.97, -0.56, -0.39],
    ],
  },
  {
    name: "front-right-sweep",
    r: 0.096,
    p: [
      [0.57, 0.8, 0.35],
      [0.86, 1.14, 0.46],
      [0.84, 1.43, 0.29],
      [0.62, 1.52, 0.11],
      [0.48, 1.32, 0.2],
      [0.65, 1.23, 0.39],
    ],
  },
  {
    name: "part-left",
    r: 0.092,
    p: [
      [-0.62, 0.85, 0.24],
      [-0.53, 1.29, 0.04],
      [-0.15, 1.43, -0.28],
      [0.12, 1.35, -0.56],
      [-0.03, 1.2, -0.64],
      [-0.25, 1.31, -0.5],
    ],
  },
  {
    name: "part-right",
    r: 0.1,
    p: [
      [0.63, 0.82, 0.16],
      [0.57, 1.32, -0.08],
      [0.34, 1.46, -0.44],
      [0.1, 1.34, -0.7],
      [0.25, 1.21, -0.83],
      [0.44, 1.32, -0.68],
    ],
  },
  {
    name: "fringe-center",
    r: 0.075,
    p: [
      [0.05, 0.71, 0.5],
      [-0.15, 0.92, 0.72],
      [0.05, 1.1, 0.75],
      [0.27, 0.98, 0.67],
      [0.2, 0.81, 0.69],
      [0.04, 0.86, 0.73],
    ],
  },
  {
    name: "fringe-left",
    r: 0.08,
    p: [
      [-0.55, 0.68, 0.32],
      [-0.73, 0.83, 0.52],
      [-0.55, 1.02, 0.66],
      [-0.32, 0.9, 0.7],
      [-0.41, 0.74, 0.66],
    ],
  },
  {
    name: "fringe-right",
    r: 0.081,
    p: [
      [0.5, 0.7, 0.36],
      [0.73, 0.86, 0.49],
      [0.66, 1.1, 0.55],
      [0.44, 1.03, 0.64],
      [0.48, 0.82, 0.7],
    ],
  },
  {
    name: "middle-fall",
    r: 0.095,
    p: [
      [0, 0.65, -1.13],
      [-0.22, 0.78, -1.48],
      [-0.42, 0.48, -1.55],
      [-0.17, 0.18, -1.62],
      [0.06, 0.28, -1.59],
      [0.12, 0.48, -1.5],
    ],
  },
  {
    name: "crown-link",
    r: 0.083,
    p: [
      [-0.4, 0.95, -0.7],
      [-0.23, 1.31, -0.89],
      [0.08, 1.44, -0.81],
      [0.25, 1.27, -0.59],
      [0.08, 1.15, -0.58],
    ],
  },
  {
    name: "rear-link",
    r: 0.09,
    p: [
      [0.42, 0.22, -1.15],
      [0.6, 0.46, -1.42],
      [0.37, 0.66, -1.52],
      [0.15, 0.51, -1.56],
      [0.28, 0.29, -1.53],
    ],
  },
];
export function scalpHairField(x, y, z) {
  let d = ellipsoid(x, y, z, 0, 0.24, -0.38, 1.01, 1.08, 1.08);
  for (const m of masses) d = smin(d, ellipsoid(x, y, z, ...m), 0.13);
  // Broad, rounded clump relief flows around the scalp beneath the locks.
  // It changes the mass silhouette; it is not a normal map or added surface noise.
  const theta = Math.atan2(x / 0.91, z + 0.38),
    phi = Math.atan2(Math.hypot(x / 0.91, z + 0.38), (y - 0.24) / 1.05);
  const flow = theta * 11 + 2.3 * Math.sin(phi * 3 + theta);
  const lobes = 0.5 + 0.5 * Math.sin(flow + 1.8 * Math.sin(phi * 7));
  d -=
    0.055 * lobes * (0.65 + 0.35 * Math.cos(phi * 10 + Math.sin(theta * 3))) +
    0.022 * Math.sin(phi * 13 + theta * 2) ** 2;
  const front = smooth(z, -0.8, 0.42);
  const hairline =
    -0.6 +
    1.32 * front -
    0.055 * Math.exp(-1 * (x / 0.19) ** 2) * front +
    0.021 * x;
  return smax(d, hairline - y, 0.045);
}
// A small number of genuine, rounded flyaways. Roots are placed inside the
// large masses, and their paths remain above the face or behind the auricles.
function flyawayGeometry() {
  const positions = [],
    indices = [];
  const paths = [
    [
      [-0.46, 1.12, 0.37],
      [-0.72, 1.48, 0.57],
      [-0.5, 1.73, 0.55],
      [-0.24, 1.65, 0.65],
    ],
    [
      [0.34, 1.18, 0.1],
      [0.51, 1.65, 0.21],
      [0.24, 1.86, 0.15],
      [0.07, 1.69, 0.3],
    ],
    [
      [-0.78, 0.71, -0.32],
      [-1.26, 0.99, -0.28],
      [-1.36, 0.77, -0.3],
      [-1.23, 0.66, -0.33],
    ],
    [
      [0.79, 0.74, -0.38],
      [1.3, 1.02, -0.23],
      [1.42, 0.75, -0.3],
      [1.25, 0.61, -0.31],
    ],
    [
      [0.06, 0.67, -1.22],
      [0.31, 0.94, -1.67],
      [0.02, 0.77, -1.85],
      [-0.13, 0.64, -1.69],
    ],
    [
      [-0.56, 0.18, -1.04],
      [-1.02, 0.02, -1.5],
      [-0.85, -0.3, -1.65],
      [-0.65, -0.18, -1.56],
    ],
    [
      [0.61, 0.12, -1.05],
      [1.04, -0.19, -1.42],
      [0.9, -0.49, -1.57],
      [0.76, -0.37, -1.46],
    ],
    [
      [-0.81, -0.12, -0.68],
      [-1.21, -0.4, -0.65],
      [-1.22, -0.85, -0.54],
      [-0.99, -0.94, -0.43],
    ],
  ];
  for (let n = 0; n < paths.length; n++) {
    const curve = new THREE.CatmullRomCurve3(paths[n].map(V)),
      steps = 36,
      sides = 7,
      frames = curve.computeFrenetFrames(steps, false),
      base = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        p = curve.getPointAt(t),
        r = (0.014 + (n % 3) * 0.002) * (1 - 0.83 * t * t);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2,
          q = p
            .clone()
            .addScaledVector(frames.normals[i], Math.cos(a) * r)
            .addScaledVector(frames.binormals[i], Math.sin(a) * r);
        positions.push(...q.toArray());
        if (i < steps && j < sides) {
          const k = base + i * (sides + 1) + j;
          indices.push(
            k,
            k + 1,
            k + sides + 1,
            k + 1,
            k + sides + 2,
            k + sides + 1,
          );
        }
      }
    }
    for (let j = 1; j < sides - 1; j++) {
      indices.push(base, base + j + 1, base + j);
      const end = base + steps * (sides + 1);
      indices.push(end, end + j, end + j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return { geometry: g, paths };
}
// Rounded lock surfaces use continuous parallel-transport frames. Unlike a
// sampled union of tiny segments, the curl's cross section stays round even in
// tight bends. Secondary locks belong to the same authored sweep family.
function lockGeometry(points, r, phase) {
  let centers = points.map(V);
  for (let pass = 0; pass < 4; pass++)
    centers = centers.map((p, i) =>
      i === 0 || i === centers.length - 1
        ? p
        : p
            .clone()
            .multiplyScalar(0.5)
            .addScaledVector(centers[i - 1], 0.25)
            .addScaledVector(centers[i + 1], 0.25),
    );
  const curve = new THREE.CatmullRomCurve3(centers),
    steps = 46,
    sides = 12,
    frames = curve.computeFrenetFrames(steps, false),
    positions = [],
    indices = [];
  const sampled = [];
  const caps = [];
  for (let i = 0; i <= steps; i++) {
    const first = Math.max(0, i - 1),
      last = Math.min(steps, i + 1),
      angle = Math.acos(
        THREE.MathUtils.clamp(
          frames.tangents[first].dot(frames.tangents[last]),
          -1,
          1,
        ),
      );
    caps.push(
      ((curve.getLength() * (last - first)) / steps / Math.max(0.001, angle)) *
        0.65,
    );
  }
  const fairCaps = caps.map((_, i) =>
    Math.min(...caps.slice(Math.max(0, i - 2), Math.min(steps + 1, i + 3))),
  );
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      p = curve.getPointAt(t),
      baseRadius =
        r *
        (0.89 + 0.11 * Math.sin(t * 4 + phase)) *
        (1 - 0.45 * smooth(t, 0.5, 0.87)) *
        Math.sqrt(Math.max(0.0005, 1 - smooth(t, 0.9, 1) ** 2)) *
        (0.01 + 0.99 * smooth(t, 0, 0.15));
    const radius = Math.min(baseRadius, fairCaps[i]);
    sampled.push({ p: p.toArray(), r: radius });
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        rr = radius * (1 + 0.1 * Math.cos(a * 3 + t * 3 + phase));
      const q = p
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(a) * rr)
        .addScaledVector(frames.binormals[i], Math.sin(a) * rr);
      positions.push(...q.toArray());
      if (i < steps && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(
          k,
          k + 1,
          k + sides + 1,
          k + 1,
          k + sides + 2,
          k + sides + 1,
        );
      }
    }
  }
  for (let j = 1; j < sides - 1; j++) {
    indices.push(0, j + 1, j);
    const e = steps * (sides + 1);
    indices.push(e, e + j, e + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Weld radial seam normals (same surface, duplicated UV-less endpoint).
  const n = g.attributes.normal;
  for (let i = 0; i <= steps; i++) {
    const a = i * (sides + 1),
      b = a + sides,
      v = new THREE.Vector3()
        .fromBufferAttribute(n, a)
        .add(new THREE.Vector3().fromBufferAttribute(n, b))
        .normalize();
    n.setXYZ(a, ...v.toArray());
    n.setXYZ(b, ...v.toArray());
  }
  g.userData.samples = sampled;
  return g;
}
export function createHairGeometry() {
  const records = [];
  const parts = [null];
  for (let i = 0; i < guides.length; i++) {
    const g = guides[i],
      curve = new THREE.CatmullRomCurve3(g.p.map(V)),
      frames = curve.computeFrenetFrames(40, false);
    // One primary lock and two shorter, differently sized companions make each
    // clump. They share a root direction without becoming identical spirals.
    for (let j = 0; j < 3; j++) {
      const points = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40,
          end = j === 0 ? 1 : j === 1 ? 0.91 : 0.78,
          s = t * end,
          index = Math.round(s * 40),
          p = curve.getPointAt(s);
        for (let pass = 0; pass < 5; pass++) {
          const d = scalpHairField(p.x, p.y, p.z);
          if (d < 0.07) break;
          const e = 0.004,
            n = new THREE.Vector3(
              scalpHairField(p.x + e, p.y, p.z) -
                scalpHairField(p.x - e, p.y, p.z),
              scalpHairField(p.x, p.y + e, p.z) -
                scalpHairField(p.x, p.y - e, p.z),
              scalpHairField(p.x, p.y, p.z + e) -
                scalpHairField(p.x, p.y, p.z - e),
            ).normalize();
          p.addScaledVector(n, -0.6 * (d - 0.07));
        }
        if (t < 0.15) {
          const q = p.clone();
          for (let n = 0; n < 7; n++) {
            const d = scalpHairField(q.x, q.y, q.z);
            if (d < -0.07) break;
            const eps = 0.004,
              normal = new THREE.Vector3(
                scalpHairField(q.x + eps, q.y, q.z) -
                  scalpHairField(q.x - eps, q.y, q.z),
                scalpHairField(q.x, q.y + eps, q.z) -
                  scalpHairField(q.x, q.y - eps, q.z),
                scalpHairField(q.x, q.y, q.z + eps) -
                  scalpHairField(q.x, q.y, q.z - eps),
              ).normalize();
            q.addScaledVector(normal, -Math.min(0.09, d + 0.075));
          }
          p.lerp(q, 1 - smooth(t, 0, 0.15));
        }
        const offset =
          j === 0
            ? 0
            : (j === 1 ? 1 : -1) * g.r * 0.88 * Math.sin(Math.PI * t * 0.88);
        p.addScaledVector(frames.normals[index], offset).addScaledVector(
          frames.binormals[index],
          j === 0 ? 0 : 0.02 * Math.sin(t * 6 + i) * Math.sin(Math.PI * t),
        );
        points.push(p.toArray());
      }
      const radius = g.r * (j === 0 ? 0.73 : j === 1 ? 0.4 : 0.32);
      parts.push(lockGeometry(points, radius, i * 0.7 + j));
      records.push({
        name: g.name + "-" + j,
        kind: j === 0 ? "primary" : "companion",
        radius,
        root: points[0],
        tip: points.at(-1),
      });
    }
  }
  // Authored region bands establish coverage and root flow. Unequal spacing
  // avoids a lattice; crown, temples and occiput have different density and sweep.
  const bands = [
    [0.24, [0.2, 2.0, 4.2]],
    [
      0.52,
      [
        -0.1, 0.25, 0.7, 1.1, 1.6, 2.05, 2.5, 2.95, 3.35, 3.8, 4.25, 4.8, 5.35,
        5.85,
      ],
    ],
    [
      0.83,
      [
        0.1, 0.48, 0.85, 1.25, 1.64, 2.05, 2.48, 2.89, 3.28, 3.73, 4.13, 4.55,
        4.94, 5.36, 5.84,
      ],
    ],
    [
      1.08,
      [
        -0.12, 0.24, 0.61, 1.01, 1.38, 1.77, 2.14, 2.51, 2.91, 3.31, 3.7, 4.11,
        4.52, 4.94, 5.36, 5.77,
      ],
    ],
    [
      1.34,
      [
        0.88, 1.27, 1.64, 2.01, 2.38, 2.75, 3.12, 3.49, 3.88, 4.27, 4.66, 5.02,
        5.36,
      ],
    ],
    [1.64, [1.4, 1.76, 2.1, 2.47, 2.84, 3.2, 3.59, 3.98, 4.39, 4.79]],
    [1.96, [1.7, 2.08, 2.45, 2.82, 3.19, 3.57, 4.03, 4.57]],
    [2.23, [2.01, 2.64, 3.31, 3.98, 4.4]],
  ];
  let clump = 0,
    mediumClumps = 0;
  for (const [phi, angles] of bands)
    for (const theta of angles) {
      const i = clump++,
        center = new THREE.Vector3(
          0.91 * Math.sin(phi) * Math.sin(theta),
          0.24 + 1.05 * Math.cos(phi),
          -0.38 + Math.sin(phi) * Math.cos(theta),
        );
      // Project onto the large asymmetric mass, then grow a rounded twisting lock.
      for (let n = 0; n < 9; n++) {
        const d = scalpHairField(center.x, center.y, center.z),
          e = 0.004,
          normal = new THREE.Vector3(
            scalpHairField(center.x + e, center.y, center.z) -
              scalpHairField(center.x - e, center.y, center.z),
            scalpHairField(center.x, center.y + e, center.z) -
              scalpHairField(center.x, center.y - e, center.z),
            scalpHairField(center.x, center.y, center.z + e) -
              scalpHairField(center.x, center.y, center.z - e),
          ).normalize();
        if (Math.abs(d - 0.055) < 0.004) break;
        center.addScaledVector(
          normal,
          THREE.MathUtils.clamp(0.055 - d, -0.1, 0.1),
        );
      }
      if (
        (center.y < 0.67 && center.z > -0.12) ||
        (Math.abs(center.x) > 0.8 && center.y < 0.48 && center.z > -0.55)
      )
        continue;
      const e = 0.006,
        out = new THREE.Vector3(
          scalpHairField(center.x + e, center.y, center.z) -
            scalpHairField(center.x - e, center.y, center.z),
          scalpHairField(center.x, center.y + e, center.z) -
            scalpHairField(center.x, center.y - e, center.z),
          scalpHairField(center.x, center.y, center.z + e) -
            scalpHairField(center.x, center.y, center.z - e),
        ).normalize();
      const flow = new THREE.Vector3(
          Math.cos(theta) * 0.6,
          -0.4 - Math.sin(phi) * 0.3,
          -Math.sin(theta) * 0.6,
        ),
        tangent = flow.addScaledVector(out, -flow.dot(out)).normalize(),
        cross = new THREE.Vector3().crossVectors(out, tangent).normalize();
      const points = [],
        size = 0.14 + 0.04 * (1 + Math.sin(i * 1.71)),
        turns = 1.25 + 0.37 * (1 + Math.cos(i * 0.9)),
        phase = i * 0.83;
      for (let k = 0; k <= 38; k++) {
        const t = k / 38,
          angle = phase + t * Math.PI * 2 * turns,
          r =
            size *
            (0.62 + 0.38 * Math.sin(Math.PI * t * 0.85)) *
            (1 - 0.35 * t);
        // Curl around a bent flow axis, not a planar ring. Pitch and eccentricity
        // change along its length; neighboring curls overlap in three dimensions.
        const p = center
          .clone()
          .addScaledVector(
            tangent,
            0.43 * (t - 0.5) + 0.045 * Math.sin(angle * 0.6),
          )
          .addScaledVector(
            cross,
            Math.cos(angle) * r * (0.7 + 0.18 * Math.sin(i)),
          )
          .addScaledVector(
            out,
            0.09 + Math.sin(angle) * r * 0.6 + 0.08 * Math.sin(Math.PI * t),
          );
        if (t < 0.12) p.addScaledVector(out, -0.2 * (1 - smooth(t, 0, 0.12)));
        const line =
          -0.6 +
          1.32 * smooth(p.z, -0.8, 0.42) -
          0.055 * Math.exp(-1 * (p.x / 0.19) ** 2) * smooth(p.z, -0.8, 0.42) +
          0.021 * p.x;
        if (p.z > -0.1 && p.y < line - 0.025) p.y = line - 0.025;
        points.push(p.toArray());
      }
      const radius = 0.055 + 0.01 * (1 + Math.sin(i * 1.31));
      parts.push(lockGeometry(points, radius, phase));
      mediumClumps++;
      records.push({
        name: "region-curl-" + i,
        kind: "medium",
        radius,
        root: points[0],
        tip: points.at(-1),
      });
    }
  const flyaways = flyawayGeometry();
  parts.push(flyaways.geometry);
  const segments = [],
    cell = 0.26,
    buckets = new Map(),
    key = (x, y, z) => x + "," + y + "," + z;
  for (let part = 1; part < parts.length - 1; part++) {
    const samples = parts[part].userData.samples;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i],
        b = samples[i + 1];
      if (a.r < 0.031 || b.r < 0.031) continue;
      const margin = Math.max(a.r, b.r) + 0.14,
        segment = { a: a.p, b: b.p, ra: a.r, rb: b.r, lock: part };
      const lo = a.p.map((v, k) =>
          Math.floor((Math.min(v, b.p[k]) - margin) / cell),
        ),
        hi = a.p.map((v, k) =>
          Math.floor((Math.max(v, b.p[k]) + margin) / cell),
        );
      for (let z = lo[2]; z <= hi[2]; z++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let x = lo[0]; x <= hi[0]; x++) {
            const k = key(x, y, z);
            if (!buckets.has(k)) buckets.set(k, []);
            buckets.get(k).push(segment);
          }
    }
  }
  const field = (x, y, z) => {
    let d = scalpHairField(x, y, z);
    const nearest = new Map();
    for (const s of buckets.get(
      key(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)),
    ) || []) {
      const dx = s.b[0] - s.a[0],
        dy = s.b[1] - s.a[1],
        dz = s.b[2] - s.a[2],
        length = dx * dx + dy * dy + dz * dz;
      const t = THREE.MathUtils.clamp(
        ((x - s.a[0]) * dx + (y - s.a[1]) * dy + (z - s.a[2]) * dz) /
          Math.max(length, 1e-9),
        0,
        1,
      );
      const distance =
        Math.hypot(
          x - s.a[0] - t * dx,
          y - s.a[1] - t * dy,
          z - s.a[2] - t * dz,
        ) - THREE.MathUtils.lerp(s.ra, s.rb, t);
      if (!nearest.has(s.lock) || distance < nearest.get(s.lock))
        nearest.set(s.lock, distance);
    }
    for (const v of nearest.values()) d = smin(d, v, 0.035);
    for (const sign of [-1, 1])
      d = smax(
        d,
        -ellipsoid(x, y, z, sign * 1.0, 0.04, -0.115, 0.26, 0.345, 0.18),
        0.025,
      );
    return d;
  };
  const solid = volumeMesh(field, () => new THREE.Color(0x142031), {
    step: 0.031,
    lo: [-1.65, -1.12, -1.94],
    hi: [1.65, 1.94, 1.12],
  });
  const sp = solid.attributes.position,
    sn = solid.attributes.normal;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i),
      y = sp.getY(i),
      z = sp.getZ(i),
      e = 0.006,
      n = new THREE.Vector3(
        field(x + e, y, z) - field(x - e, y, z),
        field(x, y + e, z) - field(x, y - e, z),
        field(x, y, z + e) - field(x, y, z - e),
      ).normalize();
    sn.setXYZ(i, ...n.toArray());
  }
  const a = solid.attributes.position,
    b = flyaways.geometry.attributes.position;
  const positions = [...a.array, ...b.array],
    normals = [
      ...solid.attributes.normal.array,
      ...flyaways.geometry.attributes.normal.array,
    ],
    colors = [];
  for (let i = 0; i < positions.length; i += 3) {
    const c = new THREE.Color(0x142031);
    colors.push(c.r, c.g, c.b);
  }
  const indices = Array.from(solid.index.array);
  for (const i of flyaways.geometry.index.array) indices.push(i + a.count);
  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.userData = {
    primaryMasses: masses.length,
    hairClumps: guides.length,
    mediumClumps,
    discardedUnrootedComponents: solid.userData.discardedUnrootedComponents,
    hairLocks: records.length + flyaways.paths.length,
    records,
    flyawayRoots: flyaways.paths.map((p) => p[0]),
    coreVertices: a.count,
    coreIndices: solid.index.count,
  };
  solid.dispose();
  for (const g of parts) g?.dispose();
  return merged;
}
