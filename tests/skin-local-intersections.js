// Triangle/triangle check for the changed wall against retained skin. Shared
// vertices are intentional manifold adjacency and are excluded, not hidden hits.
export function localIntersections(P, T, weights) {
  const cell = 0.035,
    records = [],
    grid = new Map(),
    min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < weights.length; i++)
    if (weights[i] > 1e-6)
      for (let d = 0; d < 3; d++) {
        min[d] = Math.min(min[d], P[i * 3 + d] - 0.025);
        max[d] = Math.max(max[d], P[i * 3 + d] + 0.025);
      }
  const vector = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    eps = 1e-8;
  function segment(a, b, t) {
    const d = vector(a, b),
      e1 = vector(t[0], t[1]),
      e2 = vector(t[0], t[2]),
      h = cross(d, e2),
      det = dot(e1, h);
    if (Math.abs(det) < eps) return false;
    const s = vector(t[0], a),
      u = dot(s, h) / det;
    if (u < -eps || u > 1 + eps) return false;
    const q = cross(s, e1),
      v = dot(d, q) / det;
    if (v < -eps || u + v > 1 + eps) return false;
    const k = dot(e2, q) / det;
    return k > eps && k < 1 - eps;
  }
  function coplanar(a, b) {
    const n = cross(vector(a[0], a[1]), vector(a[0], a[2])),
      L = Math.hypot(...n);
    if (L < eps) return false;
    if (b.some((v) => Math.abs(dot(n, vector(a[0], v))) > 1e-7 * L))
      return false;
    let axis = 0;
    for (let d = 1; d < 3; d++)
      if (Math.abs(n[d]) > Math.abs(n[axis])) axis = d;
    const project = (p) => p.filter((_, i) => i !== axis),
      A = a.map(project),
      B = b.map(project),
      orient = (a, b, c) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, t) => {
      const q = [
        orient(t[0], t[1], p),
        orient(t[1], t[2], p),
        orient(t[2], t[0], p),
      ];
      return q.every((x) => x > eps) || q.every((x) => x < -eps);
    };
    if (A.some((p) => inside(p, B)) || B.some((p) => inside(p, A))) return true;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const a = A[i],
          b = A[(i + 1) % 3],
          c = B[j],
          d = B[(j + 1) % 3];
        if (
          orient(a, b, c) * orient(a, b, d) < -eps &&
          orient(c, d, a) * orient(c, d, b) < -eps
        )
          return true;
      }
    return false;
  }
  for (let i = 0; i < T.length; i += 3) {
    const ids = [T[i], T[i + 1], T[i + 2]],
      p = ids.map((k) => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]),
      lo = [0, 1, 2].map((d) => Math.min(...p.map((q) => q[d]))),
      hi = [0, 1, 2].map((d) => Math.max(...p.map((q) => q[d])));
    if (lo.some((x, d) => x > max[d]) || hi.some((x, d) => x < min[d]))
      continue;
    const r = {
        id: i / 3,
        ids,
        p,
        lo,
        hi,
        changed: ids.some((k) => weights[k] > 1e-6),
      },
      index = records.length;
    records.push(r);
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++)
      for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++)
        for (
          let z = Math.floor(lo[2] / cell);
          z <= Math.floor(hi[2] / cell);
          z++
        ) {
          const key = x + "," + y + "," + z;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(index);
        }
  }
  const checked = new Set(),
    hits = [];
  let candidates = 0;
  for (const list of grid.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const ai = Math.min(list[i], list[j]),
          bi = Math.max(list[i], list[j]),
          key = ai + ":" + bi;
        if (checked.has(key)) continue;
        checked.add(key);
        const a = records[ai],
          b = records[bi];
        if (
          (!a.changed && !b.changed) ||
          a.ids.some((v) => b.ids.includes(v)) ||
          a.lo.some((x, d) => x > b.hi[d] + eps) ||
          a.hi.some((x, d) => x < b.lo[d] - eps)
        )
          continue;
        candidates++;
        let hit = false;
        for (let k = 0; k < 3; k++)
          if (
            segment(a.p[k], a.p[(k + 1) % 3], b.p) ||
            segment(b.p[k], b.p[(k + 1) % 3], a.p)
          )
            hit = true;
        if (!hit) hit = coplanar(a.p, b.p);
        if (hit) hits.push([a.id, b.id]);
      }
  return {
    scope:
      "Changed tooth-neck wall against retained skin; shared-vertex adjacency excluded",
    triangles: records.length,
    candidatePairs: candidates,
    intersections: hits.length,
    examples: hits.slice(0, 10),
  };
}
