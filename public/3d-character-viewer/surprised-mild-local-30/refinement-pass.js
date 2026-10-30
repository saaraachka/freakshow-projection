import * as THREE from "../../character-3d/vendor/three.module.js";
import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
import { hairline, normalAt, scalpHairField } from "./hair-support.js?sculpt=9";
const smooth = THREE.MathUtils.smootherstep;
const bell = (v) => Math.exp(-v * v);
// Bounded cleanup of the CURRENT sculpt, not a new anatomical surface. Protect
// lip margins, eyeball clearance, nose tip and the high forehead silhouette.
export function refineSkinSurface(g) {
  return fairSurface(g, {
    pairs: 6,
    limit: 0.0035,
    reverseWeight: -0.46,
    preserveFieldNormals: true,
    normalPasses: 0,
    weight: (x, y, z) => {
      const ax = Math.abs(x),
        front = smooth(z, -0.05, 0.2);
      const orbital = bell((ax - 0.36) / 0.26) * bell((y - 0.29) / 0.23);
      const mouth = bell(x / 0.72) * bell((y + 0.43) / 0.25);
      const nose = bell(x / 0.28) * bell((y + 0.01) / 0.25);
      return (
        front *
        (1 - 0.98 * orbital) *
        (1 - 0.98 * mouth) *
        (1 - 0.98 * nose) *
        (1 - smooth(y, 0.9, 1.2))
      );
    },
  });
}
// Fill the valleys between existing carved curl groups, rather than adding
// random strands. Smoothly rooted support follows the scalp's normal and fades
// to zero at the existing hairline, ears and nape. All clump topology is retained.
export function refineHairCoverage(g) {
  const p = g.attributes.position,
    original = p.array.slice();
  let maxLift = 0;
  const q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      ax = Math.abs(x);
    const edge = smooth(y - hairline(x, z), 0.035, 0.23);
    const crown = bell((y - 1.35) / 0.38) * bell((z + 0.45) / 0.66);
    const shoulder =
      bell((ax - 1.12) / 0.32) *
      bell((y - 0.92) / 0.4) *
      bell((z + 0.72) / 0.55);
    const back =
      bell(x / 0.65) * bell((y - 0.9) / 0.45) * bell((z + 1.35) / 0.25);
    const valley = 1 - smooth(scalpHairField(x, y, z), 0.025, 0.18);
    const lift =
      edge * valley * (0.08 * crown + 0.055 * shoulder + 0.04 * back);
    q.set(x, y, z);
    const n = normalAt(q);
    p.setXYZ(i, x + n.x * lift, y + n.y * lift, z + n.z * lift);
    maxLift = Math.max(maxLift, lift);
  }
  fairSurface(g, {
    pairs: 4,
    limit: 0.004,
    reverseWeight: -0.46,
    preserveFieldNormals: true,
    normalPasses: 0,
    weight: (x, y, z) => smooth(y, 0.45, 1.1) * smooth(z, -0.9, 0.2),
  });
  // Small, continuous support growth carries the original curl normals. This
  // avoids flattening the carved channels with an area-weighted re-normalize.
  g.userData.coverageRefinement = {
    maxLift,
    sourceVertices: original.length / 3,
    topologyPreserved: true,
    addedStrands: 0,
    hairlineUnchanged: true,
  };
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
// A narrow, bounded post-deformation polish on the same connected surface.
// Bilateral normal diffusion removes sub-cell transport streaks, but does not
// average across the lip edge, lid edge or intentional smile crease.
export function finishExpressionSurfaces(g) {
  const links = Array.from(
    { length: g.attributes.position.count },
    () => new Set(),
  );
  const ix = g.index.array;
  for (let t = 0; t < ix.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = ix[t + k],
        b = ix[t + ((k + 1) % 3)];
      links[a].add(b);
      links[b].add(a);
    }
  const arrays = [g.attributes.position, ...g.morphAttributes.position],
    normals = [g.attributes.normal, ...g.morphAttributes.normal];
  const strength = (x, y, z) => {
    const front = smooth(z, 0.12, 0.35),
      ax = Math.abs(x);
    const lip = bell(x / 0.55) * bell((y + 0.32) / 0.1);
    const orbit = bell((ax - 0.36) / 0.23) * bell((y - 0.48) / 0.18);
    const cheek = bell((ax - 0.57) / 0.22) * bell((y + 0.15) / 0.25);
    return front * Math.min(1, 0.75 * lip + 0.85 * orbit + 0.4 * cheek);
  };
  for (let pose = 0; pose < arrays.length; pose++) {
    const temp = new THREE.BufferGeometry();
    temp.setIndex(g.index.clone());
    temp.setAttribute("position", arrays[pose].clone());
    temp.setAttribute("normal", normals[pose].clone());
    fairSurface(temp, {
      pairs: 4,
      limit: 0.0015,
      reverseWeight: -0.46,
      preserveFieldNormals: true,
      normalPasses: 0,
      weight: strength,
    });
    arrays[pose].array.set(temp.attributes.position.array);
    let data = normals[pose].array.slice();
    const p = arrays[pose].array;
    for (let pass = 0; pass < 8; pass++) {
      const next = data.slice();
      for (let i = 0; i < links.length; i++) {
        const k = i * 3,
          mix = 0.5 * strength(p[k], p[k + 1], p[k + 2]);
        if (!mix) continue;
        let nx = 0,
          ny = 0,
          nz = 0,
          sum = 0;
        for (const j of links[i]) {
          const q = j * 3,
            dot =
              data[k] * data[q] +
              data[k + 1] * data[q + 1] +
              data[k + 2] * data[q + 2];
          const w = smooth(dot, 0.85, 0.995);
          nx += w * data[q];
          ny += w * data[q + 1];
          nz += w * data[q + 2];
          sum += w;
        }
        if (!sum) continue;
        nx = data[k] * (1 - mix) + (mix * nx) / sum;
        ny = data[k + 1] * (1 - mix) + (mix * ny) / sum;
        nz = data[k + 2] * (1 - mix) + (mix * nz) / sum;
        const len = Math.hypot(nx, ny, nz) || 1;
        next[k] = nx / len;
        next[k + 1] = ny / len;
        next[k + 2] = nz / len;
      }
      data = next;
    }
    normals[pose].array.set(data);
    temp.dispose();
  }
  return g;
}
