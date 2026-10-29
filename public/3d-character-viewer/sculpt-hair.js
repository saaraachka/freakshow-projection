import * as THREE from "../character-3d/vendor/three.module.js";
import {
  scalpPoint,
  normalAt,
  scalpHairField,
  growthRegions,
  lateralProfile,
} from "./hair-support.js?sculpt=7";
import { volumeMesh } from "./volume-mesh.js?sculpt=5";
export { hairline, scalpHairField } from "./hair-support.js?sculpt=7";
const smooth = THREE.MathUtils.smoothstep;
export function createHairDefinition() {
  const records = [],
    curves = [];
  for (let zi = 0; zi < growthRegions.length; zi++) {
    const zone = growthRegions[zi];
    for (let row = 0; row < zone.phi.length; row++)
      for (let col = 0; col < zone.theta.length; col++) {
        const phase = zi * 1.7 + row * 2.13 + col * 1.37,
          theta = zone.theta[col] + 0.035 * Math.sin(phase) + row * 0.07,
          phi = zone.phi[row] + 0.075 * Math.sin(phase * 1.3),
          flow =
            zone.name === "crown" && Math.cos(theta) > 0.25 ? -0.23 : zone.flow,
          radius = 0.065 + 0.065 * (0.5 + 0.5 * Math.sin(phase * 1.8)),
          width = 0.047 + 0.042 * (0.5 + 0.5 * Math.cos(phase * 1.3)),
          turns = 1.22 + 0.55 * (0.5 + 0.5 * Math.sin(phase)),
          handed =
            zi === 1 ? -1 : zi === 2 ? 1 : Math.sin(phase) > 0.2 ? 1 : -1,
          points = [];
        for (let k = 0; k <= 64; k++) {
          const t = k / 64,
            th = theta + zone.sweep * t,
            ph = phi + flow * t,
            base = scalpPoint(th, ph),
            out = normalAt(base),
            tangent = scalpPoint(th + zone.sweep * 0.02, ph + flow * 0.02)
              .sub(base)
              .normalize(),
            side = new THREE.Vector3().crossVectors(tangent, out).normalize(),
            angle =
              phase +
              handed * t * Math.PI * 2 * turns +
              0.2 * Math.sin(t * 5 + phase),
            coil = radius * smooth(t, 0, 0.24) * (1 - 0.45 * t),
            p = base
              .addScaledVector(
                out,
                -0.025 +
                  (zone.lift + 0.025 * Math.sin(phase)) * smooth(t, 0, 0.22) +
                  Math.cos(angle) * coil,
              )
              .addScaledVector(side, Math.sin(angle) * coil);
          // Widen the outer hair while keeping the first section seated in
          // the scalp. The matching implicit envelope supports this volume.
          p.x +=
            Math.sign(base.x) *
            0.34 *
            smooth(Math.abs(base.x), 0.3, 0.7) *
            lateralProfile(base.y, base.z) *
            smooth(t, 0, 0.28);
          // Seat the visible side curls on the rounded supporting mass rather
          // than burying their middle sections in the newly widened volume.
          if (Math.abs(p.x) > 0.55 && lateralProfile(p.y, p.z) > 0.3) {
            const blend = smooth(t, 0.06, 0.28),
              e = 0.003;
            for (let pass = 0; pass < 4; pass++) {
              const d = scalpHairField(p.x, p.y, p.z) - width * 0.25;
              if (d >= 0) break;
              const gradient = new THREE.Vector3(
                (scalpHairField(p.x + e, p.y, p.z) -
                  scalpHairField(p.x - e, p.y, p.z)) /
                  (2 * e),
                (scalpHairField(p.x, p.y + e, p.z) -
                  scalpHairField(p.x, p.y - e, p.z)) /
                  (2 * e),
                (scalpHairField(p.x, p.y, p.z + e) -
                  scalpHairField(p.x, p.y, p.z - e)) /
                  (2 * e),
              );
              p.addScaledVector(
                gradient,
                Math.min(
                  0.12,
                  (-d * blend) / Math.max(0.01, gradient.lengthSq()),
                ),
              );
            }
          }
          points.push(p);
        }
        // Do not grow a cluster through the ear clearance or below the hairline.
        if (scalpHairField(...points[0].toArray()) > -0.015) continue;
        records.push({
          name: zone.name + "-" + row + "-" + col,
          kind: "curl-clump",
          parent: zone.name,
          root: points[0].toArray(),
          tip: points.at(-1).toArray(),
          width,
          radius,
          phase,
          turns,
          handed,
        });
        curves.push(new THREE.CatmullRomCurve3(points));
      }
  }
  return { field: scalpHairField, records, curves };
}
// Closed variable-section sweeps. Longitudinal fluting describes grouped hair,
// rather than using texture, ribbons, or a second layer of identical tubes.
function lockGeometry(curve, record, fine = false) {
  const steps = fine ? 28 : 32,
    sides = fine ? 7 : 10,
    frames = curve.computeFrenetFrames(steps, false),
    p = [],
    ix = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      center = curve.getPointAt(t),
      taper =
        (0.65 + 0.35 * smooth(t, 0, 0.17)) * (1 - 0.98 * smooth(t, 0.68, 1)),
      radius =
        (fine ? 0.009 : record.width) *
        taper *
        (0.94 + 0.06 * Math.sin(t * 9 + record.phase));
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        twist = 0.4 * Math.sin(t * 3 + record.phase),
        flute = fine ? 1 : 1 - 0.19 * (0.5 + 0.5 * Math.cos(3 * a + twist * 2)),
        q = center
          .clone()
          .addScaledVector(
            frames.normals[i],
            Math.cos(a + twist) * radius * flute,
          )
          .addScaledVector(
            frames.binormals[i],
            Math.sin(a + twist) * radius * flute * 0.78,
          );
      p.push(q.x, q.y, q.z);
      if (i < steps) {
        const a0 = i * sides + j,
          b0 = i * sides + ((j + 1) % sides);
        ix.push(a0, b0, a0 + sides, b0, b0 + sides, a0 + sides);
      }
    }
  }
  const start = p.length / 3;
  p.push(...curve.getPointAt(0).toArray());
  const end = p.length / 3;
  p.push(...curve.getPointAt(1).toArray());
  for (let j = 0; j < sides; j++) {
    ix.push(start, (j + 1) % sides, j);
    const b = steps * sides;
    ix.push(end, b + j, b + ((j + 1) % sides));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
export function createHairGeometry() {
  const definition = createHairDefinition(),
    solid = volumeMesh(definition.field, () => new THREE.Color(0x142031), {
      step: 0.042,
      lo: [-2.0, -1.08, -1.95],
      hi: [2.0, 2.2, 1.25],
    }),
    p = Array.from(solid.attributes.position.array),
    n = Array.from(solid.attributes.normal.array),
    ix = Array.from(solid.index.array),
    roots = [],
    records = definition.records;
  for (let i = 0; i < solid.attributes.position.count; i++) {
    const x = p[i * 3],
      y = p[i * 3 + 1],
      z = p[i * 3 + 2],
      e = 0.004,
      v = new THREE.Vector3(
        definition.field(x + e, y, z) - definition.field(x - e, y, z),
        definition.field(x, y + e, z) - definition.field(x, y - e, z),
        definition.field(x, y, z + e) - definition.field(x, y, z - e),
      ).normalize();
    n[i * 3] = v.x;
    n[i * 3 + 1] = v.y;
    n[i * 3 + 2] = v.z;
  }
  const append = (g) => {
    const offset = p.length / 3;
    p.push(...g.attributes.position.array);
    n.push(...g.attributes.normal.array);
    for (const i of g.index.array) ix.push(i + offset);
    g.dispose();
  };
  for (let i = 0; i < records.length; i++)
    append(lockGeometry(definition.curves[i], records[i]));
  const crownIndices = records.flatMap((record, index) =>
    record.parent === "crown" ? [index] : [],
  );
  for (const i of [0, 0.22, 0.45, 0.67, 0.9].map(
    (f) => crownIndices[Math.floor(f * (crownIndices.length - 1))],
  )) {
    const c = definition.curves[i],
      root = c.getPointAt(0.35),
      out = root
        .clone()
        .sub(new THREE.Vector3(0, 0.05, -0.4))
        .normalize(),
      side = new THREE.Vector3()
        .crossVectors(c.getTangentAt(0.35), out)
        .normalize();
    const curve = new THREE.CatmullRomCurve3([
      root,
      root.clone().addScaledVector(out, 0.13).addScaledVector(side, 0.06),
      root.clone().addScaledVector(out, 0.21).addScaledVector(side, 0.16),
      root.clone().addScaledVector(out, 0.13).addScaledVector(side, 0.23),
    ]);
    roots.push(root.toArray());
    append(lockGeometry(curve, { phase: i }, true));
  }
  const g = new THREE.BufferGeometry(),
    colors = [];
  for (let i = 0; i < p.length; i += 3)
    colors.push(0.006995, 0.014444, 0.030713);
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(ix);
  g.userData = {
    primaryMasses: growthRegions.length,
    hairClumps: records.length,
    hairLocks: records.length + roots.length,
    records,
    flyawayRoots: roots,
    coreVertices: solid.attributes.position.count,
    coreIndices: solid.index.count,
    embeddedRoots: records.map((r) => definition.field(...r.root)),
    technique:
      "regional scalp envelopes with directed volumetric ringlet clumps",
    growthZones: growthRegions.map((z) => z.name),
  };
  solid.dispose();
  return g;
}
