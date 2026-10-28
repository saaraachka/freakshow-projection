import * as THREE from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "./vendor/BufferGeometryUtils.js";
const V = (a) => new THREE.Vector3(...a);
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}
// A groom is designed as named directional clumps. Each clump has its own root,
// sweep, curl plane and weight. No uniform scalp sampling or repeated ring mesh.
export function createSculptHair() {
  const random = seeded(1783),
    geometries = [],
    records = [];
  const palettes = [0x101925, 0x17202d, 0x1b2532].map(
    (c) => new THREE.Color(c),
  );
  // A recessed, carved undercoat joins the directional clumps. Its front half
  // stays inside the skull; only the irregular occipital surface can be seen.
  // This prevents bald gaps between clumps without a smooth exposed wig shell.
  const undercoat = new THREE.SphereGeometry(1, 80, 64),
    ua = undercoat.attributes.position,
    uc = [];
  for (let i = 0; i < ua.count; i++) {
    const sy = ua.getY(i),
      angle = Math.atan2(ua.getZ(i), ua.getX(i));
    const r = Math.sqrt(Math.max(0, 1 - sy * sy));
    const ridge =
      0.032 * Math.sin(angle * 11 + sy * 7) +
      0.018 * Math.sin(angle * 19 - sy * 11) +
      0.011 * Math.sin(angle * 31 + sy * 19);
    const back = Math.max(0, -Math.sin(angle));
    const rx = 0.865 + ridge * 0.8,
      rz = 0.465 + ridge * back;
    ua.setXYZ(
      i,
      ua.getX(i) * rx,
      0.13 + sy * 1.02,
      -0.37 - 0.12 * (1 - sy * sy) + ua.getZ(i) * rz,
    );
    uc.push(...palettes[0].toArray());
  }
  undercoat.setAttribute("color", new THREE.Float32BufferAttribute(uc, 3));
  undercoat.deleteAttribute("uv");
  undercoat.computeVertexNormals();
  geometries.push(undercoat);
  function lock(points, width, depth, seed, kind = "secondary") {
    const curve = new THREE.CatmullRomCurve3(
        points.map((a) => {
          const p = V(a);
          if (p.y > 0.8) p.y = 0.8 + (p.y - 0.8) * 0.72;
          const earMask =
            THREE.MathUtils.smoothstep(Math.abs(p.x), 0.8, 0.94) *
            THREE.MathUtils.smoothstep(p.y, -0.42, -0.28) *
            (1 - THREE.MathUtils.smoothstep(p.y, 0.34, 0.53));
          if (p.z > -0.35 - width)
            p.z = THREE.MathUtils.lerp(p.z, -0.35 - width, earMask);
          return p;
        }),
      ),
      steps = kind === "flyaway" ? 20 : 34,
      radial = kind === "flyaway" ? 5 : kind === "primary" ? 10 : 8;
    const frames = curve.computeFrenetFrames(steps, false),
      positions = [],
      indices = [],
      colors = [],
      shade = palettes[Math.floor(random() * 3)];
    const bendCaps = [];
    for (let i = 0; i <= steps; i++) {
      const first = Math.max(0, i - 1),
        last = Math.min(steps, i + 1);
      const angle = Math.acos(
        THREE.MathUtils.clamp(
          frames.tangents[first].dot(frames.tangents[last]),
          -1,
          1,
        ),
      );
      bendCaps.push(
        ((curve.getLength() * (last - first)) /
          steps /
          Math.max(0.001, angle)) *
          0.44,
      );
    }
    // Fair cross-section size over neighboring samples to avoid abrupt necks.
    const fairCaps = bendCaps.map((_, i) =>
      Math.min(
        ...bendCaps.slice(Math.max(0, i - 2), Math.min(steps + 1, i + 3)),
      ),
    );
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        p = curve.getPointAt(t),
        taper =
          (0.045 + 0.955 * THREE.MathUtils.smoothstep(t, 0, 0.19)) *
          (0.94 + 0.16 * Math.sin(t * Math.PI)) *
          (0.025 + 0.975 * (1 - t ** 3.3));
      const safeWidth = Math.min(width * taper, fairCaps[i]),
        safeDepth = Math.min(depth * taper, fairCaps[i]);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2,
          twist = 0.65 * Math.sin(t * 4 + seed),
          b = a + twist;
        // Grooved, flattened clumps rather than round hoses. Lobe ridges follow root flow.
        const ridge =
          1 +
          0.12 * Math.cos(a * 3 + t * 5 + seed) +
          0.04 * Math.sin(a * 5 - t * 3);
        const q = p
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(b) * safeWidth * ridge)
          .addScaledVector(
            frames.binormals[i],
            Math.sin(b) * safeDepth * (1 + 0.14 * Math.sin(t * 11 + seed)),
          );
        positions.push(...q.toArray());
        colors.push(...shade.toArray());
        if (i < steps && j < radial) {
          const k = i * (radial + 1) + j;
          indices.push(
            k,
            k + radial + 1,
            k + 1,
            k + 1,
            k + radial + 1,
            k + radial + 2,
          );
        }
      }
    }
    // Closed root and tapered tip: solid sections from every viewing angle.
    for (let j = 1; j < radial - 1; j++) {
      indices.push(0, j + 1, j);
      const k = steps * (radial + 1);
      indices.push(k, k + j, k + j + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices.map((_, i) => indices[i - (i % 3) + 2 - (i % 3)]));
    const closed = mergeVertices(g, 1e-6);
    closed.computeVertexNormals();
    geometries.push(closed);
    g.dispose();
    records.push({
      kind,
      width,
      depth,
      length: curve.getLength(),
      root: points[0],
      tip: points.at(-1),
      guide: points,
    });
  }
  function cluster(guide, width, count, seed) {
    lock(guide, width, width * 0.83, seed, "primary");
    const c = new THREE.CatmullRomCurve3(guide.map(V)),
      frame = c.computeFrenetFrames(48, false);
    for (let j = 0; j < count; j++) {
      const phase = random() * 6.28,
        scale = 0.45 + random() * 0.65,
        pts = [],
        curl = 0.032 + random() * 0.055,
        turn = 0.8 + random() * 1.7,
        end = 0.79 + random() * 0.21;
      for (let i = 0; i <= 32; i++) {
        const t = i / 32,
          p = c.getPointAt(t * end),
          k = Math.min(48, Math.round(t * end * 48));
        const angle = phase + turn * t * Math.PI * 2;
        p.addScaledVector(
          frame.normals[k],
          width * (j / count - 0.5) * 1.75 +
            curl * Math.sin(angle) * Math.sin(t * Math.PI),
        );
        p.addScaledVector(
          frame.binormals[k],
          (0.02 + width * 0.32) * Math.cos(phase) +
            curl * Math.cos(angle) * Math.sin(t * Math.PI),
        );
        pts.push(p.toArray());
      }
      lock(pts, width * 0.36 * scale, width * 0.29 * scale, seed + j + 0.3);
    }
  }
  // The asymmetric quiff is the primary identifying silhouette, with a loose hook
  // over one temple. Each path is intentionally authored, including its return.
  cluster(
    [
      [0.57, 0.78, 0.22],
      [0.62, 1.12, 0.3],
      [0.36, 1.39, 0.37],
      [0.03, 1.4, 0.44],
      [-0.23, 1.18, 0.48],
      [-0.12, 1.02, 0.51],
      [0.02, 1.13, 0.5],
    ],
    0.126,
    7,
    1,
  );
  cluster(
    [
      [0.73, 0.65, 0.13],
      [0.92, 1.08, 0.16],
      [0.83, 1.39, 0.17],
      [0.59, 1.47, 0.16],
      [0.44, 1.32, 0.17],
      [0.57, 1.24, 0.2],
    ],
    0.144,
    7,
    4,
  );
  cluster(
    [
      [-0.67, 0.62, 0.15],
      [-0.91, 0.94, 0.18],
      [-0.87, 1.25, 0.19],
      [-0.55, 1.32, 0.25],
      [-0.39, 1.19, 0.32],
    ],
    0.139,
    6,
    9,
  );
  cluster(
    [
      [-0.73, 0.57, 0.18],
      [-0.91, 0.87, 0.22],
      [-1.08, 0.78, 0.17],
      [-1.1, 0.6, 0.09],
      [-0.96, 0.55, 0.1],
      [-0.93, 0.66, 0.12],
    ],
    0.107,
    6,
    14,
  );
  cluster(
    [
      [0.78, 0.6, 0.06],
      [1.02, 0.94, 0.11],
      [1.18, 0.89, 0.11],
      [1.23, 0.68, 0.1],
      [1.08, 0.6, 0.13],
    ],
    0.132,
    7,
    17,
  );
  // Back: unequal scalloped falls, changing root direction and curl tightness.
  for (let band = 0; band < 4; band++)
    for (let j = 0; j < 7; j++) {
      const a =
          (j / 6 - 0.5) * 2.8 + band * 0.16 + 0.07 * Math.sin(j * 2.5 + band),
        x = Math.sin(a),
        z = -Math.cos(a),
        y = 0.79 - band * 0.405 + 0.05 * Math.sin(j * 2 + band);
      const root = [
        x * [0.66, 0.8, 0.81, 0.7][band],
        y,
        z * [0.65, 0.78, 0.78, 0.65][band] - 0.1,
      ];
      const outward = 0.15 + random() * 0.12,
        drop = 0.27 + random() * 0.24,
        swirl = random() > 0.45 ? 1 : -1,
        r = 0.1 + random() * 0.09;
      const points = [
        root,
        [root[0] * (1 + outward), y + 0.11, root[2] - 0.15],
        [root[0] * (1 + outward) + swirl * r, y - 0.1, root[2] - 0.19],
        [root[0] * (1 + outward) + swirl * r * 0.8, y - drop, root[2] - 0.12],
        [
          root[0] * (1 + outward) - swirl * r * 0.3,
          y - drop - 0.025,
          root[2] - 0.015,
        ],
        [
          root[0] * (1 + outward) - swirl * r * 0.5,
          y - drop + 0.1,
          root[2] - 0.04,
        ],
      ];
      cluster(
        points,
        0.1 + random() * 0.06,
        4 + Math.floor(random() * 3),
        20 + band * 7 + j,
      );
    }
  // Staggered central occipital falls close the sparse seam between side masses.
  cluster(
    [
      [0, 0.85, -0.65],
      [0.18, 0.65, -0.98],
      [0.16, 0.35, -1.09],
      [-0.05, 0.1, -1.03],
      [-0.13, 0.28, -0.96],
    ],
    0.14,
    6,
    91,
  );
  cluster(
    [
      [-0.14, 0.25, -0.87],
      [-0.31, 0.1, -1.05],
      [-0.25, -0.3, -1.1],
      [0.05, -0.42, -0.97],
      [0.14, -0.23, -0.91],
    ],
    0.15,
    6,
    92,
  );
  cluster(
    [
      [0.02, -0.2, -0.8],
      [0.22, -0.4, -0.96],
      [0.2, -0.75, -0.97],
      [-0.04, -0.85, -0.84],
      [-0.13, -0.69, -0.8],
    ],
    0.135,
    6,
    93,
  );
  // Interlocking crown masses bridge the quiff and occipital falls.
  for (let j = 0; j < 7; j++) {
    const a = (j / 6 - 0.5) * 2.65,
      x = Math.sin(a),
      z = -Math.cos(a);
    cluster(
      [
        [x * 0.4, 1.06, z * 0.35 - 0.08],
        [x * 0.66, 1.27, z * 0.55 - 0.09],
        [x * 0.83, 1.12, z * 0.76 - 0.12],
        [x * 0.75, 0.86, z * 0.85 - 0.12],
        [x * 0.6, 0.82, z * 0.78 - 0.08],
      ],
      0.13 + random() * 0.035,
      5,
      80 + j,
    );
  }
  // Unequal sideburn wisps curl forward below the ear, not through its concha.
  for (const s of [-1, 1]) {
    cluster(
      [
        [s * 0.82, 0.12, -0.18],
        [s * 1.01, -0.24, -0.24],
        [s * 1.09, -0.56, -0.13],
        [s * 0.99, -0.78, 0.02],
        [s * 0.87, -0.69, 0.1],
      ],
      s < 0 ? 0.11 : 0.14,
      7,
      s + 49,
    );
    cluster(
      [
        [s * 0.73, -0.22, -0.39],
        [s * 0.96, -0.55, -0.4],
        [s * 1.02, -0.91, -0.24],
        [s * 0.83, -1.02, -0.03],
        [s * 0.76, -0.89, 0.02],
      ],
      0.1,
      5,
      s + 54,
    );
  }
  // Sparse fine silhouettes emerge from selected clumps; different lengths and
  // nonperiodic waviness, never evenly spaced concentric coils.
  for (let j = 0; j < 34; j++) {
    const source = records[Math.floor(random() * records.length)],
      curve = new THREE.CatmullRomCurve3(source.guide.map(V)),
      pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        p = curve.getPointAt(t);
      p.x += Math.sin(t * 5 + j) * 0.1 * t;
      p.y += Math.sin(t * 4 + j * 0.8) * 0.12 * t;
      p.z += Math.sin(t * 7 + j) * 0.09 * t;
      pts.push(p.toArray());
    }
    lock(pts, 0.004 + random() * 0.004, 0.003 + random() * 0.003, j, "flyaway");
  }
  const geometry = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  const group = new THREE.Group();
  group.name = "AuthoredAsymmetricGroom";
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.89 }),
  );
  mesh.name = "PrimaryClumpsSecondaryLocksFlyaways";
  group.add(mesh);
  return { group, records };
}
