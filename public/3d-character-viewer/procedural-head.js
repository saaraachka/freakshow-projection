import * as THREE from "three";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";
import { createSkinGeometry, mouthLine } from "./implicit-skin.js";
const material = (color, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const clay = material(0xc9beaa),
  gum = material(0x6e383d),
  ivory = material(0xded1ae, 0.55),
  eyeMaterial = material(0xd3cdb5, 0.43),
  irisMaterial = material(0x62bc28, 0.6),
  pupilMaterial = material(0x101514, 0.48);
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}
export function createProceduralHead() {
  const started = performance.now();
  const root = new THREE.Group();
  root.name = "ProceduralClown";
  const head = new THREE.Group();
  root.add(head);
  const hinge = new THREE.Vector3(0, -0.12, -0.18),
    axis = new THREE.Vector3(1, 0, 0);
  let jaw = 0,
    emotion = "grin",
    intensity = 1;
  const mesh = (g, m, name, parent = head) => {
    const o = new THREE.Mesh(g, m);
    o.name = name;
    parent.add(o);
    return o;
  };
  const oval = (parent, m, name, p, s) => {
    const g = new THREE.SphereGeometry(1, 28, 20);
    g.scale(...s);
    const o = mesh(g, m, name, parent);
    o.position.set(...p);
    return o;
  };
  const geometry = createSkinGeometry(),
    base = geometry.attributes.position.array.slice(),
    baseNormals = geometry.attributes.normal.array.slice(),
    face = mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }),
      "ContinuousSkullCheeksChinJaw",
    );
  const lower = new THREE.Group(),
    upper = new THREE.Group();
  lower.position.copy(hinge);
  head.add(upper, lower);
  const local = (p) => new THREE.Vector3(...p).sub(hinge).toArray();
  const teeth = [];
  for (const isLower of [false, true])
    for (let i = 0; i < 12; i++) {
      const theta = (i - 5.5) * 0.19,
        x = Math.sin(theta) * 0.565,
        z = 0.3 + Math.cos(theta) * 0.38 - (isLower ? 0.065 : 0),
        central = i === 5 || i === 6,
        canine = i === 3 || i === 8;
      const y = (isLower ? -0.57 : -0.405) + 0.18 * (x / 0.65) ** 2,
        w = central ? 0.108 : canine ? 0.085 : 0.092,
        h = (isLower ? 0.117 : central ? 0.18 : 0.155) * (canine ? 1.42 : 1);
      const g = new THREE.SphereGeometry(1, 18, 14),
        a = g.attributes.position;
      for (let k = 0; k < a.count; k++) {
        const yy = a.getY(k);
        let xx = Math.sign(a.getX(k)) * Math.abs(a.getX(k)) ** 0.5 * w * 0.5,
          zz = Math.sign(a.getZ(k)) * Math.abs(a.getZ(k)) ** 0.6 * 0.048;
        if (canine && yy < 0) xx *= 0.12 + 0.88 * (yy + 1);
        a.setXYZ(k, xx, yy * h * 0.5, zz);
      }
      g.computeVertexNormals();
      const crown = mesh(
        g,
        ivory,
        `${isLower ? "Lower" : "Upper"}Tooth${i}`,
        isLower ? lower : upper,
      );
      crown.position.set(...(isLower ? local([x, y, z]) : [x, y, z]));
      crown.rotation.y = theta;
      if (isLower) crown.rotation.z = Math.PI;
      teeth.push(crown);
    }
  for (const isLower of [false, true]) {
    const points = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48 - 0.5) * 2.22,
        x = Math.sin(a) * 0.56,
        y = (isLower ? -0.65 : -0.3) + 0.18 * (x / 0.65) ** 2,
        z = 0.22 + Math.cos(a) * 0.3;
      points.push(
        new THREE.Vector3(...(isLower ? local([x, y, z]) : [x, y, z])),
      );
    }
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        48,
        0.049,
        10,
        false,
      ),
      gum,
      isLower ? "MandibularGingiva" : "MaxillaryGingiva",
      isLower ? lower : upper,
    );
  }
  oval(upper, gum, "PalatalVault", [0, -0.26, 0.31], [0.45, 0.075, 0.28]);
  oval(lower, gum, "Tongue", local([0, -0.67, 0.36]), [0.29, 0.055, 0.21]);
  const eyes = [];
  for (const sign of [-1, 1]) {
    const x = sign * 0.405,
      y = 0.285,
      z = 0.47;
    eyes.push(
      oval(
        head,
        eyeMaterial,
        "RecessedEyeball",
        [x, y, z],
        [0.198, 0.132, 0.17],
      ),
    );
    oval(head, irisMaterial, "Iris", [x, y, 0.631], [0.073, 0.077, 0.014]);
    oval(head, pupilMaterial, "Pupil", [x, y, 0.648], [0.03, 0.039, 0.006]);
    // A single thick, folded pinna surface attaches inside the implicit mastoid root.
    const vertices = [],
      indices = [],
      earColors = [],
      nr = 18,
      ns = 56;
    for (let side = 0; side < 2; side++)
      for (let r = 0; r <= nr; r++)
        for (let i = 0; i <= ns; i++) {
          const t = r / nr,
            a = (i / ns) * Math.PI * 2,
            c = Math.cos(a),
            s = Math.sin(a),
            point = 0.17 * Math.exp(-1 * ((a - 0.8) / 0.35) ** 2) * t * t * t;
          const xx = 1.015 + 0.245 * t * c + point,
            yy = -0.055 + 0.325 * t * s + 0.055 * t * c;
          const rim = 0.06 * Math.exp(-1 * ((t - 0.83) / 0.13) ** 2),
            concha = -0.06 * Math.exp(-1 * (t / 0.43) ** 2),
            fold =
              0.018 * Math.sin(a * 2 + 0.4) * Math.sin(t * Math.PI) +
              0.025 *
                Math.exp(-1 * ((t - 0.5) / 0.13) ** 2) *
                (0.5 + 0.5 * Math.sin(a));
          const front = 0.025 - 0.32 * (xx - 1.015) + rim + concha + fold,
            back = -0.058 - 0.32 * (xx - 1.015);
          const shade = new THREE.Color(0xc9beaa);
          if (side === 0)
            shade.lerp(
              new THREE.Color(0x856452),
              0.42 * Math.exp(-1 * (t / 0.48) ** 2),
            );
          earColors.push(...shade.toArray());
          vertices.push(
            sign * xx,
            yy,
            side === 0 ? front : THREE.MathUtils.lerp(back, front, t ** 8),
          );
          if (r < nr && i < ns) {
            const k = side * (nr + 1) * (ns + 1) + r * (ns + 1) + i;
            const tri = [k, k + 1, k + ns + 2, k, k + ns + 2, k + ns + 1];
            if ((side === 1) !== sign < 0) tri.reverse();
            indices.push(...tri);
          }
        }
    for (let i = 0; i < ns; i++) {
      const a = nr * (ns + 1) + i,
        b = (nr + 1) * (ns + 1) + a;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(earColors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = clay.clone();
    m.side = THREE.DoubleSide;
    m.color.setHex(0xffffff);
    m.vertexColors = true;
    mesh(g, m, sign < 0 ? "LeftPinna" : "RightPinna");
  }
  const hairGroup = new THREE.Group();
  hairGroup.name = "IrregularGroom";
  head.add(hairGroup);
  const random = seeded(0xf3ea),
    strands = [],
    strandData = [];
  const colors = [0x14202c, 0x1c2936, 0x23323e, 0x101b27].map(
    (c) => new THREE.Color(c),
  );
  function strand(anchor, normal, scale, thin = false) {
    const tangent = new THREE.Vector3()
        .crossVectors(normal, new THREE.Vector3(0.1, 1, 0.2))
        .normalize(),
      bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const direction = random() < 0.5 ? -1 : 1,
      turns = 1.1 + random() * 1.65,
      phase = random() * Math.PI * 2,
      radius = (thin ? 0.04 : 0.045 + random() * 0.065) * scale,
      reach = (0.07 + random() * 0.14) * scale;
    const lean = (random() - 0.5) * 1.3,
      roll = (random() - 0.5) * 1.2,
      points = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30,
        angle = phase + direction * turns * Math.PI * 2 * t,
        coil =
          radius *
          Math.sin(Math.PI * (0.12 + 0.82 * t)) *
          (0.72 + 0.28 * Math.sin(t * 9 + phase));
      points.push(
        anchor
          .clone()
          .addScaledVector(
            normal,
            0.02 +
              (0.06 + reach * 0.2) * Math.sin(Math.PI * t * 0.87) +
              Math.sin(angle) * coil * 0.78,
          )
          .addScaledVector(
            tangent,
            coil * Math.cos(angle) + lean * reach * t * 0.3,
          )
          .addScaledVector(
            bitangent,
            (0.22 + reach) * t + roll * 0.06 * Math.sin(Math.PI * t),
          ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points),
      thickness =
        (thin ? 0.007 + 0.007 * random() : 0.018 + 0.018 * random()) * scale,
      g = new THREE.TubeGeometry(curve, 28, thickness, thin ? 5 : 6, false),
      a = g.attributes.position,
      radial = thin ? 5 : 6;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28,
        center = curve.getPointAt(t),
        taper = (0.65 + 0.45 * Math.sin(Math.PI * t)) * (1 - 0.92 * t ** 4);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j,
          p = new THREE.Vector3()
            .fromBufferAttribute(a, k)
            .sub(center)
            .multiplyScalar(taper)
            .add(center);
        a.setXYZ(k, p.x, p.y, p.z);
      }
    }
    g.computeVertexNormals();
    const color = colors[Math.floor(random() * colors.length)],
      v = [];
    for (let i = 0; i < a.count; i++) v.push(color.r, color.g, color.b);
    g.setAttribute("color", new THREE.Float32BufferAttribute(v, 3));
    strands.push(g);
    strandData.push({
      radius,
      thickness,
      turns,
      direction,
      reach,
      endpointDistance: points[0].distanceTo(points.at(-1)),
    });
  }
  // Irregular surface samples, not latitude rows. Open coils overlap and taper to tips.
  for (let i = 0; i < 720; i++) {
    const phi = Math.acos(-0.78 + random() * 1.78),
      a = random() * Math.PI * 2,
      sy = Math.cos(phi),
      sx = Math.sin(phi) * Math.cos(a),
      sz = Math.sin(phi) * Math.sin(a);
    if (sz > 0.13 && sy < 0.82) {
      i--;
      continue;
    }
    const p = new THREE.Vector3(0.93 * sx, 0.15 + 0.99 * sy, -0.17 + 0.79 * sz),
      n = new THREE.Vector3(sx, sy, sz).normalize();
    strand(p, n, 0.8 + random() * 0.5, i % 4 === 0);
  }
  // A swept crown and uneven sideburns interrupt the scalp silhouette.
  for (let i = 0; i < 42; i++) {
    const side = i % 2 ? 1 : -1,
      p = new THREE.Vector3(
        side * (0.65 + random() * 0.24),
        -0.12 - random() * 0.62,
        -0.18 + random() * 0.25,
      );
    strand(
      p,
      new THREE.Vector3(side * 0.8, -0.1, -0.35).normalize(),
      0.9 + random() * 0.5,
    );
  }
  const hg = mergeGeometries(strands),
    hm = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
    });
  mesh(hg, hm, "OverlappingTaperedCurlyStrands", hairGroup);
  strands.forEach((g) => g.dispose());
  function update() {
    lower.rotation.x = jaw * 0.43;
    const a = geometry.attributes.position,
      normal = geometry.attributes.normal;
    for (let i = 0; i < a.count; i++) {
      const p = new THREE.Vector3(
          base[i * 3],
          base[i * 3 + 1],
          base[i * 3 + 2],
        ),
        x = p.x,
        y = p.y;
      const cheek =
        Math.exp(
          -1 * ((Math.abs(x) - 0.54) / 0.32) ** 2 - ((y + 0.26) / 0.35) ** 2,
        ) * THREE.MathUtils.smoothstep(p.z, 0.1, 0.55);
      const relax = emotion === "neutral" ? -intensity : 0,
        smirk = emotion === "smirk" ? Math.sign(x) * intensity : 0;
      p.y += cheek * (relax * 0.085 + smirk * 0.06);
      p.z += cheek * smirk * 0.013;
      const weight =
        THREE.MathUtils.smoothstep(mouthLine(x) - y, -0.025, 0.16) *
        THREE.MathUtils.smoothstep(p.z, -0.7, -0.12) *
        THREE.MathUtils.smoothstep(y, -1.67, -1.0);
      const moved = p
        .clone()
        .sub(hinge)
        .applyAxisAngle(axis, jaw * 0.43)
        .add(hinge);
      p.lerp(moved, weight);
      a.setXYZ(i, p.x, p.y, p.z);
      const n = new THREE.Vector3(
        baseNormals[i * 3],
        baseNormals[i * 3 + 1],
        baseNormals[i * 3 + 2],
      );
      n.lerp(n.clone().applyAxisAngle(axis, jaw * 0.43), weight).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    a.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  }
  update();
  const generationMs = performance.now() - started;
  return {
    root,
    face,
    teeth,
    lower,
    hair: hairGroup,
    eyes,
    setPose(name, amount = 1) {
      emotion = name;
      intensity = amount;
      update();
    },
    setJaw(amount) {
      jaw = THREE.MathUtils.clamp(amount, 0, 1);
      update();
    },
    get state() {
      return {
        source: "procedural-code",
        revision: "anatomy-refinement-1",
        generationMs,
        jaw,
        emotion,
        teeth: teeth.length,
        faceVertices: geometry.attributes.position.count,
        hairStrands: strandData.length,
        hairVariation: strandData,
        detachedLipMeshes: 0,
        detachedLidMeshes: 0,
        continuousLowerFace: true,
      };
    },
  };
}
