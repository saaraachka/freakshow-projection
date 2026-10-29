import * as THREE from "../character-3d/vendor/three.module.js";
import { scalpDistance } from "./cranial-refinement.js?sculpt=6";
import { ellipsoid } from "./implicit-skin.js?sculpt=6";
const smooth = THREE.MathUtils.smoothstep;
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
export function hairline(x, z) {
  const f = smooth(z, -0.65, 0.4);
  return (
    -0.5 +
    1.2 * f -
    0.12 * Math.exp(-1 * ((x + 0.17) / 0.3) ** 2) * f +
    0.035 * Math.sin(x * 9 + 0.5) * f
  );
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
      0.005 + (0.065 + 0.025 * crown + 0.018 * temple) * smooth(edge, 0, 0.2);
  let d = smax(scalpDistance(x, y, z) - thickness, -edge, 0.022);
  for (const s of [-1, 1])
    d = smax(
      d,
      -ellipsoid(x, y, z, s * 1, 0.04, -0.115, 0.27, 0.36, 0.2),
      0.025,
    );
  return d;
}
// Regions define the primary envelope and growth flow. Staggered rows attach
// medium clumps along that flow; the crown wraps around an offset whorl.
export const growthRegions = [
  {
    name: "fringe",
    theta: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1],
    phi: [0.94, 0.72, 0.5],
    flow: -0.17,
    sweep: 0.38,
    lift: 0.2,
  },
  {
    name: "left-temple",
    theta: [-1.18, -1.48, -1.78],
    phi: [0.74, 0.98, 1.22, 1.46],
    flow: 0.37,
    sweep: -0.1,
    lift: 0.19,
  },
  {
    name: "right-temple",
    theta: [1.18, 1.48, 1.78],
    phi: [0.76, 1.0, 1.24, 1.48],
    flow: 0.39,
    sweep: 0.15,
    lift: 0.23,
  },
  {
    name: "crown",
    theta: [
      -2.95, -2.5, -2.05, -1.6, -1.15, -0.7, -0.25, 0.2, 0.65, 1.1, 1.55, 2.0,
      2.45, 2.9,
    ],
    phi: [0.14, 0.38, 0.62],
    flow: 0.38,
    sweep: 0.52,
    lift: 0.25,
  },
  {
    name: "occiput",
    theta: [-3.05, -2.8, -2.55, -2.3, -2.05, 2.05, 2.3, 2.55, 2.8, 3.05],
    phi: [0.82, 1.07, 1.32, 1.57, 1.82],
    flow: 0.35,
    sweep: 0.12,
    lift: 0.22,
  },
  {
    name: "nape",
    theta: [-3, -2.65, -2.3, -1.95, 1.95, 2.3, 2.65, 3],
    phi: [1.99],
    flow: 0.16,
    sweep: 0.12,
    lift: 0.16,
  },
];
