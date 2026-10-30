import * as THREE from "../../character-3d/vendor/three.module.js";
// Bounded Taubin fairing of the existing indexed surface. No remeshing,
// added support geometry, density increase, or replacement curl construction.
export function fairSurface(
  g,
  {
    pairs,
    limit,
    preserveFieldNormals = false,
    normalPasses = 0,
    reverseWeight = -0.49,
    weight = () => 1,
  },
) {
  const p = g.attributes.position,
    original = p.array.slice(),
    ix = g.index.array;
  const links = Array.from({ length: p.count }, () => new Set());
  for (let t = 0; t < ix.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = ix[t + k],
        b = ix[t + ((k + 1) % 3)];
      links[a].add(b);
      links[b].add(a);
    }
  const mask = Float32Array.from({ length: p.count }, (_, i) =>
    weight(...original.slice(i * 3, i * 3 + 3)),
  );
  let data = original.slice();
  for (let pass = 0; pass < pairs; pass++)
    for (const lambda of [0.48, reverseWeight]) {
      const next = data.slice();
      for (let i = 0; i < p.count; i++) {
        if (!mask[i] || !links[i].size) continue;
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (const j of links[i]) sum += data[j * 3 + k];
          next[i * 3 + k] +=
            lambda * mask[i] * (sum / links[i].size - data[i * 3 + k]);
        }
        const d = Math.hypot(
          ...[0, 1, 2].map((k) => next[i * 3 + k] - original[i * 3 + k]),
        );
        const bound = limit * mask[i];
        if (d > bound)
          for (let k = 0; k < 3; k++)
            next[i * 3 + k] =
              original[i * 3 + k] +
              ((next[i * 3 + k] - original[i * 3 + k]) * bound) / d;
      }
      data = next;
    }
  // Reject local moves that turn a source triangle over or collapse its area.
  const a = new THREE.Vector3(),
    b = a.clone(),
    c = a.clone(),
    n = a.clone(),
    m = a.clone();
  let rejected = 0;
  for (let pass = 0; pass < 64; pass++) {
    const bad = new Set();
    for (let t = 0; t < ix.length; t += 3) {
      const ids = [ix[t], ix[t + 1], ix[t + 2]];
      const cross = (array, out) => {
        a.fromArray(array, ids[0] * 3);
        b.fromArray(array, ids[1] * 3).sub(a);
        c.fromArray(array, ids[2] * 3).sub(a);
        out.crossVectors(b, c);
      };
      cross(original, n);
      cross(data, m);
      if (
        n.lengthSq() > 1e-24 &&
        (n.dot(m) <= 0 || m.lengthSq() < n.lengthSq() * 0.04)
      )
        for (const id of ids) bad.add(id);
    }
    if (!bad.size) break;
    rejected += bad.size;
    for (const id of bad)
      for (let k = 0; k < 3; k++) data[id * 3 + k] = original[id * 3 + k];
    if (pass === 63)
      throw Error("Fairing could not preserve triangle orientation");
  }
  let maxDisplacement = 0;
  for (let i = 0; i < p.count; i++)
    maxDisplacement = Math.max(
      maxDisplacement,
      Math.hypot(
        ...[0, 1, 2].map((k) => data[i * 3 + k] - original[i * 3 + k]),
      ),
    );
  p.array.set(data);
  p.needsUpdate = true;
  if (!preserveFieldNormals) {
    // Corner-angle weighting avoids skinny CSG triangles dominating a normal.
    const normals = new Float32Array(data.length),
      va = new THREE.Vector3(),
      vb = va.clone(),
      face = va.clone();
    for (let t = 0; t < ix.length; t += 3) {
      const ids = [ix[t], ix[t + 1], ix[t + 2]];
      a.fromArray(data, ids[0] * 3);
      b.fromArray(data, ids[1] * 3);
      c.fromArray(data, ids[2] * 3);
      face.crossVectors(va.subVectors(b, a), vb.subVectors(c, a));
      if (face.lengthSq() < 1e-24) continue;
      face.normalize();
      for (let k = 0; k < 3; k++) {
        a.fromArray(data, ids[k] * 3);
        b.fromArray(data, ids[(k + 1) % 3] * 3);
        c.fromArray(data, ids[(k + 2) % 3] * 3);
        va.subVectors(b, a).normalize();
        vb.subVectors(c, a).normalize();
        const angle = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
        for (let j = 0; j < 3; j++)
          normals[ids[k] * 3 + j] += face.getComponent(j) * angle;
      }
    }
    for (let i = 0; i < normals.length; i += 3) {
      a.fromArray(normals, i).normalize().toArray(normals, i);
    }
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }
  // Smooth custom normals independently of triangle area; actual vertex
  // fairing above remains bounded and is validated before this shading step.
  let normals = g.attributes.normal.array;
  for (let pass = 0; pass < normalPasses; pass++) {
    const next = normals.slice();
    for (let i = 0; i < p.count; i++) {
      a.fromArray(normals, i * 3).multiplyScalar(0.65);
      b.set(0, 0, 0);
      for (const j of links[i]) b.add(c.fromArray(normals, j * 3));
      if (links[i].size) a.addScaledVector(b, 0.35 / links[i].size);
      a.normalize().toArray(next, i * 3);
    }
    normals = next;
  }
  if (normalPasses)
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.userData.fairing = {
    pairs,
    limit,
    maxDisplacement,
    rejected,
    topologyPreserved: true,
  };
  return g;
}
