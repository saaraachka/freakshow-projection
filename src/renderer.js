// Artwork and scene paths extracted unchanged from the original v4 app.
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
    ctx.save();
    // Two independent motion systems: slow autonomous haunt and reactive music accents.
    const floatY = idle * (Math.sin(t * 0.58) * 17 + Math.sin(t * 0.21) * 11);
    const floatX = idle * Math.sin(t * 0.31) * 13;
    ctx.translate(W / 2 + floatX, H / 2 + 12 + floatY);
    ctx.rotate(
      idle * (Math.sin(t * 0.39) * 0.043 + Math.sin(t * 0.16) * 0.021),
    );
    const eyeOpen = Math.min(1.5, 0.1 + bassDrive * 0.62 + eyeAccent * 0.92);
    const jawOpen = Math.min(1.5, 0.045 + midDrive * 0.66 + mouthAccent * 1.03);
    ctx.fillStyle = p.ink;
    for (let side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        let x = side * (180 + i * 32),
          y =
            -120 +
            Math.sin(t * 0.85 + i * 0.8) * 14 +
            Math.sin(t * 4.5 + i * 2) * clownHair * 14;
        ctx.beginPath();
        ctx.arc(x, y, 65 - i * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.beginPath();
    ctx.moveTo(-205, -130);
    ctx.bezierCurveTo(-240, -350, 240, -350, 205, -130);
    ctx.bezierCurveTo(260, 190, 130, 270, 0, 285);
    ctx.bezierCurveTo(-130, 270, -260, 190, -205, -130);
    ctx.fill();
    // Fixed eyebrows preserve the sinister expression while the sockets change shape.
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.moveTo(-160, -80);
    ctx.lineTo(-30, -30);
    ctx.lineTo(-150, -15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(160, -80);
    ctx.lineTo(30, -30);
    ctx.lineTo(150, -15);
    ctx.fill();
    // Dark socket apertures expand with bass; pupils wander slowly and pulse on hits.
    for (let side of [-1, 1]) {
      const cx = side * 92,
        cy = -39;
      const rx = 28 + eyeOpen * 33,
        ry = 20 + eyeOpen * 25;
      ctx.fillStyle = p.bg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, side * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 5 + eyeAccent * 3;
      ctx.stroke();
      const wanderX =
        Math.sin(t * 0.66 + side * 0.7) * Math.min(16, rx * 0.36) +
        Math.sin(t * 0.23) * 7;
      const wanderY = Math.sin(t * 0.43 + side) * Math.min(10, ry * 0.3);
      const pupil = 8 + eyeAccent * 13 + bassDrive * 6;
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(cx + wanderX, cy + wanderY, pupil, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.beginPath();
      ctx.arc(
        cx + wanderX - 3,
        cy + wanderY - 3,
        Math.max(2, pupil * 0.19),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-32, 40);
    ctx.lineTo(32, 40);
    ctx.fill();
    // The upper lip stays fixed; lower jaw is articulated downward, not an oval scale.
    const idleJaw = 3 + idle * Math.pow((Math.sin(t * 0.83) + 1) / 2, 4) * 13;
    const gape = idleJaw + jawOpen * 180;
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.moveTo(-105, 109);
    ctx.quadraticCurveTo(0, 92, 105, 109);
    ctx.bezierCurveTo(105, 136 + gape, 68, 145 + gape, 0, 148 + gape);
    ctx.bezierCurveTo(-68, 145 + gape, -105, 136 + gape, -105, 109);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.fillStyle = p.ink;
    for (let i = -3; i <= 3; i++) {
      let x = i * 26;
      ctx.fillRect(x - 9, 111, 18, Math.min(25, 9 + gape * 0.12));
    }
    ctx.restore();
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
