import * as THREE from "../character-3d/vendor/three.module.js";
// Dual-grid surface nets: one vertex per intersected cell, shared indexed quads.
// Unlike tetrahedral soup this produces compact, regular topology and permits
// a restrained volume-preserving relaxation without raising the sample count.
export function surfaceNets(
  field,
  column,
  color,
  { step = 0.02, lo = [-1.42, -1.28, -1.13], hi = [1.42, 1.31, 1.16] } = {},
) {
  const n = hi.map((v, i) => Math.ceil((v - lo[i]) / step)),
    [nx, ny, nz] = n;
  const sx = nx + 1,
    sy = ny + 1,
    plane = sx * sy,
    at = (x, y, z) => x + y * sx + z * plane;
  const f = new Float32Array(plane * (nz + 1));
  for (let y = 0; y <= ny; y++)
    for (let x = 0; x <= nx; x++) {
      const xx = lo[0] + x * step,
        yy = lo[1] + y * step,
        c = column(xx, yy);
      for (let z = 0; z <= nz; z++)
        f[at(x, y, z)] = field(xx, yy, lo[2] + z * step, c);
    }
  const cells = new Int32Array(nx * ny * nz).fill(-1),
    cell = (x, y, z) => x + nx * (y + ny * z);
  const offsets = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
    edges = [];
  for (let i = 0; i < 8; i++)
    for (let a = 0; a < 3; a++) {
      const j = i ^ (1 << a);
      if (j > i) edges.push([i, j]);
    }
  const vertices = [];
  let indices = [];
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        const v = offsets.map(([dx, dy, dz]) => f[at(x + dx, y + dy, z + dz)]);
        if (v.every((a) => a >= 0) || v.every((a) => a < 0)) continue;
        const p = [0, 0, 0];
        let hits = 0;
        for (const [a, b] of edges)
          if (v[a] < 0 !== v[b] < 0) {
            const t = v[a] / (v[a] - v[b]);
            hits++;
            for (let k = 0; k < 3; k++)
              p[k] += offsets[a][k] + t * (offsets[b][k] - offsets[a][k]);
          }
        cells[cell(x, y, z)] = vertices.length / 3;
        for (let k = 0; k < 3; k++)
          vertices.push(lo[k] + ([x, y, z][k] + p[k] / hits) * step);
      }
  const quad = (ids, flip) => {
    if (ids.some((i) => i < 0)) return;
    if (flip) ids.reverse();
    indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
  };
  for (let z = 1; z < nz; z++)
    for (let y = 1; y < ny; y++)
      for (let x = 1; x < nx; x++) {
        const v = f[at(x, y, z)];
        if (v < 0 !== f[at(x + 1, y, z)] < 0)
          quad(
            [
              cells[cell(x, y, z)],
              cells[cell(x, y - 1, z)],
              cells[cell(x, y - 1, z - 1)],
              cells[cell(x, y, z - 1)],
            ],
            v >= 0,
          );
        if (v < 0 !== f[at(x, y + 1, z)] < 0)
          quad(
            [
              cells[cell(x, y, z)],
              cells[cell(x, y, z - 1)],
              cells[cell(x - 1, y, z - 1)],
              cells[cell(x - 1, y, z)],
            ],
            v >= 0,
          );
        if (v < 0 !== f[at(x, y, z + 1)] < 0)
          quad(
            [
              cells[cell(x, y, z)],
              cells[cell(x - 1, y, z)],
              cells[cell(x - 1, y - 1, z)],
              cells[cell(x, y - 1, z)],
            ],
            v >= 0,
          );
      }
  // Surface nets can produce a four-face edge when a thin fold crosses a grid
  // face twice. Collapse only these subvoxel saddles, then separate vertex fans.
  // This is topology repair, not indiscriminate smoothing of facial landmarks.
  let saddleCollapses = 0;
  for (let pass = 0; pass < 8; pass++) {
    const edgeMap = new Map();
    for (let i = 0; i < indices.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const a = indices[i + k],
          b = indices[i + ((k + 1) % 3)],
          key = a < b ? a + ":" + b : b + ":" + a;
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    const bad = [...edgeMap].filter(([, count]) => count > 2);
    if (!bad.length) break;
    const remap = Int32Array.from({ length: vertices.length / 3 }, (_, i) => i);
    const find = (i) => {
      while (remap[i] !== i) i = remap[i];
      return i;
    };
    for (const [key] of bad) {
      let [a, b] = key.split(":").map(Number);
      a = find(a);
      b = find(b);
      if (a === b) continue;
      const length = Math.hypot(
        ...[0, 1, 2].map((k) => vertices[a * 3 + k] - vertices[b * 3 + k]),
      );
      if (length > step * 1.25)
        throw new Error("Unresolved large remeshing saddle");
      for (let k = 0; k < 3; k++)
        vertices[a * 3 + k] = (vertices[a * 3 + k] + vertices[b * 3 + k]) * 0.5;
      remap[b] = a;
      saddleCollapses++;
    }
    const next = [],
      seen = new Set();
    for (let i = 0; i < indices.length; i += 3) {
      const tri = indices.slice(i, i + 3).map(find);
      if (new Set(tri).size < 3) continue;
      const key = tri
        .slice()
        .sort((a, b) => a - b)
        .join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(...tri);
    }
    indices = next;
  }
  // Split disjoint triangle fans at a vertex. Edge incidence alone cannot detect
  // a bow-tie vertex after a subvoxel tunnel closes.
  const incident = Array.from({ length: vertices.length / 3 }, () => []);
  for (let i = 0; i < indices.length; i += 3)
    for (let k = 0; k < 3; k++) incident[indices[i + k]].push(i);
  for (let v = 0; v < incident.length; v++) {
    const pending = new Set(incident[v]);
    let first = true;
    while (pending.size) {
      const start = pending.values().next().value,
        stack = [start],
        fan = [];
      pending.delete(start);
      while (stack.length) {
        const t = stack.pop();
        fan.push(t);
        const neighbors = indices.slice(t, t + 3).filter((k) => k !== v);
        for (const other of pending)
          if (
            neighbors.some((k) => indices.slice(other, other + 3).includes(k))
          ) {
            pending.delete(other);
            stack.push(other);
          }
      }
      if (first) {
        first = false;
        continue;
      }
      const copy = vertices.length / 3;
      vertices.push(...vertices.slice(v * 3, v * 3 + 3));
      for (const t of fan)
        for (let k = 0; k < 3; k++)
          if (indices[t + k] === v) indices[t + k] = copy;
    }
  }
  // Compact unused vertices left by saddle collapses.
  const used = new Map(),
    compact = [];
  indices = indices.map((i) => {
    if (!used.has(i)) {
      used.set(i, compact.length / 3);
      compact.push(...vertices.slice(i * 3, i * 3 + 3));
    }
    return used.get(i);
  });
  vertices.length = 0;
  for (const value of compact) vertices.push(value);
  const adjacent = Array.from({ length: vertices.length / 3 }, () => new Set());
  for (let i = 0; i < indices.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = indices[i + k],
        b = indices[i + ((k + 1) % 3)];
      adjacent[a].add(b);
      adjacent[b].add(a);
    }
  let data = new Float32Array(vertices);
  // Taubin pair: suppress voxel ripples while retaining thin lids and creases.
  for (const weight of [0.34, -0.345, 0.28, -0.285, 0.18, -0.185]) {
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
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data, 3));
  g.setIndex(indices);
  const normals = [],
    epsilon = 0.002;
  for (let i = 0; i < data.length; i += 3) {
    const [x, y, z] = data.slice(i, i + 3),
      n = new THREE.Vector3(
        field(x + epsilon, y, z) - field(x - epsilon, y, z),
        field(x, y + epsilon, z) - field(x, y - epsilon, z),
        field(x, y, z + epsilon) - field(x, y, z - epsilon),
      ).normalize();
    normals.push(...n.toArray());
  }
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  const colors = [];
  for (let i = 0; i < data.length; i += 3)
    colors.push(...color(data[i], data[i + 1], data[i + 2]).toArray());
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.userData.saddleCollapses = saddleCollapses;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
