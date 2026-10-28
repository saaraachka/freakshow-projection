import * as THREE from "../character-3d/vendor/three.module.js";
import { createSkinGeometry, sampleColumn } from "./implicit-skin.js?sculpt=4";
const smooth = THREE.MathUtils.smoothstep;
// A posterior/crown-only warp. Its support excludes the face, eyes and ears.
export function cranialPoint(x, y, z) {
  const crown = smooth(y, 0.6, 1.02),
    rear = 1 - smooth(z, -0.36, 0.12);
  return new THREE.Vector3(
    x,
    y + 0.035 * crown * rear * Math.exp(-1 * ((y - 1.05) / 0.25) ** 2),
    z - 0.07 * crown * rear,
  );
}
export function createRefinedSkinGeometry() {
  const g = createSkinGeometry(),
    p = g.attributes.position,
    n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    if (y <= 0.6 || z >= 0.12) continue;
    const q = cranialPoint(x, y, z),
      e = 0.001,
      dx = cranialPoint(x + e, y, z)
        .sub(q)
        .divideScalar(e),
      dy = cranialPoint(x, y + e, z)
        .sub(q)
        .divideScalar(e),
      dz = cranialPoint(x, y, z + e)
        .sub(q)
        .divideScalar(e);
    const jacobian = new THREE.Matrix3()
      .set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z)
      .invert()
      .transpose();
    const normal = new THREE.Vector3()
      .fromBufferAttribute(n, i)
      .applyMatrix3(jacobian)
      .normalize();
    p.setXYZ(i, q.x, q.y, q.z);
    n.setXYZ(i, normal.x, normal.y, normal.z);
  }
  g.userData = {
    ...g.userData,
    cranialWarp: "posterior-crown-only",
    facialVerticesPreserved: true,
  };
  return g;
}
// The scalp follows the same loft and posterior warp as the visible skull.
export function scalpDistance(x, y, z) {
  let yy = y,
    zz = z;
  for (let i = 0; i < 2; i++) {
    const q = cranialPoint(x, yy, zz);
    yy += y - q.y;
    zz += z - q.z;
  }
  const c = sampleColumn(x, yy),
    cz = (c.front + c.back) / 2,
    rz = (c.front - c.back) / 2,
    ax = x + 0.014 * Math.sin(yy * 2.1),
    side = Math.sqrt(Math.max(0.16, 1 - (ax / c.w) ** 2)),
    front = smooth(zz, cz - 0.075, cz + 0.075);
  const radius = Math.max(
    0.015,
    THREE.MathUtils.lerp(Math.max(0.015, cz - c.rear), rz, front) +
      (c.relief / side) * front,
  );
  return Math.max(
    (Math.hypot(ax / c.w, (zz - cz) / radius) - 1) *
      Math.min(c.w, Math.max(0.015, rz)),
    -1.2 - yy,
    yy - 1.2,
  );
}
