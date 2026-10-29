import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
import * as THREE from "../character-3d/vendor/three.module.js";
import {
  scalpPoint,
  normalAt,
  scalpHairField,
  hairline,
  hairlineMask,
} from "./hair-support.js?sculpt=9";
import { volumeMesh } from "./volume-mesh.js?sculpt=9";
import { ellipsoid } from "./implicit-skin.js?sculpt=9";
export { hairline, scalpHairField } from "./hair-support.js?sculpt=9";
const smooth = THREE.MathUtils.smoothstep;
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
// Authored clump layout: a high swept hairline, offset crown whorl, opposing
// temporal fans, overlapping occipital rolls, and a shorter nape. Each entry
// is a volumetric carved mass, not a tube, torus, strand or ribbon.
const designs = [];
function band(name, theta, phis, size, flow, sweep) {
  for (let row = 0; row < phis.length; row++)
    for (let col = 0; col < theta.length; col++)
      designs.push({
        name: name + "-" + row + "-" + col,
        zone: name,
        theta: theta[col] + row * 0.095,
        phi: phis[row] + 0.025 * Math.sin(col * 1.7 + row),
        size,
        flow,
        sweep,
        role: row === 0 ? "primary" : "secondary",
      });
}
band(
  "frontal-crest",
  [-0.95, -0.62, -0.28, 0.07, 0.43, 0.77, 1.08],
  [0.6],
  0.245,
  -0.23,
  0.3,
);
band(
  "crown-whorl",
  [-2.7, -1.7, -0.7, 0.3, 1.3, 2.3],
  [0.2, 0.48],
  0.275,
  0.24,
  0.45,
);
band("left-temple", [-1.25, -1.65, -2.02], [0.83, 1.23], 0.285, 0.32, -0.13);
band("right-temple", [1.25, 1.65, 2.02], [0.85, 1.25], 0.3, 0.34, 0.16);
band("occipital", [-2.75, -2.16, 2.12, 2.71], [0.92, 1.42], 0.29, 0.29, 0.14);
band("back-center", [-3.15, 3.03], [1.05, 1.62], 0.27, 0.25, -0.1);
band("nape", [-2.7, -2.1, 2.1, 2.7], [1.91], 0.205, 0.17, 0.12);
band("posterior-crest", [-3.05, -2.4, 2.3], [0.65], 0.31, 0.25, 0.12);
band("left-upper-fan", [-1.85], [0.6], 0.32, 0.3, -0.18);
band("right-upper-fan", [1.85], [0.61], 0.32, 0.3, 0.18);
band("central-quiff", [-0.1], [0.08], 0.3, -0.1, 0.3);
function envelopePoint(theta, phi) {
  const root = scalpPoint(theta, phi, -0.025),
    out = normalAt(root),
    p = root.clone();
  // Find the OUTER surface, including the rounded halo, not an earlier scalp
  // crossing. The rooted volume fills the path between scalp and curl seat.
  let lo = 0,
    hi = 1.05,
    lastInside = 0;
  for (let i = 1; i <= 40; i++) {
    const t = (i / 40) * 1.05,
      q = root.clone().addScaledVector(out, t);
    if (scalpHairField(q.x, q.y, q.z) < 0) lastInside = t;
  }
  lo = lastInside;
  hi = Math.min(1.15, lo + 0.08);
  for (let i = 0; i < 22; i++) {
    const t = (lo + hi) / 2,
      q = root.clone().addScaledVector(out, t);
    if (scalpHairField(q.x, q.y, q.z) < 0) lo = t;
    else hi = t;
  }
  p.addScaledVector(out, (lo + hi) / 2);
  const e = 0.003,
    n = new THREE.Vector3(
      scalpHairField(p.x + e, p.y, p.z) - scalpHairField(p.x - e, p.y, p.z),
      scalpHairField(p.x, p.y + e, p.z) - scalpHairField(p.x, p.y - e, p.z),
      scalpHairField(p.x, p.y, p.z + e) - scalpHairField(p.x, p.y, p.z - e),
    ).normalize();
  // Trace the growth origin up to actual hair-covered scalp. A low external
  // temple curl is supported by a high/rear root, never by the bare forehead.
  let growthRoot = root.clone();
  for (let k = 0; k < 40; k++) {
    if (
      scalpHairField(growthRoot.x, growthRoot.y, growthRoot.z) + 0.06 < -0.02 &&
      hairlineMask(growthRoot.x, growthRoot.y, growthRoot.z) < -0.025
    )
      break;
    growthRoot = scalpPoint(
      theta,
      Math.max(0.03, phi - (k + 1) * 0.025),
      -0.04,
    );
  }
  return { root: growthRoot, point: p, out: n.lengthSq() > 0.5 ? n : out };
}
export const baseField = (x, y, z) =>
  smax(
    scalpHairField(x, y, z) + 0.06 * smooth(y - hairline(x, z), 0.05, 0.22),
    hairlineMask(x, y, z),
    0.032,
  );
export function createHairDefinition() {
  const clumps = [],
    records = [];
  for (let i = 0; i < designs.length; i++) {
    if (
      designs[i].name === "left-temple-1-0" ||
      designs[i].name === "right-temple-1-0"
    )
      continue;
    const d = designs[i],
      phase = i * 0.87 + (i % 3) * 0.41,
      seat = envelopePoint(d.theta, d.phi),
      raw = scalpPoint(d.theta + d.sweep * 0.05, d.phi + d.flow * 0.05).sub(
        scalpPoint(d.theta, d.phi),
      ),
      flow = raw.addScaledVector(seat.out, -raw.dot(seat.out)).normalize(),
      side = new THREE.Vector3().crossVectors(flow, seat.out).normalize(),
      ru = d.size * 1.1 * (0.88 + 0.16 * Math.sin(i * 1.7 + 0.6)),
      rv = d.size * 1.1 * (1.03 + 0.22 * Math.cos(i * 1.3)),
      depth =
        0.145 + (d.role === "primary" ? 0.045 : 0) + 0.02 * Math.sin(i * 0.7),
      center = seat.point.clone().addScaledVector(seat.out, 0.025),
      c = {
        center,
        out: seat.out,
        flow,
        side,
        ru,
        rv,
        depth,
        phase,
        hand:
          d.zone === "left-temple"
            ? -1
            : d.zone === "right-temple"
              ? 1
              : i % 2
                ? -1
                : 1,
        sweepFold: i % 4 === 0,
        turns: 0.55 + 0.72 * (0.5 + 0.5 * Math.sin(i * 1.1)),
        groove: 0.075 + 0.015 * (0.5 + 0.5 * Math.sin(i * 0.9)),
        channelWidth: 0.052 + 0.012 * (0.5 + 0.5 * Math.cos(i)),
      };
    clumps.push(c);
    records.push({
      name: d.name,
      kind: "carved-volumetric-scroll",
      parent: d.zone,
      role: d.role,
      root: seat.root.toArray(),
      seat: center.toArray(),
      tip: center
        .clone()
        .addScaledVector(flow, rv * 0.55)
        .addScaledVector(seat.out, depth * 0.65)
        .toArray(),
      width: ru,
      depth,
      turns: c.turns,
      handed: c.hand,
    });
  }
  return { field: baseField, records, clumps };
}
function capHeight(c, u, v, r, a) {
  const rotated = a - c.phase,
    r0 = Math.hypot(u / (1 + 0.35 * THREE.MathUtils.clamp(v, -1, 1)), v),
    cap =
      c.depth *
      Math.max(0, 1 - r * r) ** 1.15 *
      (0.91 + 0.2 * v + 0.12 * r0 * r0 * Math.sin(rotated)),
    phase = a - c.hand * c.turns * Math.PI * 2 * (1 - r0) - c.phase,
    physical = c.sweepFold
      ? (u - 0.48 * Math.sin(v * 2.8 + c.phase)) * c.ru
      : Math.atan2(Math.sin(phase), Math.cos(phase)) *
        Math.max(0.1, r0) *
        Math.min(c.ru, c.rv),
    gate = smooth(r0, 0.1, 0.23) * (1 - smooth(r0, 0.88, 1.04));
  return (
    cap -
    c.groove * Math.exp(-1 * (physical / c.channelWidth) ** 2) * gate -
    0.16 * smooth(r, 0.68, 1)
  );
}
function clumpMesh(c) {
  const nr = 18,
    nt = 48,
    p = [],
    ix = [];
  const point = (r, a) => {
    const rotated = a - c.phase,
      outline =
        0.87 +
        0.22 * Math.cos(rotated - 0.4) +
        0.095 * Math.sin(2 * rotated + 0.6),
      v = r * Math.sin(a) * outline,
      u =
        r *
        Math.cos(a) *
        outline *
        (1 + 0.35 * THREE.MathUtils.clamp(v, -1, 1)),
      h = capHeight(c, u, v, r, a);
    return c.center
      .clone()
      .addScaledVector(c.side, u * c.ru)
      .addScaledVector(c.flow, v * c.rv)
      .addScaledVector(c.out, h);
  };
  p.push(...point(0, 0).toArray());
  for (let k = 1; k <= nr; k++)
    for (let j = 0; j < nt; j++)
      p.push(...point(k / nr, (j / nt) * Math.PI * 2).toArray());
  for (let j = 0; j < nt; j++) ix.push(0, 1 + j, 1 + ((j + 1) % nt));
  for (let k = 0; k < nr - 1; k++)
    for (let j = 0; j < nt; j++) {
      const a = 1 + k * nt + j,
        b = 1 + (k + 1) * nt + j,
        an = 1 + k * nt + ((j + 1) % nt),
        bn = 1 + (k + 1) * nt + ((j + 1) % nt);
      ix.push(a, b, bn, a, bn, an);
    }
  const back = p.length / 3;
  p.push(...c.center.clone().addScaledVector(c.out, -0.29).toArray());
  const rim = 1 + (nr - 1) * nt;
  for (let j = 0; j < nt; j++) ix.push(back, rim + ((j + 1) % nt), rim + j);
  return { positions: Float32Array.from(p), indices: Uint32Array.from(ix) };
}
function guardMesh() {
  const nx = 72,
    nz = 56,
    p = [],
    ix = [],
    at = (i, j) => i + j * (nx + 1),
    layer = (nx + 1) * (nz + 1);
  for (let bottom = 0; bottom < 2; bottom++)
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = -2.5 + (5 * i) / nx,
          z = -2.5 + (4 * j) / nz;
        p.push(
          x,
          bottom ? -2 : hairline(x, z) - 0.9 * smooth(Math.abs(x), 0.72, 1.07),
          z,
        );
      }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = at(i, j),
        b = at(i + 1, j),
        c = at(i, j + 1),
        d = at(i + 1, j + 1);
      ix.push(
        a,
        c,
        b,
        b,
        c,
        d,
        a + layer,
        b + layer,
        c + layer,
        b + layer,
        d + layer,
        c + layer,
      );
    }
  const edge = (a, b) => ix.push(a, b, a + layer, b, b + layer, a + layer);
  for (let i = 0; i < nx; i++) {
    edge(at(i, 0), at(i + 1, 0));
    edge(at(i + 1, nz), at(i, nz));
  }
  for (let j = 0; j < nz; j++) {
    edge(at(0, j + 1), at(0, j));
    edge(at(nx, j), at(nx, j + 1));
  }
  return { positions: Float32Array.from(p), indices: Uint32Array.from(ix) };
}
let manifoldPromise;
async function manifoldModule() {
  if (!manifoldPromise)
    manifoldPromise = (async () => {
      const { default: factory } = await import(
        "./vendor/manifold/manifold.js"
      );
      const options = {};
      if (typeof process === "undefined" || !process.versions?.node) {
        const r = await fetch(
          new URL("./vendor/manifold/manifold.wasm", import.meta.url),
        );
        if (!r.ok) throw new Error("Manifold WASM: " + r.status);
        options.wasmBinary = new Uint8Array(await r.arrayBuffer());
      }
      const m = await factory(options);
      m.setup();
      return m;
    })();
  return manifoldPromise;
}
export async function createHairGeometry() {
  const d = createHairDefinition(),
    m = await manifoldModule(),
    parts = [],
    base = volumeMesh(baseField, () => new THREE.Color(0x142031), {
      step: 0.046,
      lo: [-2.2, -1.1, -2.1],
      hi: [2.2, 2.3, 1.25],
      postprocess: false,
      refineEdges: true,
    }),
    solid = ({ positions, indices }) =>
      new m.Manifold(
        new m.Mesh({
          numProp: 3,
          vertProperties: positions,
          triVerts: indices,
        }),
      );
  parts.push(
    solid({
      positions: base.attributes.position.array,
      indices: new Uint32Array(base.index.array),
    }),
  );
  for (const c of d.clumps) parts.push(solid(clumpMesh(c)));
  let model = m.Manifold.union(parts);
  for (const part of parts) part.delete();
  base.dispose();
  const guard = solid(guardMesh()),
    cut = model.subtract(guard);
  model.delete();
  guard.delete();
  model = cut;
  for (const sign of [-1, 1]) {
    const unit = m.Manifold.sphere(1, 32),
      scaled = unit.scale([0.27, 0.36, 0.2]),
      ear = scaled.translate([sign * 1, 0.04, -0.115]),
      next = model.subtract(ear);
    unit.delete();
    scaled.delete();
    ear.delete();
    model.delete();
    model = next;
  }
  const normalModel = model.calculateNormals(0, 180);
  model.delete();
  const mesh = normalModel.getMesh(),
    count = mesh.vertProperties.length / mesh.numProp,
    parent = Int32Array.from({ length: count }, (_, i) => i),
    find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
  for (let i = 0; i < mesh.mergeFromVert.length; i++)
    parent[find(mesh.mergeFromVert[i])] = find(mesh.mergeToVert[i]);
  const map = new Map(),
    p = [],
    n = [],
    colors = [],
    ix = [],
    samples = [];
  for (let i = 0; i < count; i++) {
    const root = find(i);
    if (!map.has(root)) {
      map.set(root, map.size);
      const k = root * mesh.numProp;
      p.push(
        mesh.vertProperties[k],
        mesh.vertProperties[k + 1],
        mesh.vertProperties[k + 2],
      );
      n.push(0, 0, 0);
      samples.push(0);
      colors.push(0.006995, 0.014444, 0.030713);
    }
    const id = map.get(root),
      k = i * mesh.numProp;
    n[id * 3] += mesh.vertProperties[k + 3];
    n[id * 3 + 1] += mesh.vertProperties[k + 4];
    n[id * 3 + 2] += mesh.vertProperties[k + 5];
    samples[id]++;
  }
  for (const i of mesh.triVerts) ix.push(map.get(find(i)));
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= len;
    n[i + 1] /= len;
    n[i + 2] /= len;
  }
  normalModel.delete();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ix);
  g.userData = {
    primaryMasses: designs.filter((d) => d.role === "primary").length,
    hairClumps: d.records.length,
    hairLocks: d.records.length,
    records: d.records,
    flyawayRoots: [],
    coreVertices: p.length / 3,
    coreIndices: ix.length,
    embeddedRoots: d.records.map((r) => baseField(...r.root)),
    growthZones: [...new Set(designs.map((d) => d.zone))],
    technique: "parametric carved solid clumps with exact manifold union",
    strandSweeps: 0,
    wireFlyaways: 0,
    discardedUnrootedComponents: 0,
  };
  return fairSurface(g, {
    pairs: 12,
    limit: 0.018,
    reverseWeight: -0.43,
    preserveFieldNormals: true,
    normalPasses: 4,
    weight: (x, y, z) => 0.35 + 0.65 * smooth(z, -0.45, 0.35),
  });
}
