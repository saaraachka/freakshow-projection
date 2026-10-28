import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";
const material = (color, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const clay = material(0xb9afa5),
  lipClay = material(0x9c8984),
  gumClay = material(0x947c79),
  ivory = material(0xe1d8c6, 0.5),
  hairClay = material(0x343b46),
  cavityClay = material(0x2a2025),
  eyeClay = material(0xd5d0c2, 0.4),
  irisClay = material(0x668a59, 0.5),
  pupilClay = material(0x14191b, 0.4);
const gauss = (x, y, cx, cy, sx, sy) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
export function createProceduralHead() {
  const root = new THREE.Group();
  root.name = "ProceduralClown";
  const head = new THREE.Group();
  root.add(head);
  const hinge = new THREE.Vector3(0, -0.12, -0.12),
    axis = new THREE.Vector3(1, 0, 0);
  let jaw = 0,
    emotion = "grin",
    intensity = 1;
  function rotate(p, weight = 1) {
    return p
      .clone()
      .sub(hinge)
      .applyAxisAngle(axis, jaw * 0.43 * weight)
      .add(hinge);
  }
  const N = 128,
    F = 44,
    B = 24,
    T = F + B;
  function vertex(i, j) {
    const a = (2 * Math.PI * i) / N,
      c = Math.cos(a),
      s = Math.sin(a),
      t = j / F;
    const grin = emotion === "neutral" ? 1 - intensity : 1;
    const asym = emotion === "smirk" ? 0.11 * intensity * c : 0;
    const mx = (0.67 + 0.045 * grin) * c,
      my = -0.51 + (0.035 + 0.095 * grin) * s + 0.19 * grin * c * c + asym;
    const ox = 1.2 * c * (1 + 0.04 * s),
      oy = 0.05 + 1.31 * s;
    if (j > F) {
      const beta = (((j - F) / B) * Math.PI) / 2,
        k = Math.cos(beta);
      const p = new THREE.Vector3(
        ox * k,
        0.05 + (oy - 0.05) * k,
        -1.06 * Math.sin(beta),
      );
      return p.lerp(
        rotate(p),
        1 - THREE.MathUtils.smoothstep(p.y, -0.95, -0.2),
      );
    }
    const x = THREE.MathUtils.lerp(mx, ox, t),
      y = THREE.MathUtils.lerp(my, oy, t);
    let z = 0.99 * Math.sqrt(Math.max(0, 1 - t * t));
    z +=
      0.15 *
      (gauss(x, y, 0.7, -0.13, 0.32, 0.3) +
        gauss(x, y, -0.7, -0.13, 0.32, 0.3));
    z += 0.12 * gauss(x, y, 0, -1, 0.43, 0.23);
    z -=
      0.24 *
      (gauss(x, y, 0.46, 0.3, 0.33, 0.25) +
        gauss(x, y, -0.46, 0.3, 0.33, 0.25));
    z +=
      0.14 *
      (gauss(x, y, 0.45, 0.55 + 0.26 * (Math.abs(x) - 0.45), 0.34, 0.09) +
        gauss(x, y, -0.45, 0.55 + 0.26 * (Math.abs(x) - 0.45), 0.34, 0.09));
    z += 0.15 * gauss(x, y, 0, 0.19, 0.16, 0.36);
    z -=
      0.045 *
      (gauss(x, y, 0.58, -0.33, 0.065, 0.21) +
        gauss(x, y, -0.58, -0.33, 0.065, 0.21));
    z += 0.07 * Math.exp(-t * 30);
    z *= 1 - t ** 12;
    const p = new THREE.Vector3(x, y, z);
    const lower =
      (Math.max(0, -s) * 0.95 + 0.12 * (1 - Math.abs(s))) * (1 - t) +
      (1 - THREE.MathUtils.smoothstep(y, -0.95, -0.2)) * t;
    return p.lerp(rotate(p), lower);
  }
  const positions = [],
    idx = [];
  for (let j = 0; j <= T; j++)
    for (let i = 0; i <= N; i++) {
      const p = vertex(i, j);
      positions.push(...p.toArray());
      if (j < T && i < N) {
        const k = j * (N + 1) + i;
        idx.push(k, k + N + 2, k + 1, k, k + N + 1, k + N + 2);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  const face = new THREE.Mesh(geometry, clay);
  face.name = "ContinuousSkullCheeksChinJaw";
  head.add(face);
  function mesh(g, m, name, parent = head) {
    const o = new THREE.Mesh(g, m);
    o.name = name;
    parent.add(o);
    return o;
  }
  function oval(parent, m, name, p, scale) {
    const g = new THREE.SphereGeometry(1, 28, 18);
    g.scale(...scale);
    const o = mesh(g, m, name, parent);
    o.position.set(...p);
    return o;
  }
  // Ear pinnae have a raised helix, recessed concha and asymmetric lobule; both shells have depth.
  for (const sign of [-1, 1]) {
    const verts = [],
      indices = [],
      nr = 18,
      ns = 48;
    for (let side = 0; side < 2; side++)
      for (let r = 0; r <= nr; r++)
        for (let i = 0; i <= ns; i++) {
          const t = r / nr,
            a = (i / ns) * Math.PI * 2;
          const x =
              sign * (1.13 + 0.25 * t * Math.cos(a) + 0.04 * t * Math.sin(a)),
            y = -0.02 + 0.34 * t * Math.sin(a);
          const ridge = 0.095 * Math.exp(-(((t - 0.8) / 0.15) ** 2));
          const z =
            side === 0
              ? 0.015 + ridge - 0.065 * Math.exp(-((t / 0.44) ** 2))
              : -0.095;
          verts.push(x, y, z);
          if (r < nr && i < ns) {
            const k = side * (nr + 1) * (ns + 1) + r * (ns + 1) + i;
            indices.push(k, k + 1, k + ns + 2, k, k + ns + 2, k + ns + 1);
          }
        }
    for (let i = 0; i < ns; i++) {
      const front = nr * (ns + 1) + i,
        back = (nr + 1) * (ns + 1) + front;
      indices.push(front, back, front + 1, front + 1, back, back + 1);
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    eg.setIndex(indices);
    eg.computeVertexNormals();
    const em = clay.clone();
    em.side = THREE.DoubleSide;
    mesh(eg, em, sign < 0 ? "LeftPinna" : "RightPinna");
  }
  // Real eyeballs: volumes inside sculpted socket depressions; lens caps and pupils have their own geometry.
  for (const sign of [-1, 1]) {
    const x = sign * 0.465,
      y = 0.31,
      z = 0.805;
    oval(head, eyeClay, "Eyeball", [x, y, z], [0.245, 0.185, 0.205]);
    oval(head, irisClay, "Iris", [x, y, z + 0.194], [0.091, 0.096, 0.025]);
    oval(head, pupilClay, "Pupil", [x, y, z + 0.218], [0.041, 0.055, 0.012]);
    for (const upper of [true, false]) {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI;
        pts.push(
          new THREE.Vector3(
            x + 0.253 * Math.cos(a),
            y + (upper ? 0.145 : -0.137) * Math.sin(a),
            z + 0.09 + 0.087 * Math.sin(a),
          ),
        );
      }
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(pts),
          48,
          upper ? 0.045 : 0.035,
          8,
          false,
        ),
        clay,
        "SculptedEyelid",
      );
    }
  }
  oval(
    head,
    material(0xa64748, 0.5),
    "ProtrudingClownNose",
    [0, 0.035, 1.08],
    [0.23, 0.215, 0.25],
  );
  // Upper and lower arches are independent rigid structures. Lower structures share one physical hinge.
  const upper = new THREE.Group(),
    lower = new THREE.Group();
  lower.position.copy(hinge);
  head.add(upper, lower);
  function lowerLocal(p) {
    return new THREE.Vector3(...p).sub(hinge).toArray();
  }
  const teeth = [];
  for (const isLower of [false, true]) {
    const group = isLower ? lower : upper;
    for (let i = 0; i < 12; i++) {
      const theta = (i - 5.5) * 0.205,
        x = Math.sin(theta) * 0.62,
        z = 0.42 + Math.cos(theta) * 0.51 - (isLower ? 0.035 : 0),
        canine = Math.abs(i - 5.5) === 2.5;
      const y = (isLower ? -0.625 : -0.455) + 0.19 * (x / 0.715) ** 2,
        w = Math.abs(i - 5.5) < 2 ? 0.145 : 0.12,
        h = (isLower ? 0.135 : 0.18) * (canine ? 1.28 : 1);
      const g = new THREE.SphereGeometry(1, 16, 12),
        p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const yy = p.getY(k);
        let xx =
          (Math.sign(p.getX(k)) * Math.pow(Math.abs(p.getX(k)), 0.5) * w) / 2;
        let zz =
          Math.sign(p.getZ(k)) * Math.pow(Math.abs(p.getZ(k)), 0.6) * 0.075;
        if (canine && yy < 0) xx *= 0.35 + 0.65 * (yy + 1);
        p.setXYZ(k, xx, (yy * h) / 2, zz);
      }
      g.computeVertexNormals();
      const crown = mesh(
        g,
        ivory,
        `${isLower ? "Lower" : "Upper"}Tooth${i}`,
        group,
      );
      crown.position.set(...(isLower ? lowerLocal([x, y, z]) : [x, y, z]));
      crown.rotation.y = theta;
      if (isLower) crown.rotation.z = Math.PI;
      teeth.push(crown);
      const base = [x, y + (isLower ? -0.08 : 0.1), z - 0.055];
      oval(group, gumClay, "GumCollar", isLower ? lowerLocal(base) : base, [
        w * 0.61,
        0.07,
        0.085,
      ]);
    }
  }
  oval(
    lower,
    gumClay,
    "LowerGumRidge",
    lowerLocal([0, -0.76, 0.23]),
    [0.54, 0.1, 0.43],
  );
  oval(upper, gumClay, "UpperPalate", [0, -0.28, 0.19], [0.55, 0.075, 0.44]);
  oval(
    lower,
    gumClay,
    "Tongue",
    lowerLocal([0, -0.69, 0.49]),
    [0.32, 0.075, 0.28],
  );
  // Oral wall begins at the exact skin aperture. It closes at a recessed throat cap.
  const cg = new THREE.BufferGeometry(),
    cp = new Float32Array((N + 1) * 13 * 3),
    ci = [];
  for (let r = 0; r < 12; r++)
    for (let i = 0; i < N; i++) {
      const k = r * (N + 1) + i;
      ci.push(k, k + 1, k + N + 2, k, k + N + 2, k + N + 1);
    }
  cg.setAttribute("position", new THREE.BufferAttribute(cp, 3));
  cg.setIndex(ci);
  const cm = cavityClay.clone();
  cm.side = THREE.DoubleSide;
  mesh(cg, cm, "OralCavity");
  oval(head, cavityClay, "Throat", [0, -0.48, -0.11], [0.49, 0.39, 0.13]);
  let lips;
  // Spiral curls follow the scalp normal and remain dimensional from the back and sides.
  const curls = [];
  for (let ring = 0; ring < 9; ring++) {
    const phi = 0.24 + ring * 0.245,
      count = Math.round(8 + 18 * Math.sin(phi));
    for (let i = 0; i < count; i++) {
      const a =
        (i / count) * Math.PI * 2 +
        (ring % 2) * 0.13 +
        0.06 * Math.sin(i * 5.7 + ring);
      if (Math.sin(a) > 0.19 && phi > 0.66) continue;
      const p = new THREE.Vector3(
        1.22 * Math.sin(phi) * Math.cos(a),
        0.08 + 1.34 * Math.cos(phi),
        1.08 * Math.sin(phi) * Math.sin(a),
      );
      const normal = new THREE.Vector3(
          p.x / 1.22,
          (p.y - 0.08) / 1.34,
          p.z / 1.08,
        ).normalize(),
        u = new THREE.Vector3()
          .crossVectors(normal, new THREE.Vector3(0, 1, 0.001))
          .normalize(),
        v = new THREE.Vector3().crossVectors(normal, u).normalize();
      const pts = [];
      for (let k = 0; k <= 36; k++) {
        const t = k / 36,
          ang = t * Math.PI * 3.4 + i * 0.8,
          rr = 0.1 * Math.sin(Math.PI * (0.12 + 0.76 * t));
        pts.push(
          p
            .clone()
            .addScaledVector(u, Math.cos(ang) * rr)
            .addScaledVector(v, Math.sin(ang) * rr)
            .addScaledVector(normal, 0.02 + 0.18 * Math.sin(Math.PI * t)),
        );
      }
      curls.push(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(pts),
          36,
          0.048,
          6,
          false,
        ),
      );
    }
  }
  const hair = mesh(mergeGeometries(curls), hairClay, "DimensionalSpiralCurls");
  const scalpPositions = [],
    scalpIndices = [];
  for (let j = F; j <= T; j++)
    for (let i = 0; i <= N; i++) {
      const p = vertex(i, j);
      p.x *= 1.012;
      p.y = 0.05 + (p.y - 0.05) * 1.012;
      p.z -= 0.012;
      scalpPositions.push(p.x, p.y, p.z);
      if (j < T && i < N) {
        const k = (j - F) * (N + 1) + i;
        scalpIndices.push(k, k + N + 2, k + 1, k, k + N + 1, k + N + 2);
      }
    }
  const scalpGeometry = new THREE.BufferGeometry();
  scalpGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(scalpPositions, 3),
  );
  scalpGeometry.setIndex(scalpIndices);
  scalpGeometry.computeVertexNormals();
  const scalp = mesh(scalpGeometry, hairClay, "ModeledScalpUnderCurls");
  hair.add(scalp);
  curls.forEach((g) => g.dispose());
  // A neck provides a connected silhouette beneath the jaw rather than a floating mask.
  oval(head, clay, "Neck", [0, -1.33, -0.23], [0.37, 0.35, 0.39]);
  function update() {
    lower.rotation.x = jaw * 0.43;
    const p = geometry.attributes.position;
    for (let j = 0; j <= T; j++)
      for (let i = 0; i <= N; i++) {
        const v = vertex(i, j);
        p.setXYZ(j * (N + 1) + i, v.x, v.y, v.z);
      }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(vertex(i, 0));
    const lg = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts, true),
      N,
      0.043,
      8,
      true,
    );
    if (lips) {
      lips.geometry.dispose();
      lips.geometry = lg;
    } else lips = mesh(lg, lipClay, "ContinuousLipLoop");
    for (let r = 0; r <= 12; r++)
      for (let i = 0; i <= N; i++) {
        const p = vertex(i, 0),
          t = r / 12;
        p.x *= 1 - 0.38 * t;
        p.y = THREE.MathUtils.lerp(p.y, -0.5 - jaw * 0.13, t * 0.4);
        p.z = THREE.MathUtils.lerp(p.z, -0.13, t);
        const k = (r * (N + 1) + i) * 3;
        cp[k] = p.x;
        cp[k + 1] = p.y;
        cp[k + 2] = p.z;
      }
    cg.attributes.position.needsUpdate = true;
    cg.computeVertexNormals();
  }
  update();
  return {
    root,
    face,
    teeth,
    lower,
    hair,
    setPose(name, amount = 1) {
      emotion = name;
      intensity = amount;
      update();
    },
    setJaw(amount) {
      jaw = amount;
      update();
    },
    get state() {
      return {
        source: "procedural-code",
        jaw,
        emotion,
        teeth: teeth.length,
        faceVertices: geometry.attributes.position.count,
      };
    },
  };
}
