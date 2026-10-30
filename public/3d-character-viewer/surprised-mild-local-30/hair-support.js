import * as THREE from "../../character-3d/vendor/three.module.js";
import { scalpDistance } from "./cranial-refinement.js?sculpt=9";
import { ellipsoid } from "./implicit-skin.js?sculpt=9";
const smooth = THREE.MathUtils.smoothstep;
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
export function hairline(x, z) {
  const f = smooth(z, -0.75, -0.05);
  return (
    -0.5 +
    1.6 * f -
    0.08 * Math.exp(-1 * ((x + 0.17) / 0.3) ** 2) * f +
    0.035 * Math.sin(x * 9 + 0.5) * f
  );
}
// The side envelope expands the groom, never the facial mesh. Its front and
// lower falloffs retain an attached hairline and clearance around the ears.
export function lateralProfile(y, z) {
  return (
    smooth(y, -0.12, 0.22) *
    (1 - 0.55 * smooth(y, 1.15, 1.65)) *
    (1 - smooth(z, 0.05, 0.5))
  );
}
export function hairlineMask(x, y, z) {
  return hairline(x, z) - y - 0.9 * smooth(Math.abs(x), 0.72, 1.07);
}
export function normalAt(p) {
  const e = 0.003;
  return new THREE.Vector3(
    scalpDistance(p.x + e, p.y, p.z) - scalpDistance(p.x - e, p.y, p.z),
    scalpDistance(p.x, p.y + e, p.z) - scalpDistance(p.x, p.y - e, p.z),
    scalpDistance(p.x, p.y, p.z + e) - scalpDistance(p.x, p.y, p.z - e),
  ).normalize();
}
export function scalpPoint(theta, phi, lift = 0) {
  const origin = new THREE.Vector3(0, 0.05, -0.4),
    d = new THREE.Vector3(
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta),
    );
  let lo = 0,
    hi = 2;
  for (let i = 0; i < 24; i++) {
    const r = (lo + hi) / 2,
      p = origin.clone().addScaledVector(d, r);
    if (scalpDistance(p.x, p.y, p.z) > 0) hi = r;
    else lo = r;
  }
  const p = origin.addScaledVector(d, (lo + hi) / 2);
  return p.addScaledVector(normalAt(p), lift);
}
export function scalpHairField(x, y, z) {
  const edge = y - hairline(x, z),
    crown = Math.exp(-1 * ((y - 0.95) / 0.4) ** 2),
    temple = Math.exp(-1 * ((Math.abs(x) - 0.7) / 0.22) ** 2),
    thickness =
      0.02 + (0.065 + 0.025 * crown + 0.018 * temple) * smooth(edge, 0, 0.2);
  let d = smax(scalpDistance(x, y, z) - thickness, -edge, 0.045);
  // Rounded temporal/occipital masses establish the clown silhouette. Unlike
  // stretching the scalp shell, these do not extrude a flat forehead curtain.
  for (const sign of [-1, 1]) {
    d = smin(
      d,
      ellipsoid(x, y, z, sign * 1.12, 0.71, -0.84, 0.47, 0.53, 0.5),
      0.11,
    );
    d = smin(
      d,
      ellipsoid(x, y, z, sign * 1.0, 1.22, -0.68, 0.43, 0.38, 0.47),
      0.1,
    );
  }
  d = smin(d, ellipsoid(x, y, z, 0, 0.76, -1.34, 0.74, 0.7, 0.3), 0.12);
  d = smin(d, ellipsoid(x, y, z, -0.035, 1.43, -0.57, 0.7, 0.3, 0.62), 0.11);
  for (const s of [-1, 1])
    d = smax(
      d,
      -ellipsoid(x, y, z, s * 1, 0.04, -0.115, 0.27, 0.36, 0.2),
      0.025,
    );
  return d;
}
