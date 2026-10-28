import * as THREE from "../../character-3d/vendor/three.module.js";
import { surfaceNets } from "./surface-nets.js?sculpt=3";
// A landmark loft, not a union of primitive facial balls. Each section specifies
// mandibular/frontal/occipital breadth and depth independently.
const sections = [
  [-1.2, 0.015, 0.13, 0.02, 0.02],
  [-1.13, 0.23, 0.39, -0.13, -0.13],
  [-1.02, 0.39, 0.43, -0.27, -0.3],
  [-0.84, 0.54, 0.43, -0.4, -0.49],
  [-0.64, 0.67, 0.48, -0.51, -0.69],
  [-0.4, 0.73, 0.47, -0.64, -0.94],
  [-0.14, 0.83, 0.44, -0.77, -1.15],
  [0.1, 0.87, 0.43, -0.86, -1.27],
  [0.36, 0.84, 0.47, -0.88, -1.29],
  [0.6, 0.8, 0.51, -0.86, -1.24],
  [0.83, 0.73, 0.49, -0.77, -1.1],
  [1.02, 0.59, 0.39, -0.59, -0.86],
  [1.14, 0.36, 0.22, -0.36, -0.53],
  [1.2, 0.015, -0.04, -0.05, -0.05],
];
const clamp = THREE.MathUtils.clamp,
  smooth = THREE.MathUtils.smoothstep;
const gauss = (v) => Math.exp(-v * v);
export const bump = (x, y, cx, cy, sx, sy) =>
  gauss((x - cx) / sx) * gauss((y - cy) / sy);
export const mouthLine = (x) => -0.49 + 0.23 * (x / 0.65) ** 2 + 0.035 * x;
export function lipLandmarks(x) {
  const u = x / 0.665,
    c = mouthLine(x),
    h = 0.145 * Math.sqrt(Math.max(0, 1 - u * u));
  return { upper: c + h, lower: c - h, span: Math.max(0, 1 - u * u) ** 0.58 };
}
export function eyeLandmark(s) {
  return {
    x: s * 0.393,
    y: s < 0 ? 0.292 : 0.316,
    z: 0.145,
    tilt: s < 0 ? -0.075 : 0.12,
    width: s < 0 ? 0.203 : 0.196,
    height: s < 0 ? 0.067 : 0.058,
  };
}
export function ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const a = (x - cx) / rx,
    b = (y - cy) / ry,
    c = (z - cz) / rz;
  const k = Math.hypot(a, b, c),
    j = Math.hypot(a / rx, b / ry, c / rz);
  return j ? (k * (k - 1)) / j : -Math.min(rx, ry, rz);
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
function section(y, k) {
  let i = 0;
  while (i < sections.length - 2 && y > sections[i + 1][0]) i++;
  const a = sections[i],
    b = sections[i + 1],
    t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  const prev = sections[Math.max(i - 1, 0)],
    next = sections[Math.min(i + 2, sections.length - 1)];
  const m0 = ((b[k] - prev[k]) / (b[0] - prev[0])) * (b[0] - a[0]);
  const m1 = ((next[k] - a[k]) / (next[0] - a[0])) * (b[0] - a[0]);
  return (
    (2 * t ** 3 - 3 * t * t + 1) * a[k] +
    (t ** 3 - 2 * t * t + t) * m0 +
    (-2 * t ** 3 + 3 * t * t) * b[k] +
    (t ** 3 - t * t) * m1
  );
}
export const posteriorExtension = (y) =>
  Math.max(0, section(y, 3) - section(y, 4));
function facialRelief(x, y) {
  let f = 0;
  // Frontal eminences with a central glabellar keel and swept temporal planes.
  f +=
    0.026 * bump(x, y, -0.26, 0.76, 0.3, 0.29) +
    0.04 * bump(x, y, 0.29, 0.78, 0.28, 0.27);
  f += 0.072 * bump(x, y, -0.025, 0.43, 0.115, 0.18);
  for (const s of [-1, 1]) {
    const e = eyeLandmark(s),
      a = Math.abs(x),
      browY = e.y + 0.14 + 0.085 * (a - 0.35);
    f += 0.092 * bump(x, y, s * 0.39, browY, 0.27, 0.085);
    f -= 0.067 * bump(x, y, s * 0.7, 0.39, 0.15, 0.27); // temporal fossa
    const ex = x - e.x,
      ey = y - e.y - e.tilt * ex,
      eq = Math.hypot(ex / e.width, ey / e.height);
    f += 0.038 * gauss((eq - 1.13) / 0.47) * (0.9 + 0.1 * Math.sin(ex * 7));
    f +=
      0.022 * bump(x, y, e.x - Math.sign(e.x) * 0.19, e.y - 0.01, 0.031, 0.027);
    f -= 0.05 * bump(x, y, e.x, e.y, 0.27, 0.13); // orbital depression, not protruding globes
    f += 0.052 * bump(x, y, e.x, e.y - 0.112, 0.25, 0.062); // orbicularis lower shelf
    f -= 0.014 * bump(x, y, e.x, e.y - 0.173, 0.24, 0.035); // under-eye fold
    f +=
      0.183 * bump(x, y, s * 0.64, -0.025 + (s < 0 ? 0.022 : 0), 0.185, 0.16); // zygomatic body
    f -= 0.095 * bump(x, y, s * 0.61, -0.3, 0.145, 0.15); // buccal hollow
    f += 0.06 * bump(x, y, s * 0.29, -0.25, 0.23, 0.19); // maxillary muzzle
    f += 0.036 * bump(x, y, s * 0.48, -0.78, 0.17, 0.2); // mandibular body
    const foldX = 0.23 + 0.88 * clamp(-y - 0.1, 0, 0.5);
    f -= 0.023 * bump(x, y, s * foldX, -0.28, 0.026, 0.18); // nasolabial crease
    f += 0.025 * bump(x, y, s * (foldX + 0.054), -0.27, 0.048, 0.18);
    f -= 0.04 * bump(x, y, s * 0.633, mouthLine(s * 0.633), 0.035, 0.058); // commissure dimple
  }
  // Nasal bridge, pear-shaped tip, alae and columella are a single relief.
  f += 0.12 * bump(x, y, -0.014, 0.23, 0.092, 0.24);
  f += 0.16 * bump(x, y, -0.008, -0.026, 0.17, 0.15);
  f +=
    0.16 * bump(x, y, -0.158, -0.082, 0.081, 0.07) +
    0.14 * bump(x, y, 0.153, -0.075, 0.077, 0.067);
  f += 0.13 * bump(x, y, 0.004, -0.137, 0.05, 0.07);
  // Philtrum and four fleshy vermilion regions blend into the maxillary skin.
  f +=
    0.042 * bump(x, y, -0.05, -0.235, 0.032, 0.085) +
    0.037 * bump(x, y, 0.047, -0.231, 0.031, 0.08);
  f -= 0.021 * bump(x, y, 0, -0.237, 0.024, 0.07);
  const { upper, lower, span } = lipLandmarks(x);
  if (span > 0) {
    // Cupid's bow: paired peaks with a central notch, not a uniform lip tube.
    const bow =
      0.014 * (gauss((x - 0.095) / 0.06) + gauss((x + 0.095) / 0.06)) -
      0.006 * gauss(x / 0.046);
    const upperY = upper + 0.024 + bow;
    const upperBorder = upper + 0.075 + bow;
    const body =
      0.06 * gauss((x - 0.17) / 0.29) + 0.052 * gauss((x + 0.19) / 0.28);
    f += body * gauss((y - upperY) / 0.052) * span;
    f -= 0.012 * gauss((y - upperBorder) / 0.023) * span * gauss(x / 0.55);
    f += 0.008 * gauss((y - (upperBorder + 0.021)) / 0.032) * span;
    f += 0.016 * bump(x, y, -0.008, upper + 0.009, 0.075, 0.032) * span; // tubercle
    f +=
      0.068 *
      gauss((y - (lower - 0.04)) / 0.063) *
      span *
      (0.9 + 0.1 * Math.sin(x * 5 + 0.3));
    f -= 0.015 * gauss((y - (lower - 0.108)) / 0.028) * gauss(x / 0.5); // lower vermilion border
    f += 0.023 * gauss((y - (upper + 0.09)) / 0.065) * gauss(x / 0.45); // upper white lip
  }
  f -= 0.024 * bump(x, y, 0.005, -0.805, 0.29, 0.06);
  f += 0.043 * bump(x, y, 0.025, -0.975, 0.28, 0.14); // retain the approved chin, reduce pogonion
  // Restrained broad asymmetry, no random surface noise.
  f +=
    0.02 * bump(x, y, -0.48, -0.12, 0.3, 0.3) -
    0.011 * bump(x, y, 0.29, 0.62, 0.2, 0.2);
  return f;
}
function auricleField(x, y, z) {
  const sign = x < 0 ? -1 : 1,
    side = sign < 0 ? -0.018 : 0.016;
  const v = (y - 0.045 - side) / 0.313;
  const u = (Math.abs(x) - (0.969 + 0.04 * v + 0.026 * v * v)) / 0.207;
  const outline =
    1 +
    (0.27 + (sign < 0 ? 0.025 : 0)) * gauss((Math.atan2(v, u) - 0.75) / 0.27);
  const q = Math.hypot(u, v) / outline,
    base = -0.155 - 0.085 * u;
  const helix = 0.049 * gauss((q - 0.86) / 0.11);
  const stem =
    0.066 * gauss((u - (0.22 + 0.13 * v)) / 0.16) * gauss((v + 0.02) / 0.58);
  const forkGate = smooth(v, 0.15, 0.35) * (1 - smooth(v, 0.65, 0.85));
  const fork =
    0.044 * gauss((u - (0.18 - 0.56 * (v - 0.2))) / 0.15) * forkGate +
    0.037 * gauss((u - (0.3 + 0.68 * (v - 0.2))) / 0.15) * forkGate;
  const scapha =
    -0.017 * gauss((q - 0.67) / 0.095) * (1 - smooth(-u, 0.2, 0.6));
  const concha =
    -0.032 * bump(u, v, -0.29, -0.12, 0.31, 0.38) -
    0.017 * bump(u, v, -0.15, 0.34, 0.3, 0.22);
  const tragus = 0.049 * bump(u, v, -0.53, -0.12, 0.18, 0.2);
  const antitragus = 0.039 * bump(u, v, -0.19, -0.47, 0.22, 0.16);
  const antiBody = 0.03 * bump(u, v, 0.18, 0.04, 0.4, 0.64);
  const front =
    base +
    0.068 +
    helix +
    stem +
    fork +
    antiBody +
    scapha +
    concha +
    tragus +
    antitragus;
  const back = base - 0.024 - 0.012 * gauss(q / 0.8);
  let d = smax((q - 1) * 0.21, smax(z - front, back - z, 0.012), 0.014);
  // A fleshy attached lobule; the tragus/antitragus are relief in this surface,
  // rather than isolated spherical additions floating around a through-hole.
  d = smin(
    d,
    ellipsoid(x, y, z, sign * 0.904, -0.192 + side, -0.145, 0.087, 0.09, 0.067),
    0.043,
  );
  const canal = ellipsoid(
    x,
    y,
    z,
    sign * 0.903,
    -0.023 + side,
    -0.064,
    0.024,
    0.03,
    0.053,
  );
  return smax(d, -canal, 0.01);
}
export const sampleColumn = (x, y) => ({
  w: Math.max(0.012, section(y, 1)),
  front: section(y, 2),
  back: section(y, 3),
  rear: section(y, 4),
  relief: facialRelief(x, y),
});
export function anatomyField(x, y, z, column = sampleColumn(x, y)) {
  const { w, front, back } = column,
    cz = (front + back) / 2,
    rz = (front - back) / 2;
  const ax = x + 0.014 * Math.sin(y * 2.1);
  // Expand the anterior radial half; translating a z-gated field can fold
  // back over itself beneath strong nasal/cheek relief. This map is monotonic.
  const sideFactor = Math.sqrt(Math.max(0.16, 1 - (ax / w) ** 2));
  const frontWeight = smooth(z, cz - 0.075, cz + 0.075);
  const posteriorRadius = Math.max(0.015, cz - column.rear);
  const radius = Math.max(
    0.015,
    THREE.MathUtils.lerp(posteriorRadius, rz, frontWeight) +
      (column.relief / sideFactor) * frontWeight,
  );
  const q = Math.hypot(ax / w, (z - cz) / radius);
  let d = (q - 1) * Math.min(w, Math.max(0.015, rz));
  d = smax(d, Math.max(-1.2 - y, y - 1.2), 0.015);
  // Paired alar cartilage flows into a pear-shaped nasal tip; this is blended
  // into the nasal root, not a separate red mesh.
  const tip = ellipsoid(
    x + 0.009 + 0.018 * y,
    y,
    z,
    0,
    -0.025,
    0.716,
    0.168 * (1 - 0.15 * y),
    0.163,
    0.188,
  );
  d = smin(d, tip, 0.095);
  for (const sign of [-1, 1]) {
    const e = eyeLandmark(sign),
      dx = x - e.x,
      dy = y - e.y - e.tilt * dx;
    // An almond aperture with tapered canthi, cut through a sculpted lid shelf.
    const h =
      e.height *
      (0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - (dx / e.width) ** 2)));
    const socket = ellipsoid(dx, dy, z, 0, 0, 0.52, e.width, h, 0.38);
    d = smax(d, -socket, 0.009);
    // The nostrils pass backwards and upwards into the integrated nasal alae.
    const nostril = ellipsoid(
      x,
      y + 0.2 * (z - 0.7),
      z,
      sign * 0.103,
      -0.15,
      0.7,
      0.04,
      0.032,
      0.09,
    );
    d = smax(d, -nostril, 0.022);
  }
  const oral = ellipsoid(
    x,
    y - mouthLine(x),
    z,
    0,
    0,
    0.69,
    0.665,
    0.145,
    0.79,
  );
  d = smax(d, -oral, 0.01);
  d = smin(d, auricleField(x, y, z), 0.055);
  return d;
}
export function skinColor(x, y, z) {
  const c = new THREE.Color(0xcfc2aa);
  const q = Math.hypot(x / 0.665, (y - mouthLine(x)) / 0.145);
  if (q < 1.08 && y < -0.15 && z < 0.58)
    c.lerp(new THREE.Color(0x241319), smooth(0.63 - z, 0, 0.3));
  if (q > 0.9 && q < 1.4 && y < -0.14 && z > 0.43)
    c.lerp(new THREE.Color(0x8c4144), 0.66 * gauss((q - 1.1) / 0.2));
  if (y > -0.17 && y < 0.14 && Math.abs(x) < 0.225 && z > 0.61)
    c.lerp(new THREE.Color(0xa52d37), smooth(z, 0.61, 0.76));
  return c;
}

export function createSkinGeometry() {
  return surfaceNets(anatomyField, sampleColumn, skinColor, {
    refine: (x, y, z) =>
      Math.abs(x) < 0.225 && y > -0.21 && y < 0.025 && z > 0.53,
  });
}
