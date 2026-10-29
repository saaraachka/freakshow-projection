// Pure numerical audit for a deformed shared triangle surface. Visual review
// remains a separate release gate: closed edges do not prove a good sculpt.
export function auditSurface(
  position,
  index,
  region = { minY: -1.25, maxY: -0.12, minZ: -0.35, maxX: 0.91 },
) {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  const point = (i) => [
      position[i * 3],
      position[i * 3 + 1],
      position[i * 3 + 2],
    ],
    triangles = [],
    edges = new Map();
  let degenerate = 0;
  for (let t = 0; t < index.length; t += 3) {
    const ids = [index[t], index[t + 1], index[t + 2]],
      p = ids.map(point),
      c = add(add(p[0], p[1]), p[2]).map((v) => v / 3);
    for (let k = 0; k < 3; k++) {
      const a = ids[k],
        b = ids[(k + 1) % 3],
        key = a < b ? a + ":" + b : b + ":" + a;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
    if (
      c[1] > region.maxY ||
      c[1] < region.minY ||
      c[2] < region.minZ ||
      Math.abs(c[0]) > region.maxX
    )
      continue;
    const area2 = dot(
      cross(sub(p[1], p[0]), sub(p[2], p[0])),
      cross(sub(p[1], p[0]), sub(p[2], p[0])),
    );
    if (area2 < 1e-20) {
      degenerate++;
      continue;
    }
    triangles.push({
      ids,
      p,
      min: [0, 1, 2].map((k) => Math.min(...p.map((v) => v[k]))),
      max: [0, 1, 2].map((k) => Math.max(...p.map((v) => v[k]))),
    });
  }
  const bins = new Map(),
    step = 0.045;
  for (let i = 0; i < triangles.length; i++) {
    const t = triangles[i],
      lo = t.min.map((v) => Math.floor(v / step)),
      hi = t.max.map((v) => Math.floor(v / step));
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const key = x + ":" + y + ":" + z;
          if (!bins.has(key)) bins.set(key, []);
          bins.get(key).push(i);
        }
  }
  const segmentTriangle = (a, b, p) => {
    const d = sub(b, a),
      e1 = sub(p[1], p[0]),
      e2 = sub(p[2], p[0]),
      h = cross(d, e2),
      det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det,
      s = sub(a, p[0]),
      u = inv * dot(s, h);
    if (u < 1e-6 || u > 1 - 1e-6) return false;
    const q = cross(s, e1),
      v = inv * dot(d, q);
    if (v < 1e-6 || u + v > 1 - 1e-6) return false;
    const t = inv * dot(e2, q);
    return t > 1e-6 && t < 1 - 1e-6;
  };
  const seen = new Set(),
    hits = [];
  let intersections = 0;
  for (const bin of bins.values())
    for (let i = 0; i < bin.length; i++)
      for (let j = i + 1; j < bin.length; j++) {
        const x = bin[i],
          y = bin[j],
          key = x * triangles.length + y;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = triangles[x],
          b = triangles[y];
        if (
          a.ids.some((i) => b.ids.includes(i)) ||
          [0, 1, 2].some(
            (k) => a.max[k] < b.min[k] - 1e-7 || b.max[k] < a.min[k] - 1e-7,
          )
        )
          continue;
        let hit = false;
        for (let k = 0; k < 3 && !hit; k++)
          hit =
            segmentTriangle(a.p[k], a.p[(k + 1) % 3], b.p) ||
            segmentTriangle(b.p[k], b.p[(k + 1) % 3], a.p);
        if (hit) {
          intersections++;
          if (hits.length < 6) hits.push({ a: a.ids, b: b.ids, point: a.p[0] });
        }
      }
  return {
    openOrNonManifoldEdges: [...edges.values()].filter((n) => n !== 2).length,
    degenerateMouthTriangles: degenerate,
    mouthIntersections: intersections,
    examples: hits,
  };
}
