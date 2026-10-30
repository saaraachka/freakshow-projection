import * as THREE from "../../character-3d/vendor/three.module.js";
// Shared-edge marching tetrahedra for the groom's branching curl volumes.
// It resolves multiple surface sheets in a cell instead of collapsing an
// ambiguous dual-grid vertex through a thin curl fold.
export function volumeMesh(
  field,
  color,
  {
    step = 0.036,
    lo = [-1.54, -1.03, -1.85],
    hi = [1.57, 1.91, 1.0],
    postprocess = true,
    refineEdges = false,
  } = {},
) {
  const [nx, ny, nz] = hi.map((v, i) => Math.ceil((v - lo[i]) / step)),
    sx = nx + 1,
    plane = sx * (ny + 1),
    at = (x, y, z) => x + y * sx + z * plane;
  const values = new Float32Array(plane * (nz + 1));
  for (let z = 0; z <= nz; z++)
    for (let y = 0; y <= ny; y++)
      for (let x = 0; x <= nx; x++)
        values[at(x, y, z)] =
          field(lo[0] + x * step, lo[1] + y * step, lo[2] + z * step) + 1e-7;
  const offsets = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ];
  const tetra = [
      [0, 5, 1, 6],
      [0, 1, 2, 6],
      [0, 2, 3, 6],
      [0, 3, 7, 6],
      [0, 7, 4, 6],
      [0, 4, 5, 6],
    ],
    edges = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
  const positions = [],
    linearPositions = [],
    indices = [],
    cache = new Map(),
    total = values.length;
  function vertex(a, b, pa, pb, va, vb) {
    const key = a < b ? a * total + b : b * total + a;
    if (cache.has(key)) return cache.get(key);
    let t = va / (va - vb);
    const linearT = t;
    if (refineEdges) {
      // Keep each vertex on its own grid edge. Bracketed roots resolve the
      // curved channel accurately without projecting through another sheet.
      let lo = 0,
        hi = 1;
      for (let pass = 0; pass < 7; pass++) {
        const f = field(
          pa.x + (pb.x - pa.x) * t,
          pa.y + (pb.y - pa.y) * t,
          pa.z + (pb.z - pa.z) * t,
        );
        if (f < 0 === va < 0) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    const id = positions.length / 3;
    linearPositions.push(
      pa.x + (pb.x - pa.x) * linearT,
      pa.y + (pb.y - pa.y) * linearT,
      pa.z + (pb.z - pa.z) * linearT,
    );
    positions.push(
      pa.x + (pb.x - pa.x) * t,
      pa.y + (pb.y - pa.y) * t,
      pa.z + (pb.z - pa.z) * t,
    );
    cache.set(key, id);
    return id;
  }
  // Order each tetrahedron using its coplanar LINEAR cuts. Refining edge
  // roots bends the quad; sorting those noncoplanar points can break adjacency.
  const point = (i) => new THREE.Vector3().fromArray(linearPositions, i * 3);
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const ids = offsets.map(([a, b, c]) => at(x + a, y + b, z + c)),
          v = ids.map((i) => values[i]);
        if (v.every((n) => n >= 0) || v.every((n) => n < 0)) continue;
        const p = offsets.map(
          ([a, b, c]) =>
            new THREE.Vector3(
              lo[0] + (x + a) * step,
              lo[1] + (y + b) * step,
              lo[2] + (z + c) * step,
            ),
        );
        for (const t of tetra) {
          const inside = t.filter((i) => v[i] < 0),
            outside = t.filter((i) => v[i] >= 0);
          if (!inside.length || !outside.length) continue;
          const dir = new THREE.Vector3();
          inside.forEach((i) => dir.addScaledVector(p[i], -1 / inside.length));
          outside.forEach((i) => dir.addScaledVector(p[i], 1 / outside.length));
          dir.normalize();
          const cuts = [];
          for (const [a, b] of edges) {
            const i = t[a],
              j = t[b];
            if (v[i] < 0 !== v[j] < 0)
              cuts.push(vertex(ids[i], ids[j], p[i], p[j], v[i], v[j]));
          }
          const center = new THREE.Vector3();
          cuts.forEach((i) =>
            center.addScaledVector(point(i), 1 / cuts.length),
          );
          const u = point(cuts[0]).sub(center).normalize(),
            w = new THREE.Vector3().crossVectors(dir, u).normalize();
          cuts.sort((a, b) => {
            const p = point(a).sub(center),
              q = point(b).sub(center);
            return (
              Math.atan2(p.dot(w), p.dot(u)) - Math.atan2(q.dot(w), q.dot(u))
            );
          });
          for (let k = 1; k < cuts.length - 1; k++) {
            let a = cuts[0],
              b = cuts[k],
              c = cuts[k + 1];
            const normal = new THREE.Vector3().crossVectors(
              point(b).sub(point(a)),
              point(c).sub(point(a)),
            );
            if (normal.dot(dir) < 0) [b, c] = [c, b];
            indices.push(a, b, c);
          }
        }
      }
  // Retain the rooted groom component. Sub-voxel detached tips and an
  // unrooted curl are unwanted stray geometry, not part of the hairstyle.
  const parent = Int32Array.from({ length: positions.length / 3 }, (_, i) => i),
    find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
  for (let i = 0; i < indices.length; i += 3) {
    parent[find(indices[i])] = find(indices[i + 1]);
    parent[find(indices[i])] = find(indices[i + 2]);
  }
  const sizes = new Map();
  for (let i = 0; i < parent.length; i++) {
    const r = find(i);
    sizes.set(r, (sizes.get(r) || 0) + 1);
  }
  const largest = [...sizes].sort((a, b) => b[1] - a[1])[0][0],
    remap = new Map(),
    kept = [],
    nextIndices = [];
  for (let i = 0; i < indices.length; i += 3)
    if (find(indices[i]) === largest)
      for (let k = 0; k < 3; k++) {
        const old = indices[i + k];
        if (!remap.has(old)) {
          remap.set(old, kept.length / 3);
          kept.push(...positions.slice(old * 3, old * 3 + 3));
        }
        nextIndices.push(remap.get(old));
      }
  positions.length = 0;
  for (const v of kept) positions.push(v);
  indices.length = 0;
  for (const i of nextIndices) indices.push(i);
  const adjacent = Array.from(
    { length: positions.length / 3 },
    () => new Set(),
  );
  for (let i = 0; i < indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[i + k],
        b = indices[i + ((k + 1) % 3)];
      adjacent[a].add(b);
      adjacent[b].add(a);
    }
  let data = new Float32Array(positions);
  for (const weight of postprocess ? [0.28, -0.285, 0.18, -0.185] : []) {
    const next = data.slice();
    for (let i = 0; i < adjacent.length; i++)
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const j of adjacent[i]) sum += data[j * 3 + k];
        if (adjacent[i].size)
          next[i * 3 + k] +=
            weight * (sum / adjacent[i].size - data[i * 3 + k]);
      }
    data = next;
  }
  for (let pass = 0; pass < (postprocess ? 3 : 0); pass++)
    for (let i = 0; i < data.length; i += 3) {
      const x = data[i],
        y = data[i + 1],
        z = data[i + 2],
        e = 0.004,
        g = new THREE.Vector3(
          (field(x + e, y, z) - field(x - e, y, z)) / (2 * e),
          (field(x, y + e, z) - field(x, y - e, z)) / (2 * e),
          (field(x, y, z + e) - field(x, y, z - e)) / (2 * e),
        ),
        l = g.lengthSq();
      if (l > 0.02) {
        g.multiplyScalar(-field(x, y, z) / l).clampLength(0, 0.004);
        data[i] += g.x;
        data[i + 1] += g.y;
        data[i + 2] += g.z;
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const colors = [];
  for (let i = 0; i < data.length; i += 3)
    colors.push(...color(data[i], data[i + 1], data[i + 2]).toArray());
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.userData.discardedUnrootedComponents = sizes.size - 1;
  return geometry;
}
