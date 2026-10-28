// The production adapter imports the approved geometry and materials, not a copy.
import { createRenderer, POSES } from "../public/mouth-prototype/rig.js";
import { gazeTarget } from "./character-motion.js";
const records = new WeakMap();
let artwork = null,
  assetError = null;
const image = new Image();
image.onload = () => {
  artwork = image;
};
image.onerror = () => {
  assetError = "Character ornament image did not load";
};
image.src = new URL("../clown-head.png", import.meta.url).href;
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function hairPlate() {
  const c = canvas(900, 1100),
    x = c.getContext("2d");
  x.drawImage(artwork, 74, 180, 752.4, 752.4);
  x.save();
  x.translate(74, 180);
  x.scale(0.6, 0.6);
  x.globalCompositeOperation = "destination-out";
  x.beginPath();
  for (const [i, point] of [
    [335, 700],
    [330, 600],
    [355, 480],
    [415, 350],
    [530, 285],
    [670, 280],
    [790, 340],
    [865, 430],
    [920, 590],
    [930, 750],
    [940, 1030],
    [800, 1254],
    [455, 1254],
    [315, 1030],
  ].entries())
    i ? x.lineTo(...point) : x.moveTo(...point);
  x.closePath();
  x.fill();
  x.restore();
  return c;
}
function eye(ctx, cx, cy, gaze, pupil) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 44, cy + 4);
  ctx.bezierCurveTo(cx - 25, cy - 24, cx + 23, cy - 25, cx + 44, cy + 6);
  ctx.bezierCurveTo(cx + 18, cy + 22, cx - 21, cy + 22, cx - 44, cy + 4);
  ctx.closePath();
  ctx.fillStyle = "#061e2b";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#082333";
  ctx.stroke();
  ctx.clip();
  const white = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
  white.addColorStop(0, "#f5dfac");
  white.addColorStop(1, "#9e5a43");
  ctx.fillStyle = white;
  ctx.fillRect(cx - 50, cy - 30, 100, 65);
  ctx.translate(cx + gaze.x, cy + gaze.y);
  const iris = ctx.createRadialGradient(0, 0, 4, 0, 0, 20);
  iris.addColorStop(0, "#386216");
  iris.addColorStop(0.7, "#9de641");
  iris.addColorStop(1, "#304e20");
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  for (let i = 0; i < 90; i++) {
    const a = (i * Math.PI) / 45;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.strokeStyle = i % 3 ? "#33531b99" : "#d6f57488";
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5 + Math.max(0, Math.min(1, pupil || 0)) * 9, 0, Math.PI * 2);
  ctx.fillStyle = "#060e09";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5, -7, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#f8efc6";
  ctx.fill();
  ctx.restore();
}
export function approvedStatus(canvas) {
  return records.get(canvas)?.stats ?? null;
}
export function drawApprovedCharacter(ctx, state, options, time, stage) {
  const destination = ctx.canvas;
  let r = records.get(destination);
  if (!r) {
    try {
      const surface = canvas(900, 900);
      r = {
        surface,
        portrait: canvas(900, 1100),
        render: createRenderer(surface),
        last: -Infinity,
        cost: 0,
        slow: 0,
        plate: null,
        stats: {},
      };
      records.set(destination, r);
      surface.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        r.lost = true;
      });
      surface.addEventListener("webglcontextrestored", () => {
        r.render = createRenderer(surface);
        r.lost = false;
        r.last = -Infinity;
      });
    } catch (error) {
      destination.dataset.characterRenderer = "legacy-fallback";
      destination.dataset.characterError = error.message;
      return false;
    }
  }
  if (r.lost) {
    destination.dataset.characterRenderer = "legacy-fallback";
    destination.dataset.characterError = "WebGL context lost";
    return false;
  }
  const quality = options.characterQuality ?? "auto",
    economy = quality === "economy" || (quality === "auto" && r.slow > 8);
  const targetFPS = economy ? 24 : quality === "high" ? 60 : 30;
  const height = Math.min(stage.height - 48, ((stage.width - 64) * 1000) / 900),
    scale = height / 1000;
  const requested = Math.ceil((800 * scale * ctx.getTransform().a) / 128) * 128;
  const resolution = Math.max(
    384,
    Math.min(economy ? 512 : quality === "high" ? 1200 : 1024, requested),
  );
  if (r.surface.width !== resolution) {
    r.surface.width = resolution;
    r.surface.height = resolution;
    r.last = -Infinity;
  }
  const changed = state !== r.state || time !== r.time || quality !== r.quality;
  if (
    (changed && performance.now() - r.last > 1000 / targetFPS) ||
    !r.stats.triangles
  ) {
    const started = performance.now();
    r.stats = r.render(state.anatomy?.params ?? POSES.closed, {
      transparent: true,
      wire: options.characterWire ?? false,
      costume: true,
    });
    r.cost = r.cost * 0.85 + (performance.now() - started) * 0.15;
    if (r.cost > 30) r.slow++;
    else r.slow = Math.max(0, r.slow - 0.05);
    r.last = performance.now();
    r.state = state;
    r.time = time;
    r.quality = quality;
  }
  if (artwork && !r.plate) r.plate = hairPlate();
  const p = r.portrait.getContext("2d");
  p.clearRect(0, 0, 900, 1100);
  if (r.plate) p.drawImage(r.plate, 0, 0);
  p.drawImage(r.surface, 50, 280, 800, 800);
  // Original hair, ears and upper forehead are immutable ornaments. The masked
  // lower face is completely absent; all oral tissue and teeth are the mesh.
  if (r.plate) p.drawImage(r.plate, 0, 0);
  const idle =
    options.idle === "still" ? 0 : options.idle === "restless" ? 1.6 : 1;
  const gaze = gazeTarget(time, {
    ...(state.anatomy ?? {}),
    gazeIdle: (state.anatomy?.gazeIdle ?? 1) * idle,
  });
  p.save();
  p.translate(0, 180);
  eye(p, 362, 270, gaze, state.anatomy?.pupil);
  eye(p, 536, 270, gaze, state.anatomy?.pupil);
  if (artwork) {
    p.save();
    p.beginPath();
    p.ellipse(450, 330, 51, 48, 0, 0, Math.PI * 2);
    p.clip();
    p.drawImage(artwork, 74, -150, 752.4, 752.4);
    p.restore();
  }
  p.restore();
  ctx.save();
  ctx.translate(
    stage.width / 2 + Math.sin(time * 0.31) * 7 * idle,
    stage.height / 2 + Math.sin(time * 0.58) * 5 * idle,
  );
  ctx.rotate(Math.sin(time * 0.39) * 0.012 * idle);
  ctx.scale(scale, scale);
  ctx.drawImage(r.portrait, 0, 100, 900, 1000, -450, -500, 900, 1000);
  ctx.restore();
  destination.dataset.characterRenderer = "approved-mesh";
  destination.dataset.rigSource = "public/mouth-prototype/rig.js";
  destination.dataset.meshTriangles = String(r.stats.triangles);
  destination.dataset.characterQuality = economy ? "economy" : quality;
  destination.dataset.characterError = assetError ?? "";
  r.stats = {
    ...r.stats,
    source: "public/mouth-prototype/rig.js",
    resolution,
    targetFPS,
    renderMs: r.cost,
    economy,
    gaze,
    pupil: state.anatomy?.pupil ?? 0,
    headBounds: { width: 900 * scale, height: 1000 * scale },
    stage,
  };
  return true;
}
