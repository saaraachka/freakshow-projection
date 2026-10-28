import * as THREE from "three";
import { mergeVertices } from "./vendor/BufferGeometryUtils.js";
import { mouthLine } from "./implicit-skin.js?sculpt=4";
// Closed crown lofts with enamel lobes, neck taper, labial plane and occlusal
// relief. The crown classes have genuinely different surfaces, not scaled blocks.
function crownGeometry(kind, width, height, depth, variant) {
  const positions = [],
    indices = [],
    rings = 18,
    sides = 28;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const neck = 0.72 + 0.29 * Math.sin(Math.PI * t * 0.85),
      edge =
        t > 0.84
          ? Math.sqrt(Math.max(0.0005, 1 - ((t - 0.84) / 0.16) ** 2))
          : 1;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      let xx = Math.sign(c) * Math.abs(c) ** 0.59 * width * 0.5 * neck;
      let zz = Math.sign(s) * Math.abs(s) ** 0.7 * depth * 0.5;
      let yy = -height * t;
      if (kind === "canine") {
        const taper = 1 - 0.92 * t ** 2.6;
        xx *= taper;
        zz *= 1 - 0.88 * t ** 2.4;
        xx += width * 0.17 * t * t;
        zz += depth * 0.17 * Math.sin(t * 2.5);
      } else if (kind === "incisor") {
        xx *= 0.92 + 0.08 * t;
        zz *= 1 - 0.53 * t;
        yy -= 0.004 * Math.cos(a * 3 + variant) * t ** 6;
        zz += 0.006 * Math.cos(a * 3) * Math.sin(t * Math.PI); // labial enamel lobes
        if (t > 0.86)
          zz *=
            0.08 + 0.92 * Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2));
      } else {
        const lobes = kind === "molar" ? 4 : 2;
        xx *= 1 + 0.08 * Math.cos(a * lobes + variant) * Math.sin(Math.PI * t);
        zz *= 1 + 0.1 * Math.cos(a * lobes + 0.5) * Math.sin(Math.PI * t);
        const occlusal = Math.max(0, (t - 0.65) / 0.35);
        yy += height * 0.2 * occlusal * (0.5 + 0.5 * Math.cos(a * lobes));
        if (t > 0.9) {
          xx *= edge;
          zz *= edge;
        }
      }
      positions.push(xx, yy, zz);
      if (i < rings && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(
          k,
          k + 1,
          k + sides + 1,
          k + 1,
          k + sides + 2,
          k + sides + 1,
        );
      }
    }
  }
  // Neck and cutting-edge caps lie inside the gingiva / enamel tip.
  for (let j = 1; j < sides - 1; j++) {
    indices.push(0, j + 1, j);
    const k = rings * (sides + 1);
    indices.push(k, k + j, k + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  const closed = mergeVertices(g, 1e-6);
  closed.computeVertexNormals();
  g.dispose();
  return closed;
}
function patchGeometry(fn, nu, nv) {
  const v = [],
    ix = [];
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      v.push(...fn(i / nu, j / nv));
      if (i < nu && j < nv) {
        const k = i * (nv + 1) + j;
        ix.push(k, k + 1, k + nv + 1, k + 1, k + nv + 2, k + nv + 1);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
export function dentalArch(theta, lower = false) {
  const t = Math.abs(theta),
    posterior = Math.max(0, (t - 0.45) / 0.76);
  const x =
    Math.sin(theta) * 0.561 - Math.sign(theta) * 0.08 * posterior ** 1.3;
  const z =
    0.075 +
    Math.cos(theta) * 0.346 -
    (lower ? 0.023 : 0) -
    0.115 * posterior ** 1.2;
  const root =
    mouthLine(x) +
    (lower ? -0.115 : 0.125) +
    (lower ? 0.005 : -0.045) * posterior;
  const dx = 0.561 * Math.cos(t) - ((0.08 * 1.3) / 0.76) * posterior ** 0.3,
    dz = 0.346 * Math.sin(t) + ((0.115 * 1.2) / 0.76) * posterior ** 0.2;
  const yaw = Math.sign(theta) * Math.atan2(dz, dx);
  return { x, z, root, yaw };
}
export function createDentition() {
  const group = new THREE.Group(),
    teeth = [],
    records = [];
  const enamel = new THREE.MeshStandardMaterial({
      color: 0xd7cba9,
      roughness: 0.53,
    }),
    gingiva = new THREE.MeshStandardMaterial({
      color: 0x723d42,
      roughness: 0.84,
      side: THREE.DoubleSide,
    });
  const kinds = [
    "incisor",
    "incisor",
    "canine",
    "premolar",
    "premolar",
    "molar",
    "molar",
  ];
  const angles = [0.092, 0.276, 0.452, 0.635, 0.816, 1.015, 1.21],
    widths = [0.111, 0.091, 0.079, 0.087, 0.087, 0.098, 0.098];
  for (const lower of [false, true])
    for (const sign of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const theta = sign * angles[i],
          { x, z, root, yaw } = dentalArch(theta, lower),
          kind = kinds[i];
        const h =
          (lower ? 0.093 : i === 0 ? 0.154 : 0.136) *
          (kind === "canine" ? 1.34 : 1) *
          (1 + 0.035 * Math.sin(i * 4 + sign));
        const y = root + 0.005 * Math.sin(i * 3 + sign);
        const depth =
          kind === "incisor"
            ? 0.074
            : kind === "canine"
              ? 0.083
              : kind === "premolar"
                ? 0.116
                : 0.14;
        const g = crownGeometry(
          kind,
          widths[i] * (lower ? 0.89 : 1),
          h,
          depth,
          i + sign,
        );
        const o = new THREE.Mesh(g, enamel);
        o.name = `${lower ? "Lower" : "Upper"}_${sign < 0 ? "L" : "R"}_${kind}_${i}`;
        o.position.set(x, y, z);
        o.rotation.y = yaw + 0.025 * Math.sin(i * 2 + sign);
        o.rotation.z =
          (lower ? Math.PI : 0) + 0.026 * Math.sin(i * 3 + sign * 0.8);
        group.add(o);
        teeth.push(o);
        records.push({ kind, lower, side: sign, archPosition: i });
      }
  // A horseshoe-shaped gingival ribbon with scalloped tooth collars. Thickness
  // extends backwards into the maxilla rather than sitting as a hose on the lips.
  for (const lower of [false, true]) {
    const verts = [],
      ix = [],
      segments = 100,
      radial = 16;
    for (let i = 0; i <= segments; i++)
      for (let j = 0; j <= radial; j++) {
        const a = (i / segments - 0.5) * 2.62,
          b = (j / radial) * Math.PI * 2,
          { x: archX, z: archZ, root } = dentalArch(a, lower),
          x = archX;
        const scallop = 0.008 * Math.cos(a * 34);
        const cy = root + (lower ? -0.045 : 0.043);
        const offset = Math.sin(b) * 0.051;
        const z = archZ - 0.04 + Math.cos(b) * 0.055;
        verts.push(
          x + Math.sin(a) * Math.cos(b) * 0.031,
          cy + offset + scallop,
          z,
        );
        if (i < segments && j < radial) {
          const k = i * (radial + 1) + j;
          ix.push(
            k,
            k + 1,
            k + radial + 1,
            k + 1,
            k + radial + 2,
            k + radial + 1,
          );
        }
      }
    // The ends terminate inside the posterior maxilla/mandible.
    for (let j = 1; j < radial - 1; j++) {
      ix.push(0, j + 1, j);
      const k = segments * (radial + 1);
      ix.push(k, k + j, k + j + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, gingiva);
    mesh.name = lower ? "LowerScallopedGingiva" : "UpperScallopedGingiva";
    group.add(mesh);
  }
  // Enclosed depth is part of the skin's oral subtraction. Palatal and lingual
  // relief sit inside that volume; neither is a flat black mouth card.
  const palate = patchGeometry(
    (u, v) => {
      const x = (u * 2 - 1) * 0.425,
        front = 0.3 * Math.sqrt(Math.max(0, 1 - (x / 0.44) ** 2)) - 0.035;
      const z = THREE.MathUtils.lerp(-0.14, front, v);
      const y =
        -0.285 -
        0.08 * (x / 0.425) ** 2 -
        0.015 * v +
        0.006 * Math.sin(v * 34) * Math.sin(Math.PI * v);
      return [x, y, z];
    },
    44,
    28,
  );
  const pm = new THREE.Mesh(palate, gingiva);
  pm.name = "PalatalRugae";
  group.add(pm);
  const tongue = new THREE.SphereGeometry(1, 40, 24),
    tp = tongue.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i) * 0.29,
      z = 0.1 + tp.getZ(i) * 0.27;
    let y = -0.632 + tp.getY(i) * 0.066;
    y -=
      0.013 *
      Math.exp(-1 * (x / 0.027) ** 2) *
      THREE.MathUtils.smoothstep(y, -0.63, -0.59);
    tp.setXYZ(i, x, y, z);
  }
  tongue.computeVertexNormals();
  const tm = new THREE.Mesh(tongue, gingiva);
  tm.name = "TongueWithMedianSulcus";
  group.add(tm);
  return { group, teeth, records };
}
