// The uploaded neutral head and approved dental atlas retain the vintage ink artwork.
export const REFERENCE_URL = new URL(
  "../Vintage Horror Clown Model Sheet.png",
  import.meta.url,
).href;
export const DENTITION = Object.freeze({
  upper: Object.freeze({
    source: [700, 443, 226, 72],
    scale: 0.55,
    incisors: 2,
    fangs: 2,
  }),
  lower: Object.freeze({ source: [713, 514, 195, 74], scale: 0.55 }),
});
let assets = null,
  loading = null,
  loadError = null;
const clamp = (v) => Math.max(0, Math.min(1, v || 0));
function surface(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export function mouthPose(openness) {
  const x = clamp(openness),
    extra = 12 * x * x * (3 - 2 * x);
  return {
    openness: x,
    extra,
    chinY: 410 + extra,
    teethScale: DENTITION.upper.scale,
  };
}
export function rigStatus() {
  return { ready: !!assets, error: loadError };
}
export function loadClownRig() {
  if (loading) return loading;
  const load = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(Error("Approved clown artwork could not load."));
      image.src = url;
    });
  loading = Promise.all([
    load(REFERENCE_URL),
    load(new URL("../clown-head.png", import.meta.url).href),
  ])
    .then(
      ([image, head]) =>
        (assets = {
          image,
          head,
          upperTeeth: teethSprite(image, DENTITION.upper.source),
          lowerTeeth: teethSprite(image, DENTITION.lower.source),
        }),
    )
    .catch((error) => {
      loadError = error.message;
      throw error;
    });
  return loading;
}
function teethSprite(image, source) {
  const [sx, sy, w, h] = source,
    c = surface(w, h),
    ctx = c.getContext("2d");
  ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h),
    pixels = data.data,
    ivory = new Uint8Array(w * h);
  for (let i = 0; i < ivory.length; i++) {
    const [r, g, b] = pixels.slice(i * 4, i * 4 + 3);
    if (r > 95 && g > 70 && b > 37 && r < g * 1.9) ivory[i] = 1;
  }
  // Discard isolated gum highlights while retaining the connected ivory of each tooth.
  const seen = new Uint8Array(w * h);
  for (let seed = 0; seed < ivory.length; seed++) {
    if (!ivory[seed] || seen[seed]) continue;
    const component = [seed];
    seen[seed] = 1;
    for (let at = 0; at < component.length; at++) {
      const i = component[at],
        x = i % w,
        y = Math.floor(i / w);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx,
          yy = y + dy,
          j = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && ivory[j] && !seen[j]) {
          seen[j] = 1;
          component.push(j);
        }
      }
    }
    if (component.length < 12) for (const i of component) ivory[i] = 0;
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let keep = false;
      for (let dy = -1; dy <= 1 && !keep; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < h && ivory[yy * w + xx]) {
            keep = true;
            break;
          }
        }
      if (!keep) pixels[(y * w + x) * 4 + 3] = 0;
    }
  ctx.putImageData(data, 0, 0);
  return c;
}

// All contours have matching cubic topology, so every control point can interpolate.
export function lipPath(ctx, p, border = 0) {
  const cx = 212,
    w = p.span / 2 + border,
    top = p.top - border,
    bottom = p.bottom + border;
  ctx.beginPath();
  ctx.moveTo(cx - w, p.corner);
  ctx.bezierCurveTo(
    cx - w * 0.67,
    p.corner - p.curl,
    cx - w * 0.35,
    top - p.bow,
    cx,
    top,
  );
  ctx.bezierCurveTo(
    cx + w * 0.35,
    top - p.bow,
    cx + w * 0.67,
    p.corner - p.curl,
    cx + w,
    p.corner,
  );
  ctx.bezierCurveTo(
    cx + w * p.cheek,
    p.corner + (bottom - p.corner) * 0.75,
    cx + w * 0.4,
    bottom,
    cx,
    bottom,
  );
  ctx.bezierCurveTo(
    cx - w * 0.4,
    bottom,
    cx - w * p.cheek,
    p.corner + (bottom - p.corner) * 0.75,
    cx - w,
    p.corner,
  );
  ctx.closePath();
}
function drawHead(ctx, p) {
  // Keep the upper plate intact; only the short jaw below the nose deforms.
  const cut = (300 / 423) * assets.head.height;
  ctx.drawImage(assets.head, 0, 0, assets.head.width, cut, 0, 0, 423, 300);
  ctx.drawImage(
    assets.head,
    0,
    cut,
    assets.head.width,
    assets.head.height - cut,
    0,
    300,
    423,
    123 + p.jaw,
  );
}
function drawMouth(ctx, p) {
  ctx.save();
  lipPath(ctx, p, 5);
  const paint = ctx.createLinearGradient(0, p.top - 5, 0, p.bottom + 5);
  paint.addColorStop(0, "#63231d");
  paint.addColorStop(0.3, "#aa3826");
  paint.addColorStop(0.72, "#87291f");
  paint.addColorStop(1, "#bd5940");
  ctx.fillStyle = paint;
  ctx.fill();
  ctx.strokeStyle = "#291b17";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Engraved creases follow the lip paint rather than stretching a texture rectangle.
  ctx.save();
  lipPath(ctx, p, 5);
  ctx.clip();
  ctx.strokeStyle = "#441e17";
  ctx.lineWidth = 0.25;
  for (let i = -18; i <= 18; i++) {
    const x = 212 + i * 4;
    ctx.beginPath();
    ctx.moveTo(x, p.top - 7);
    ctx.lineTo(x + i * 0.04, p.top + 2);
    ctx.moveTo(x, p.bottom - 2);
    ctx.lineTo(x + i * 0.05, p.bottom + 7);
    ctx.stroke();
  }
  ctx.restore();
  if (p.bottom - p.top > 0.2) {
    ctx.save();
    lipPath(ctx, p);
    ctx.clip();
    ctx.fillStyle = "#160f11";
    ctx.fillRect(100, 290, 230, 120);
    const middle = 356;
    // Each rigid arch has its own half-space: teeth cannot intersect during closure.
    ctx.save();
    ctx.beginPath();
    ctx.rect(100, 290, 230, middle - 290);
    ctx.clip();
    ctx.drawImage(
      assets.upperTeeth,
      212 - (226 * 0.55) / 2,
      316,
      226 * 0.55,
      72 * 0.55,
    );
    ctx.fillStyle = "#7c3427";
    ctx.beginPath();
    ctx.moveTo(145, 312);
    ctx.quadraticCurveTo(212, 320, 279, 312);
    ctx.lineTo(279, 321);
    ctx.quadraticCurveTo(212, 325, 145, 321);
    ctx.fill();
    ctx.strokeStyle = "#311c18";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(100, middle, 230, 410 - middle);
    ctx.clip();
    ctx.drawImage(
      assets.lowerTeeth,
      212 - (195 * 0.55) / 2,
      p.bottom - 74 * 0.55,
      195 * 0.55,
      74 * 0.55,
    );
    ctx.fillStyle = "#763126";
    ctx.beginPath();
    ctx.moveTo(152, p.bottom - 4);
    ctx.quadraticCurveTo(212, p.bottom - 1, 272, p.bottom - 4);
    ctx.lineTo(272, p.bottom + 5);
    ctx.lineTo(152, p.bottom + 5);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    lipPath(ctx, p);
    ctx.strokeStyle = "#361b17";
    ctx.lineWidth = 1.1;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(212 - p.span / 2, p.corner);
    ctx.bezierCurveTo(
      180,
      p.top - 3,
      244,
      p.top - 3,
      212 + p.span / 2,
      p.corner,
    );
    ctx.strokeStyle = "#321b18";
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }
  ctx.restore();
}
// One gaze vector drives both eyes; pupil radius never changes iris geometry.
export function eyeGeometry(rig, idle, time) {
  const drift = (rig?.gazeIdle ?? 1) * idle;
  return {
    dx: (rig?.gazeX ?? 0) * 8 + Math.sin(time * 0.28) * 7 * drift,
    dy: (rig?.gazeY ?? 0) * 4 + Math.sin(time * 0.21) * 3 * drift,
    irisRadius: 10.6,
    pupilRadius: 3.1 + clamp(rig?.eye) * 4.2,
  };
}
function eyeBoundary(ctx, cx, cy, side) {
  ctx.beginPath();
  ctx.moveTo(cx - 25, cy + 4);
  ctx.bezierCurveTo(cx - 16, cy - 10, cx - 8, cy - 11, cx, cy - 10);
  ctx.bezierCurveTo(cx + 12, cy - 11, cx + 20, cy - 3, cx + 25, cy + 5);
  ctx.bezierCurveTo(cx + 9, cy + 12, cx - 12, cy + 12, cx - 25, cy + 4);
  ctx.closePath();
}
function drawEye(ctx, cx, cy, side, gaze) {
  ctx.save();
  eyeBoundary(ctx, cx, cy, side);
  ctx.clip();
  const sclera = ctx.createRadialGradient(cx, cy, 5, cx, cy, 27);
  sclera.addColorStop(0, "#f1d6a5");
  sclera.addColorStop(0.72, "#d8b489");
  sclera.addColorStop(1, "#9c5947");
  ctx.fillStyle = sclera;
  ctx.fillRect(cx - 30, cy - 18, 60, 40);
  ctx.strokeStyle = "#a95843";
  ctx.lineWidth = 0.35;
  for (const sign of [-1, 1])
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + sign * 25, cy + 3 + i);
      ctx.lineTo(cx + sign * (17 + i), cy + i - 2);
      ctx.lineTo(cx + sign * (13 + i), cy + i - 1);
      ctx.stroke();
    }
  ctx.translate(cx + gaze.dx, cy + gaze.dy);
  const iris = ctx.createRadialGradient(0, 0, 2, 0, 0, gaze.irisRadius);
  iris.addColorStop(0, "#284719");
  iris.addColorStop(0.45, "#77c231");
  iris.addColorStop(0.78, "#a6e85c");
  iris.addColorStop(1, "#385826");
  ctx.beginPath();
  ctx.arc(0, 0, gaze.irisRadius, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  // Radial ink strokes retain an engraved, rather than glossy, iris.
  for (let i = 0; i < 100; i++) {
    const a = (i * Math.PI * 2) / 100,
      r = 4 + (Math.sin(i * 7.3) + 1) * 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * 10.1, Math.sin(a) * 10.1);
    ctx.strokeStyle = i % 3 ? "#36551c99" : "#d3f77b99";
    ctx.lineWidth = 0.28;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, gaze.pupilRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#080e0b";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3, -4, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#f6f4cc";
  ctx.fill();
  ctx.restore();
}
export function drawClownRig(ctx, state, options, time) {
  if (!assets) {
    if (!loading) loadClownRig().catch(() => {});
    return;
  }
  const idle =
    options.idle === "still" ? 0 : options.idle === "restless" ? 1.6 : 1;
  const p = state.rig?.span
    ? state.rig
    : interpolatePose(
        RIG_POSES.closed,
        RIG_POSES.a,
        clamp(state.rig?.mouth ?? state.mouthAccent),
      );
  ctx.save();
  ctx.translate(
    640 + idle * Math.sin(time * 0.31) * 8,
    36 + idle * Math.sin(time * 0.58) * 7,
  );
  ctx.rotate(idle * Math.sin(time * 0.39) * 0.015);
  ctx.scale(1.34, 1.34);
  ctx.translate(-211.5, 0);
  drawHead(ctx, p);
  drawMouth(ctx, p);
  const gaze = eyeGeometry(state.rig, idle, time);
  drawEye(ctx, 162, 236, -1, gaze);
  drawEye(ctx, 260, 236, 1, gaze);
  ctx.restore();
}
import { RIG_POSES, interpolatePose } from "./rig-motion.js";
