import * as THREE from "../../character-3d/vendor/three.module.js";
import { scalpDistance } from "./cranial-refinement.js?sculpt=5";
import { ellipsoid } from "./implicit-skin.js?sculpt=4";
import { volumeMesh } from "./volume-mesh.js?sculpt=5";
const smooth = THREE.MathUtils.smoothstep,
  clamp = THREE.MathUtils.clamp;
const smin = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  },
  smax = (a, b, k) => -smin(-a, -b, k);
const V = (a) => new THREE.Vector3(...a);
export function hairline(x, z) {
  const front = smooth(z, -0.65, 0.4);
  return (
    -0.5 +
    1.2 * front -
    0.12 * Math.exp(-1 * ((x + 0.17) / 0.3) ** 2) * front +
    0.035 * Math.sin(x * 9 + 0.5) * front
  );
}
export function scalpHairField(x, y, z) {
  const edge = y - hairline(x, z),
    thickness = 0.006 + 0.075 * smooth(edge, 0, 0.22);
  let d = smax(scalpDistance(x, y, z) - thickness, -edge, 0.025);
  for (const sign of [-1, 1])
    d = smax(
      d,
      -ellipsoid(x, y, z, sign * 1.0, 0.04, -0.115, 0.26, 0.345, 0.18),
      0.025,
    );
  return d;
}
function normalAt(p) {
  const e = 0.003;
  return new THREE.Vector3(
    scalpDistance(p.x + e, p.y, p.z) - scalpDistance(p.x - e, p.y, p.z),
    scalpDistance(p.x, p.y + e, p.z) - scalpDistance(p.x, p.y - e, p.z),
    scalpDistance(p.x, p.y, p.z + e) - scalpDistance(p.x, p.y, p.z - e),
  ).normalize();
}
function scalpPoint(theta, phi, lift) {
  const origin = new THREE.Vector3(0, 0.05, -0.4),
    direction = new THREE.Vector3(
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta),
    );
  let lo = 0,
    hi = 2;
  for (let i = 0; i < 24; i++) {
    const r = (lo + hi) / 2,
      p = origin.clone().addScaledVector(direction, r);
    if (scalpDistance(p.x, p.y, p.z) > 0) hi = r;
    else lo = r;
  }
  const p = origin.addScaledVector(direction, (lo + hi) / 2);
  return p.addScaledVector(normalAt(p), lift);
}
// Twenty authored masses, each with its own root, crest, sweep and returning
// tip. Coordinates are on the actual skull, not on a generic spherical wig.
const designs = [
  [
    "left-quiff",
    0.27,
    [
      [-0.22, 0.98, -0.02],
      [-0.5, 0.67, 0.18],
      [-0.15, 0.25, 0.4],
      [0.25, 0.52, 0.24],
      [0.05, 0.75, 0.08],
    ],
  ],
  [
    "right-quiff",
    0.25,
    [
      [0.4, 0.97, -0.02],
      [0.7, 0.62, 0.18],
      [0.45, 0.18, 0.26],
      [0.0, 0.36, 0.24],
      [0.25, 0.62, 0.08],
    ],
  ],
  [
    "left-fringe",
    0.21,
    [
      [-0.62, 1.02, -0.02],
      [-0.88, 0.8, 0.12],
      [-0.6, 0.61, 0.19],
      [-0.28, 0.76, 0.14],
      [-0.43, 0.98, 0.02],
    ],
  ],
  [
    "right-fringe",
    0.22,
    [
      [0.76, 1.04, -0.02],
      [1.03, 0.78, 0.12],
      [0.8, 0.55, 0.22],
      [0.48, 0.77, 0.16],
      [0.65, 0.97, 0.02],
    ],
  ],
  [
    "left-temple",
    0.22,
    [
      [-1.16, 1.14, -0.02],
      [-1.42, 0.91, 0.13],
      [-1.65, 0.71, 0.23],
      [-1.84, 0.93, 0.19],
      [-1.58, 1.17, 0.02],
    ],
  ],
  [
    "right-temple",
    0.24,
    [
      [1.18, 1.14, -0.02],
      [1.43, 0.87, 0.16],
      [1.7, 0.67, 0.31],
      [1.93, 0.96, 0.17],
      [1.62, 1.17, 0.02],
    ],
  ],
  [
    "left-crown",
    0.27,
    [
      [-1.01, 0.68, -0.02],
      [-1.55, 0.42, 0.15],
      [-2.25, 0.4, 0.23],
      [-2.45, 0.74, 0.22],
      [-2.04, 0.91, 0.04],
    ],
  ],
  [
    "right-crown",
    0.25,
    [
      [1.05, 0.64, -0.02],
      [1.55, 0.39, 0.18],
      [2.15, 0.48, 0.26],
      [2.37, 0.81, 0.19],
      [1.94, 0.96, 0.03],
    ],
  ],
  [
    "crown-fall",
    0.25,
    [
      [2.9, 0.29, -0.02],
      [3.35, 0.53, 0.17],
      [3.05, 0.83, 0.24],
      [2.67, 1.03, 0.16],
      [2.72, 0.84, 0.03],
    ],
  ],
  [
    "left-occiput",
    0.26,
    [
      [-2.02, 0.9, -0.02],
      [-2.15, 1.12, 0.19],
      [-2.57, 1.4, 0.24],
      [-2.86, 1.24, 0.17],
      [-2.64, 1.05, 0.04],
    ],
  ],
  [
    "right-occiput",
    0.27,
    [
      [2.02, 0.95, -0.02],
      [2.2, 1.2, 0.18],
      [2.6, 1.45, 0.26],
      [2.94, 1.27, 0.16],
      [2.69, 1.09, 0.03],
    ],
  ],
  [
    "back-center-left",
    0.25,
    [
      [-2.92, 1.0, -0.02],
      [-3.38, 1.21, 0.15],
      [-3.4, 1.5, 0.23],
      [-3.0, 1.69, 0.17],
      [-2.84, 1.48, 0.02],
    ],
  ],
  [
    "back-center-right",
    0.23,
    [
      [2.85, 1.4, -0.02],
      [2.52, 1.62, 0.16],
      [2.81, 1.89, 0.22],
      [3.18, 1.75, 0.15],
      [3.19, 1.52, 0.03],
    ],
  ],
  [
    "left-back-side",
    0.24,
    [
      [-1.92, 1.38, -0.02],
      [-2.02, 1.64, 0.18],
      [-2.3, 1.87, 0.23],
      [-2.6, 1.74, 0.14],
      [-2.35, 1.57, 0.02],
    ],
  ],
  [
    "right-back-side",
    0.24,
    [
      [1.94, 1.4, -0.02],
      [2.05, 1.63, 0.18],
      [2.3, 1.9, 0.25],
      [2.6, 1.76, 0.17],
      [2.35, 1.57, 0.03],
    ],
  ],
  [
    "left-nape",
    0.22,
    [
      [-2.72, 1.73, -0.02],
      [-2.98, 1.97, 0.15],
      [-3.44, 2.12, 0.27],
      [-3.64, 1.88, 0.12],
      [-3.32, 1.79, 0.02],
    ],
  ],
  [
    "right-nape",
    0.24,
    [
      [2.57, 1.81, -0.02],
      [2.89, 2.06, 0.17],
      [3.2, 2.18, 0.21],
      [3.5, 1.95, 0.12],
      [3.24, 1.83, 0.02],
    ],
  ],
  [
    "left-sideburn",
    0.19,
    [
      [-1.69, 1.49, -0.02],
      [-1.83, 1.78, 0.13],
      [-1.95, 2.02, 0.21],
      [-2.21, 1.97, 0.13],
      [-2.16, 1.78, 0.02],
    ],
  ],
  [
    "right-sideburn",
    0.2,
    [
      [1.72, 1.49, -0.02],
      [1.82, 1.83, 0.14],
      [2.04, 2.09, 0.23],
      [2.28, 1.98, 0.13],
      [2.14, 1.78, 0.02],
    ],
  ],
  [
    "central-crown-roll",
    0.245,
    [
      [-1.4, 0.44, -0.02],
      [-0.2, 0.08, 0.16],
      [1.4, 0.34, 0.2],
      [0.6, 0.48, 0.12],
      [0.5, 0.2, 0.04],
    ],
  ],
];
// Continuous cubic centerline and transported elliptical frames. Solving the
// closest parameter avoids the periodic caps/beads of a union of short tubes.
function segmentDistance(x, y, z, s) {
  const dx = x - s.a.x,
    dy = y - s.a.y,
    dz = z - s.a.z;
  let t = clamp(
    (dx * s.delta.x + dy * s.delta.y + dz * s.delta.z) / s.length2,
    0,
    1,
  );
  let px, py, pz, vx, vy, vz;
  for (let pass = 0; pass < 3; pass++) {
    px = s.a.x + t * (s.c1.x + t * (s.c2.x + t * s.c3.x));
    py = s.a.y + t * (s.c1.y + t * (s.c2.y + t * s.c3.y));
    pz = s.a.z + t * (s.c1.z + t * (s.c2.z + t * s.c3.z));
    vx = s.c1.x + t * (2 * s.c2.x + 3 * t * s.c3.x);
    vy = s.c1.y + t * (2 * s.c2.y + 3 * t * s.c3.y);
    vz = s.c1.z + t * (2 * s.c2.z + 3 * t * s.c3.z);
    if (pass === 2) break;
    const denominator =
      vx * vx +
      vy * vy +
      vz * vz +
      (px - x) * (2 * s.c2.x + 6 * t * s.c3.x) +
      (py - y) * (2 * s.c2.y + 6 * t * s.c3.y) +
      (pz - z) * (2 * s.c2.z + 6 * t * s.c3.z);
    if (Math.abs(denominator) > 1e-10)
      t = clamp(
        t - ((px - x) * vx + (py - y) * vy + (pz - z) * vz) / denominator,
        0,
        1,
      );
  }
  const vl = Math.hypot(vx, vy, vz);
  vx /= vl;
  vy /= vl;
  vz /= vl;
  let ox = s.oa.x + t * (s.ob.x - s.oa.x),
    oy = s.oa.y + t * (s.ob.y - s.oa.y),
    oz = s.oa.z + t * (s.ob.z - s.oa.z);
  const dot = ox * vx + oy * vy + oz * vz;
  ox -= dot * vx;
  oy -= dot * vy;
  oz -= dot * vz;
  const ol = Math.hypot(ox, oy, oz);
  ox /= ol;
  oy /= ol;
  oz /= ol;
  const sx = vy * oz - vz * oy,
    sy = vz * ox - vx * oz,
    sz = vx * oy - vy * ox,
    qx = x - px,
    qy = y - py,
    qz = z - pz,
    w = s.wa + t * (s.wb - s.wa),
    h = s.ha + t * (s.hb - s.ha),
    r = Math.min(w, h);
  return (
    (Math.hypot(
      (qx * sx + qy * sy + qz * sz) / w,
      (qx * ox + qy * oy + qz * oz) / h,
      (qx * vx + qy * vy + qz * vz) / r,
    ) -
      1) *
    r
  );
}
export function createHairDefinition() {
  const segments = [],
    records = [],
    curves = [];
  function add(curve, width, depth, name, kind, phase) {
    const steps = 48,
      points = curve.getSpacedPoints(steps),
      samples = [],
      frames = curve.computeFrenetFrames(steps, false),
      firstTangent = frames.tangents[0];
    const rootOut = normalAt(points[0])
      .addScaledVector(firstTangent, -normalAt(points[0]).dot(firstTangent))
      .normalize();
    if (rootOut.lengthSq() < 0.5) rootOut.copy(frames.normals[0]);
    const angle = Math.atan2(
      firstTangent.dot(
        new THREE.Vector3().crossVectors(frames.normals[0], rootOut),
      ),
      frames.normals[0].dot(rootOut),
    );
    for (let i = 0; i < points.length; i++) {
      const t = i / steps,
        p = points[i],
        tangent = frames.tangents[i],
        out = frames.normals[i]
          .clone()
          .applyAxisAngle(tangent, angle + 0.3 * Math.sin(t * 4 + phase)),
        side = new THREE.Vector3().crossVectors(tangent, out).normalize();
      const taper =
        (0.34 + 0.66 * smooth(t, 0, 0.16)) * (1 - 0.94 * smooth(t, 0.74, 1));
      const swell = 0.82 + 0.18 * Math.sin(Math.PI * t);
      samples.push({
        p,
        out,
        side,
        tangent,
        w: Math.max(0.008, width * taper * swell),
        h: Math.max(0.008, depth * taper * swell),
      });
    }
    for (let i = 0; i < steps; i++) {
      const a = samples[i],
        b = samples[i + 1],
        delta = b.p.clone().sub(a.p),
        tangent = delta.clone().normalize(),
        out = a.out.clone().add(b.out).normalize();
      out.addScaledVector(tangent, -out.dot(tangent)).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, out).normalize();
      segments.push({
        a: a.p,
        delta,
        length2: Math.max(delta.lengthSq(), 1e-8),
        out,
        side,
        tangent,
        c1: a.tangent.clone().multiplyScalar(delta.length()),
        c2: delta
          .clone()
          .multiplyScalar(3)
          .addScaledVector(a.tangent, -2 * delta.length())
          .addScaledVector(b.tangent, -delta.length()),
        c3: delta
          .clone()
          .multiplyScalar(-2)
          .addScaledVector(a.tangent, delta.length())
          .addScaledVector(b.tangent, delta.length()),
        oa: a.out,
        ob: b.out,
        kind,
        wa: a.w,
        wb: b.w,
        ha: a.h,
        hb: b.h,
        lock: records.length,
      });
    }
    records.push({
      name,
      kind,
      root: points[0].toArray(),
      tip: points.at(-1).toArray(),
      width,
      depth,
    });
    return samples;
  }
  for (let i = 0; i < designs.length; i++) {
    const [name, width, uv] = designs[i],
      points = uv.map(([theta, phi, h]) => scalpPoint(theta, phi, h)),
      curve = new THREE.CatmullRomCurve3(points);
    curves.push(curve);
    const samples = add(curve, width, width * 0.68, name, "primary", i * 0.7);
    for (let j = 0; j < 2; j++) {
      const parentAt = j === 0 ? 0.38 : 0.64,
        idx = Math.round(parentAt * 48),
        frame = samples[idx],
        center = curve.getPointAt(parentAt),
        pts = [],
        sign = j === 0 ? -1 : 1;
      const radius = width * (j === 0 ? 0.7 : 0.61),
        phase = i * 0.53 + j * 0.9,
        turn = 1.2 + (i % 3) * 0.16;
      for (let k = 0; k <= 28; k++) {
        const t = k / 28,
          angle = phase + sign * t * Math.PI * turn,
          r = radius * (1 - 0.56 * t),
          p = center
            .clone()
            .addScaledVector(
              frame.tangent,
              Math.cos(angle) * r + 0.1 * (t - 0.5),
            )
            .addScaledVector(frame.side, Math.sin(angle) * r);
        p.addScaledVector(
          frame.out,
          frame.h * 0.65 + 0.07 * Math.sin(Math.PI * t),
        );
        if (t < 0.15)
          p.addScaledVector(frame.out, -0.15 * (1 - smooth(t, 0, 0.15)));
        if (t > 0.84) p.addScaledVector(frame.out, -0.065 * smooth(t, 0.84, 1));
        pts.push(p);
      }
      add(
        new THREE.CatmullRomCurve3(pts),
        width * (j === 0 ? 0.37 : 0.31),
        width * (j === 0 ? 0.34 : 0.29),
        name + "-roll-" + j,
        "medium",
        i + j * 1.3,
      );
    }
  }
  const cell = 0.26,
    key = (x, y, z) => x + "," + y + "," + z;
  function bucket(items, extra) {
    const map = new Map();
    for (const s of items) {
      const b = s.a.clone().add(s.delta),
        r = extra(s),
        lo = ["x", "y", "z"].map((k) =>
          Math.floor((Math.min(s.a[k], b[k]) - r) / cell),
        ),
        hi = ["x", "y", "z"].map((k) =>
          Math.floor((Math.max(s.a[k], b[k]) + r) / cell),
        );
      for (let z = lo[2]; z <= hi[2]; z++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let x = lo[0]; x <= hi[0]; x++) {
            const k = key(x, y, z);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(s);
          }
    }
    return map;
  }
  const locks = bucket(
    segments,
    (s) => Math.max(s.wa, s.wb, s.ha, s.hb) + 0.18,
  );
  const field = (x, y, z) => {
    let d = scalpHairField(x, y, z);
    const k = key(
        Math.floor(x / cell),
        Math.floor(y / cell),
        Math.floor(z / cell),
      ),
      nearest = new Map();
    for (const s of locks.get(k) || []) {
      const v = segmentDistance(x, y, z, s),
        old = nearest.get(s.lock);
      if (!old || v < old.distance)
        nearest.set(s.lock, { distance: v, kind: s.kind });
    }
    for (const { distance, kind } of nearest.values())
      d = smin(d, distance, kind === "primary" ? 0.045 : 0.028);
    for (const sign of [-1, 1])
      d = smax(
        d,
        -ellipsoid(x, y, z, sign * 1.0, 0.04, -0.115, 0.26, 0.345, 0.18),
        0.025,
      );
    return d;
  };
  return { field, records, curves };
}
function flyawayGeometry(definition) {
  const positions = [],
    indices = [],
    roots = [];
  for (const [index, at, sign] of [
    [0, 0.34, -1],
    [1, 0.45, 1],
    [4, 0.4, -1],
    [10, 0.44, 1],
    [12, 0.38, -1],
  ]) {
    const parent = definition.curves[index],
      root = parent.getPointAt(at),
      out = root
        .clone()
        .sub(new THREE.Vector3(0, 0.05, -0.4))
        .normalize(),
      side = new THREE.Vector3()
        .crossVectors(parent.getTangentAt(at), out)
        .normalize();
    root.addScaledVector(out, -0.025);
    roots.push(root.toArray());
    const curve = new THREE.CatmullRomCurve3([
        root,
        root
          .clone()
          .addScaledVector(out, 0.15)
          .addScaledVector(side, sign * 0.1),
        root
          .clone()
          .addScaledVector(out, 0.46)
          .addScaledVector(side, sign * 0.25),
        root
          .clone()
          .addScaledVector(out, 0.36)
          .addScaledVector(side, sign * 0.43),
      ]),
      steps = 28,
      sides = 7,
      frames = curve.computeFrenetFrames(steps, false),
      base = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        p = curve.getPointAt(t),
        r = 0.01 * (1 - 0.93 * smooth(t, 0.25, 1));
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
  return { geometry: g, roots };
}
export function createHairGeometry() {
  const definition = createHairDefinition(),
    solid = volumeMesh(definition.field, () => new THREE.Color(0x142031), {
      step: 0.035,
      lo: [-1.6, -1.08, -1.95],
      hi: [1.6, 1.9, 1.15],
    });
  const positionsCore = solid.attributes.position,
    normalsCore = solid.attributes.normal;
  for (let i = 0; i < positionsCore.count; i++) {
    const x = positionsCore.getX(i),
      y = positionsCore.getY(i),
      z = positionsCore.getZ(i),
      e = 0.006,
      n = new THREE.Vector3(
        definition.field(x + e, y, z) - definition.field(x - e, y, z),
        definition.field(x, y + e, z) - definition.field(x, y - e, z),
        definition.field(x, y, z + e) - definition.field(x, y, z - e),
      ).normalize();
    normalsCore.setXYZ(i, n.x, n.y, n.z);
  }
  const fly = flyawayGeometry(definition),
    a = solid.attributes.position,
    b = fly.geometry.attributes.position,
    positions = [...a.array, ...b.array],
    normals = [
      ...solid.attributes.normal.array,
      ...fly.geometry.attributes.normal.array,
    ],
    colors = [];
  for (let i = 0; i < positions.length; i += 3)
    colors.push(0.006995, 0.014444, 0.030713);
  const ix = Array.from(solid.index.array);
  for (const i of fly.geometry.index.array) ix.push(i + a.count);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ix);
  g.userData = {
    primaryMasses: designs.length,
    hairClumps: designs.length,
    hairLocks: definition.records.length + fly.roots.length,
    records: definition.records,
    flyawayRoots: fly.roots,
    coreVertices: a.count,
    coreIndices: solid.index.count,
    discardedUnrootedComponents: solid.userData.discardedUnrootedComponents,
    embeddedRoots: fly.roots.map((p) => definition.field(...p)),
  };
  solid.dispose();
  fly.geometry.dispose();
  return g;
}
