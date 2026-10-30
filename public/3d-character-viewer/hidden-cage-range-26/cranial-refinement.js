import * as THREE from "../../character-3d/vendor/three.module.js";
import { createSkinGeometry, sampleColumn } from "./implicit-skin.js?sculpt=9";
import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
const smooth = THREE.MathUtils.smoothstep;
// Lengthen the upper frontal/crown volume while retaining the approved rear
// depth. Support begins above y=.48; eyes, mouth, nose and ears are untouched.
export function cranialPoint(x, y, z) {
  const crown = smooth(y, 0.6, 1.02),
    rear = 1 - smooth(z, -0.36, 0.12);
  return new THREE.Vector3(
    x,
    y +
      0.32 * smooth(y, 0.48, 1.2) +
      0.035 * crown * rear * Math.exp(-1 * ((y - 1.05) / 0.25) ** 2),
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
    if (y <= 0.48) continue;
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
    cranialWarp: "upper-frontal-height-with-preserved-occiput",
    baseRefinement:
      "integrated lips, spherical orbital chamber and thinner auricles",
  };
  return fairSurface(g, {
    pairs: 6,
    limit: 0.004,
    preserveFieldNormals: true,
    weight: (x, y, z) => {
      // Crown, occiput and frontal height remain exact. Protect the oral
      // vestibule and globe-contact surfaces while fairing exposed skin.
      const front = smooth(z, 0.18, 0.34);
      const belowScalp = 1 - smooth(y, 0.85, 1.02);
      const ears =
        smooth(Math.abs(x), 0.84, 0.92) * (1 - smooth(Math.abs(x), 1.15, 1.25));
      const oral =
        Math.exp(
          -1 * ((y + 0.49 - 0.23 * (x / 0.65) ** 2 - 0.035 * x) / 0.15) ** 2,
        ) *
        (1 - smooth(z, 0.25, 0.48));
      return Math.max(ears, front * belowScalp * (1 - oral));
    },
  });
}
// The scalp follows the same loft and posterior warp as the visible skull.
export function scalpDistance(x, y, z) {
  let yy = y,
    zz = z;
  // Invert the monotonic height map with Newton updates. The small posterior
  // warp is updated alongside it so hair remains seated on the actual scalp.
  for (let i = 0; i < 7; i++) {
    const crown = smooth(yy, 0.6, 1.02),
      rear = 1 - smooth(zz, -0.36, 0.12),
      t = THREE.MathUtils.clamp((yy - 0.48) / 0.72, 0, 1),
      forwardY =
        yy +
        0.32 * smooth(yy, 0.48, 1.2) +
        0.035 * crown * rear * Math.exp(-1 * ((yy - 1.05) / 0.25) ** 2);
    yy += (y - forwardY) / (1 + (0.32 * 6 * t * (1 - t)) / 0.72);
    zz += z - (zz - 0.07 * crown * rear);
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
