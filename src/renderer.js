import { drawClownRig } from "./clown-rig.js";
// Shared stage renderer; the clown uses the approved model-sheet rig.
export function drawScene(canvas, state, options, time) {
  const ctx = canvas.getContext("2d"),
    W = 1280,
    H = 720,
    t = options.idle === "still" ? 0 : time;
  const { levels, bassDrive, midDrive, eyeAccent, mouthAccent, clownHair } =
    state;
  const idle =
    options.idle === "still" ? 0 : options.idle === "restless" ? 1.6 : 1;
  function palette() {
    let p = options.palette;
    return p === "red"
      ? { bg: "#230a10", ink: "#e9d2b3", accent: "#ec4455" }
      : p === "mono"
        ? { bg: "#eee", ink: "#080808", accent: "#777" }
        : { bg: "#e9d9bf", ink: "#171018", accent: "#ad293c" };
  }
  function text(x, y, str, size, color, align = "center") {
    ctx.fillStyle = color;
    ctx.font = `${size}px Georgia,serif`;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  }
  function pathFill(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.closePath();
    ctx.fill();
  }
  function eyes(x, y, spread, glow) {
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(
      x - spread,
      y,
      14 + levels.high * 16,
      10 + levels.high * 10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      x + spread,
      y,
      14 + levels.high * 16,
      10 + levels.high * 10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  function approach(value, target, dt, attack, release) {
    let tau = (target > value ? attack : release) / 1000;
    return (
      value + (target - value) * (1 - Math.exp(-dt / Math.max(0.005, tau)))
    );
  }
  function clown(p, t) {
    drawClownRig(ctx, state, options, t);
  }
  function hand(x, y, scale, angle, p, t, flip = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale * flip, scale);
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.moveTo(-42, 230);
    ctx.lineTo(-58, 45);
    ctx.bezierCurveTo(-90, 8, -98, -32, -86, -48);
    ctx.bezierCurveTo(-67, -72, -44, -18, -29, 0);
    for (let i = 0; i < 4; i++) {
      let a = -56 + i * 33,
        h = 130 + (i % 2) * 45 + levels.mid * 35;
      ctx.lineTo(a - 16, -35);
      ctx.lineTo(a - 24, -h);
      ctx.quadraticCurveTo(a, -h - 38, a + 10, -h);
      ctx.lineTo(a + 17, -35);
    }
    ctx.lineTo(85, 12);
    ctx.quadraticCurveTo(108, 85, 53, 120);
    ctx.lineTo(45, 230);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function hands(p, t) {
    for (let i = 0; i < 7; i++) {
      let side = i % 2 ? -1 : 1,
        x = side === 1 ? W + 30 : -30,
        y = 80 + i * 93;
      hand(
        x,
        y,
        0.9 + 0.2 * i + levels.bass * 0.3,
        side * (1.4 + Math.sin(t * 0.7 + i) * 0.24),
        p,
        t,
        side,
      );
    }
  }
  function ringmaster(p, t) {
    ctx.save();
    ctx.translate(W / 2, H / 2 + 65);
    ctx.rotate(Math.sin(t * 0.35) * 0.03);
    ctx.scale(1 + levels.bass * 0.08, 1 + levels.bass * 0.08);
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(0, 230, 250, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    pathFill(
      [
        [-145, 210],
        [-90, -50],
        [90, -50],
        [145, 210],
      ],
      p.ink,
    );
    ctx.beginPath();
    ctx.arc(0, -120, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-80, -295, 160, 140);
    ctx.fillRect(-135, -160, 270, 22);
    ctx.fillStyle = p.accent;
    ctx.fillRect(-80, -183, 160, 15);
    eyes(0, -122, 35, p.bg);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(80, -5);
    ctx.lineTo(240, 45 + Math.sin(t * 2) * 40);
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(240, 45 + Math.sin(t * 2) * 40);
    ctx.lineTo(270, 220);
    ctx.stroke();
    ctx.restore();
  }
  function tent(p, t) {
    let sway = Math.sin(t * 0.5) * 15;
    pathFill(
      [
        [120, 580],
        [190, 200],
        [W / 2 + sway, 45],
        [1090, 200],
        [1160, 580],
      ],
      p.ink,
    );
    for (let i = 0; i < 9; i++) {
      let x = 170 + i * 117;
      pathFill(
        [
          [W / 2 + sway, 45],
          [x, 580],
          [x + 56, 580],
        ],
        i % 2 ? p.bg : p.accent,
      );
    }
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.ellipse(
      W / 2,
      580,
      165 + levels.bass * 110,
      185 + levels.bass * 40,
      0,
      Math.PI,
      Math.PI * 2,
    );
    ctx.fill();
    text(W / 2, 650, "ENTER IF YOU DARE", 44, p.ink);
  }
  const p = palette();
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = i % 2 ? p.ink : p.accent;
    ctx.fillRect((i * 71 + Math.sin(t + i) * 13) % W, 0, 2, H);
  }
  ctx.restore();
  (({ clown, hands, ringmaster, tent })[options.scene] || clown)(p, t);
  if (options.flash && state.beat > 0.2) {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = state.beat * 0.055;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = p.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.globalAlpha = 1;
}
