import * as THREE from "../../character-3d/vendor/three.module.js";
const smooth = THREE.MathUtils.smootherstep;
// Transverse TMJ axis between the temporal attachments, in head-local space.
// The very same pose is used by mandibular skin, gingiva, tongue and enamel.
export const LOWER_DENTAL_SEAT = [0, -0.012, -0.024];
export const JAW_PIVOT = [0, -0.025, -0.235];
export function jawPose(neutral, surprise) {
  return {
    angle: 0.255 * surprise,
    down: -0.008 * surprise,
    back: 0.005 * neutral + 0.01 * surprise,
    relax: 0.018 * neutral + 0.035 * surprise,
  };
}
export function jawWeight(x, y, z) {
  // The entire chin pad and mandibular body are one rigid zone. The taper is
  // above that body, in cheek tissue, not across the chin or its underside.
  return (1 - smooth(y, -0.79, -0.18)) * smooth(z, -0.88, -0.43);
}
export function jawPoint(x, y, z, pose) {
  const w = jawWeight(x, y, z),
    a = w * pose.angle,
    dy = y - JAW_PIVOT[1],
    dz = z - JAW_PIVOT[2];
  const cheek =
    (pose.relax || 0) *
    Math.exp(-1 * ((Math.abs(x) - 0.5) / 0.19) ** 2) *
    Math.exp(-1 * ((y + 0.35) / 0.16) ** 2) *
    smooth(z, 0.1, 0.3) *
    smooth(y, -0.72, -0.58) *
    (1 - smooth(y, -0.28, -0.18)) *
    smooth(Math.abs(x), 0.2, 0.36);
  return [
    x,
    JAW_PIVOT[1] + dy * Math.cos(a) - dz * Math.sin(a) + w * pose.down,
    JAW_PIVOT[2] + dy * Math.sin(a) + dz * Math.cos(a) - w * pose.back + cheek,
  ];
}
export function jawNormal(x, y, z, nx, ny, nz, pose) {
  const e = 0.00015,
    cols = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = [x, y, z],
      b = a.slice();
    a[axis] += e;
    b[axis] -= e;
    const hi = jawPoint(...a, pose),
      lo = jawPoint(...b, pose);
    cols.push(hi.map((v, k) => (v - lo[k]) / (2 * e)));
  }
  const j = new THREE.Matrix3().set(
    cols[0][0],
    cols[1][0],
    cols[2][0],
    cols[0][1],
    cols[1][1],
    cols[2][1],
    cols[0][2],
    cols[1][2],
    cols[2][2],
  );
  return new THREE.Vector3(nx, ny, nz)
    .applyMatrix3(j.invert().transpose())
    .normalize();
}
