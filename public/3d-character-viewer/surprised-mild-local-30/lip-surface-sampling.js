import * as THREE from "../../character-3d/vendor/three.module.js";
// Refine only stretched oral edges. Every added vertex is an exact interpolation
// of the CURRENT source and its existing three targets: the jaw and head are not
// resculpted. Conforming edge splits avoid T-junctions at the patch boundary.
export function refineLipSampling(g) {
  const originalCount = g.attributes.position.count,
    fields = [];
  for (const [name, a] of Object.entries(g.attributes))
    fields.push({
      kind: "attribute",
      name,
      size: a.itemSize,
      data: Array.from(a.array),
    });
  for (const [name, attrs] of Object.entries(g.morphAttributes))
    for (let i = 0; i < attrs.length; i++)
      fields.push({
        kind: "morph",
        name,
        i,
        size: attrs[i].itemSize,
        data: Array.from(attrs[i].array),
      });
  const base = fields.find(
      (v) => v.kind === "attribute" && v.name === "position",
    ).data,
    targets = fields
      .filter((v) => v.kind === "morph" && v.name === "position")
      .map((v) => v.data),
    parents = [];
  let index = Array.from(g.index.array),
    passes = 0;
  const key = (a, b) => (a < b ? a + ":" + b : b + ":" + a);
  for (let pass = 0; pass < 4; pass++) {
    const split = new Map(),
      limit = 0.018;
    for (let i = 0; i < index.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const a = index[i + k],
          b = index[i + ((k + 1) % 3)],
          x = 0.5 * (base[a * 3] + base[b * 3]),
          y = 0.5 * (base[a * 3 + 1] + base[b * 3 + 1]),
          z = 0.5 * (base[a * 3 + 2] + base[b * 3 + 2]);
        if (Math.abs(x) > 0.8 || y > -0.16 || y < -0.85 || z < 0.25) continue;
        let max = 0;
        for (const pose of [base, targets[0], targets[1]])
          max = Math.max(
            max,
            Math.hypot(
              ...[0, 1, 2].map((k) => pose[a * 3 + k] - pose[b * 3 + k]),
            ),
          );
        if (max > limit) split.set(key(a, b), [a, b]);
      }
    if (!split.size) break;
    passes++;
    const mids = new Map();
    for (const [e, [a, b]] of split) {
      const id = base.length / 3;
      for (const f of fields)
        for (let k = 0; k < f.size; k++)
          f.data.push(0.5 * (f.data[a * f.size + k] + f.data[b * f.size + k]));
      mids.set(e, id);
      parents.push([a, b]);
    }
    const next = [];
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = index.slice(i, i + 3),
        ab = mids.get(key(a, b)),
        bc = mids.get(key(b, c)),
        ca = mids.get(key(c, a)),
        mask =
          (ab !== undefined ? 1 : 0) |
          (bc !== undefined ? 2 : 0) |
          (ca !== undefined ? 4 : 0);
      if (mask === 0) next.push(a, b, c);
      if (mask === 1) next.push(a, ab, c, ab, b, c);
      if (mask === 2) next.push(a, b, bc, a, bc, c);
      if (mask === 4) next.push(a, b, ca, b, c, ca);
      if (mask === 3) next.push(b, bc, ab, a, ab, c, ab, bc, c);
      if (mask === 5) next.push(a, ab, ca, b, c, ca, b, ca, ab);
      if (mask === 6) next.push(c, ca, bc, a, b, bc, a, bc, ca);
      if (mask === 7) next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    index = next;
  }
  for (const f of fields) {
    const a = new THREE.Float32BufferAttribute(f.data, f.size);
    if (f.kind === "attribute") g.setAttribute(f.name, a);
    else g.morphAttributes[f.name][f.i] = a;
  }
  g.setIndex(index);
  g.userData.lipSampling = {
    originalCount,
    addedVertices: base.length / 3 - originalCount,
    passes,
    parents,
    edgeLimit: 0.018,
    baselinePreserved: true,
  };
  return g;
}
