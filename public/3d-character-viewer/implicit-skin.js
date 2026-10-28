import * as THREE from "../character-3d/vendor/three.module.js";
import { surfaceNets } from "./surface-nets.js?sculpt=2";
// A landmark loft, not a union of primitive facial balls. Each section specifies
// mandibular/frontal/occipital breadth and depth independently.
const sections = [
  [-1.2, 0.015, 0.13, 0.02],
  [-1.13, 0.23, 0.39, -0.13],
  [-1.02, 0.39, 0.47, -0.27],
  [-0.84, 0.54, 0.45, -0.4],
  [-0.64, 0.67, 0.48, -0.51],
  [-0.4, 0.73, 0.47, -0.64],
  [-0.14, 0.83, 0.44, -0.77],
  [0.1, 0.87, 0.43, -0.86],
  [0.36, 0.84, 0.47, -0.88],
  [0.6, 0.8, 0.51, -0.86],
  [0.83, 0.73, 0.49, -0.77],
  [1.02, 0.59, 0.39, -0.59],
  [1.14, 0.36, 0.22, -0.36],
  [1.2, 0.015, -0.04, -0.05],
];
const clamp = THREE.MathUtils.clamp,
  smooth = THREE.MathUtils.smoothstep;
const gauss = (v) => Math.exp(-v * v);
export const bump = (x, y, cx, cy, sx, sy) =>
  gauss((x - cx) / sx) * gauss((y - cy) / sy);
export const mouthLine = (x) => -0.49 + 0.23 * (x / 0.65) ** 2 + 0.035 * x;
export function eyeLandmark(s) {
  return {
    x: s * 0.393,
    y: s < 0 ? 0.292 : 0.316,
    z: 0.135,
    tilt: s < 0 ? -0.075 : 0.12,
    width: s < 0 ? 0.222 : 0.211,
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
    f += 0.044 * gauss((eq - 1.13) / 0.36) * (0.9 + 0.1 * Math.sin(ex * 7));
    f +=
      0.022 * bump(x, y, e.x - Math.sign(e.x) * 0.19, e.y - 0.01, 0.031, 0.027);
    f -= 0.05 * bump(x, y, e.x, e.y, 0.27, 0.13); // orbital depression, not protruding globes
    f += 0.052 * bump(x, y, e.x, e.y - 0.112, 0.25, 0.062); // orbicularis lower shelf
    f -= 0.018 * bump(x, y, e.x, e.y - 0.173, 0.24, 0.022); // under-eye fold
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
  f += 0.16 * bump(x, y, 0.004, -0.137, 0.043, 0.065);
  // Philtral columns, cupid's bow, vermilion and labiomental transition.
  f +=
    0.026 * bump(x, y, -0.047, -0.239, 0.024, 0.079) +
    0.021 * bump(x, y, 0.045, -0.235, 0.023, 0.075);
  f -= 0.019 * bump(x, y, 0, -0.245, 0.025, 0.07);
  const u = x / 0.665,
    c = mouthLine(x),
    h = 0.145 * Math.sqrt(Math.max(0, 1 - u * u));
  if (Math.abs(u) < 1.08) {
    const cupid =
      0.022 * gauss(x / 0.07) -
      0.014 * (gauss((x - 0.1) / 0.05) + gauss((x + 0.1) / 0.05));
    f += 0.036 * gauss((y - (c + h + 0.025 + cupid)) / 0.061) * gauss(x / 0.6);
    f += 0.043 * gauss((y - (c - h - 0.028)) / 0.065) * gauss(x / 0.57);
  }
  f -= 0.039 * bump(x, y, 0.005, -0.795, 0.28, 0.041);
  f += 0.075 * bump(x, y, 0.025, -0.975, 0.28, 0.13); // mental eminence
  // Restrained broad asymmetry, no random surface noise.
  f +=
    0.02 * bump(x, y, -0.48, -0.12, 0.3, 0.3) -
    0.011 * bump(x, y, 0.29, 0.62, 0.2, 0.2);
  return f;
}
function auricleField(x, y, z) {
  const sign = x < 0 ? -1 : 1,
    ax = Math.abs(x),
    side = sign < 0 ? -0.018 : 0.016;
  const v = (y - 0.045 - side) / 0.335;
  const u = (ax - (0.988 + 0.048 * v + 0.03 * v * v)) / 0.228;
  const outline =
    1 +
    (0.29 + (sign < 0 ? 0.035 : 0)) * gauss((Math.atan2(v, u) - 0.75) / 0.25);
  const q = Math.hypot(u, v) / outline,
    base = -0.135 - 0.1 * u;
  const helix = 0.056 * gauss((q - 0.85) / 0.105);
  const fork = 0.43 + 0.12 * v - 0.18 * v * v;
  const anti =
    0.036 * gauss((u - fork) / 0.12) * gauss((v - 0.15) / 0.65) +
    0.025 * gauss((u + 0.1 + 0.45 * v) / 0.13) * gauss((v - 0.48) / 0.27);
  const concha = -0.046 * gauss((u + 0.3) / 0.37) * gauss((v + 0.04) / 0.43);
  const front = base + 0.07 + helix + anti + concha;
  const back = base - 0.02 - 0.013 * gauss(q / 0.7);
  let d = smax((q - 1) * 0.22, smax(z - front, back - z, 0.008), 0.012);
  // Lobule, tragus and antitragus emerge from the root, not decorative tubes.
  d = smin(
    d,
    ellipsoid(x, y, z, sign * 0.912, -0.194 + side, -0.11, 0.1, 0.105, 0.074),
    0.036,
  );
  d = smin(
    d,
    ellipsoid(x, y, z, sign * 0.901, 0.006 + side, -0.02, 0.055, 0.06, 0.055),
    0.028,
  );
  d = smin(
    d,
    ellipsoid(x, y, z, sign * 0.958, -0.079 + side, -0.02, 0.05, 0.031, 0.039),
    0.02,
  );
  const canal = ellipsoid(
    x,
    y,
    z,
    sign * 0.955,
    -0.012 + side,
    -0.038,
    0.026,
    0.034,
    0.085,
  );
  return smax(d, -canal, 0.006);
}
export const sampleColumn = (x, y) => ({
  w: Math.max(0.012, section(y, 1)),
  front: section(y, 2),
  back: section(y, 3),
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
  const radius = Math.max(
    0.015,
    rz + (column.relief / sideFactor) * smooth(z, cz - 0.06, cz + 0.06),
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
  d = smin(d, tip, 0.075);
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
      y,
      z,
      sign * 0.103,
      -0.142,
      0.726,
      0.036,
      0.026,
      0.12,
    );
    d = smax(d, -nostril, 0.008);
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
  return surfaceNets(anatomyField, sampleColumn, skinColor);
}
