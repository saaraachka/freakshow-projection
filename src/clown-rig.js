// The approved sheet is the only texture atlas. Dentition is never regenerated per pose.
export const REFERENCE_URL = new URL(
  "../Vintage Horror Clown Model Sheet.png",
  import.meta.url,
).href;
export const DENTITION = Object.freeze({
  upper: Object.freeze({
    source: [700, 443, 226, 72],
    scale: 0.73,
    incisors: 2,
    fangs: 2,
  }),
  lower: Object.freeze({ source: [713, 514, 195, 74], scale: 0.73 }),
});
const WIDTH = 423,
  HEIGHT = 606,
  UPPER = 424,
  LOWER = 438;
const faceOutline = [
  [110, 151],
  [142, 123],
  [204, 111],
  [271, 122],
  [313, 151],
  [336, 214],
  [348, 299],
  [333, 371],
  [310, 430],
  [292, 496],
  [265, 553],
  [233, 596],
  [208, 605],
  [180, 589],
  [153, 548],
  [130, 489],
  [109, 423],
  [92, 347],
  [91, 263],
];
const closedOutline = [
  [110, 151],
  [142, 123],
  [204, 111],
  [271, 122],
  [313, 151],
  [336, 214],
  [348, 299],
  [333, 371],
  [309, 416],
  [290, 466],
  [268, 504],
  [240, 535],
  [211, 553],
  [181, 540],
  [155, 515],
  [135, 478],
  [116, 428],
  [92, 347],
  [91, 263],
];
let assets = null,
  loading = null,
  loadError = null;
const clamp = (v) => Math.max(0, Math.min(1, v || 0));
export function mouthPose(openness) {
  // C1-continuous ease; same geometry on the way in and out, independent of frame rate.
  const x = clamp(openness),
    ease = x * x * (3 - 2 * x),
    extra = 98 * ease;
  return {
    openness: x,
    extra,
    upperY: UPPER,
    lowerY: LOWER + extra,
    chinY: 553 + extra,
    teethScale: DENTITION.upper.scale,
  };
}
export function rigStatus() {
  return loadError
    ? { ready: false, error: loadError }
    : { ready: !!assets, error: null };
}
function surface(w = WIDTH, h = HEIGHT) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
function plate(image) {
  const out = surface(),
    ctx = out.getContext("2d");
  // A loose silhouette excludes the sheet's frame, captions and neighboring studies.
  const outline = [
    [195, 0],
    [246, 0],
    [275, 15],
    [304, 29],
    [345, 72],
    [347, 125],
    [332, 174],
    [354, 190],
    [382, 231],
    [411, 281],
    [423, 514],
    [386, 554],
    [344, 576],
    [300, 565],
    [265, 592],
    [233, 606],
    [181, 606],
    [141, 567],
    [92, 569],
    [37, 547],
    [0, 512],
    [0, 234],
    [30, 206],
    [50, 175],
    [85, 193],
    [104, 152],
    [82, 123],
    [78, 77],
    [94, 35],
    [131, 13],
    [172, 15],
  ];
  polygon(ctx, outline);
  ctx.clip();
  ctx.drawImage(image, 0, 0, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
  const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT),
    data = pixels.data,
    seen = new Uint8Array(WIDTH * HEIGHT),
    queue = new Int32Array(WIDTH * HEIGHT);
  let head = 0,
    tail = 0;
  const visit = (index) => {
    if (index < 0 || index >= seen.length || seen[index]) return;
    const p = index * 4,
      r = data[p],
      g = data[p + 1],
      b = data[p + 2];
    // Only paper connected to the outside is removed. Enclosed skin stays original.
    if (data[p + 3] === 0 || (r > 85 && g > 65 && b > 35 && r > b * 1.18)) {
      seen[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < WIDTH; x++) {
    visit(x);
    visit((HEIGHT - 1) * WIDTH + x);
  }
  for (let y = 0; y < HEIGHT; y++) {
    visit(y * WIDTH);
    visit(y * WIDTH + WIDTH - 1);
  }
  while (head < tail) {
    const i = queue[head++],
      x = i % WIDTH;
    if (x) visit(i - 1);
    if (x < WIDTH - 1) visit(i + 1);
    visit(i - WIDTH);
    visit(i + WIDTH);
    data[i * 4 + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return out;
}
function prepare(image, head) {
  return {
    image, head,
    upperTeeth: teethSprite(image, DENTITION.upper.source),
    lowerTeeth: teethSprite(image, DENTITION.lower.source),
  };
}
export function loadClownRig() {
  if (loading) return loading;
  const load = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("Approved clown artwork could not load."));
    image.src = url;
  });
  loading = Promise.all([load(REFERENCE_URL), load(new URL("../clown-head.png", import.meta.url).href)])
    .then(([image, head]) => (assets = prepare(image, head)))
    .catch(error => { loadError = error.message; throw error; });
  return loading;
}
function cavity(ctx, extra, width = 1) {
  const x = (v) => 210 + (v - 210) * width;
  ctx.beginPath();
  ctx.moveTo(x(131), 429);
  ctx.bezierCurveTo(x(169), 428, x(185), 428, x(210), 429);
  ctx.bezierCurveTo(x(234), 428, x(257), 428, x(286), 429);
  ctx.bezierCurveTo(
    x(281),
    433 + extra * 0.8,
    x(258),
    429 + extra,
    x(210),
    429 + extra,
  );
  ctx.bezierCurveTo(
    x(164),
    429 + extra,
    x(139),
    433 + extra * 0.8,
    x(131),
    429,
  );
  ctx.closePath();
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
function drawTeeth(ctx, image, extra, width = 1, tongue = 0) {
  ctx.save();
  ctx.translate(210, 0);
  ctx.scale(width, 1);
  ctx.translate(-210, 0);
  // Painted lips surround a single continuous opening, with no frame or sprite swaps.
  ctx.beginPath();
  ctx.moveTo(127, 426);
  ctx.bezierCurveTo(148, 428, 166, 411, 184, 415);
  ctx.bezierCurveTo(197, 415, 201, 422, 210, 418);
  ctx.bezierCurveTo(226, 410, 242, 416, 259, 423);
  ctx.bezierCurveTo(270, 428, 282, 426, 290, 424);
  ctx.bezierCurveTo(
    286,
    445 + extra * 0.75,
    260,
    444 + extra,
    210,
    443 + extra,
  );
  ctx.bezierCurveTo(163, 443 + extra, 139, 442 + extra * 0.75, 127, 426);
  ctx.closePath();
  ctx.fillStyle = "#9d2e21";
  ctx.fill();
  ctx.strokeStyle = "#3c1c16";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  cavity(ctx, extra, width);
  ctx.clip();
  ctx.fillStyle = "#100b0c";
  ctx.fillRect(120, 420, 180, 125);
  // Both arches have immutable pixels, size, and order; the lip alone occludes them.
  const bottom = 429 + extra,
    lower = DENTITION.lower,
    upper = DENTITION.upper;
  ctx.drawImage(
    assets.lowerTeeth,
    138,
    bottom - 74 * lower.scale,
    195 * lower.scale,
    74 * lower.scale,
  );
  if (tongue > 0) drawTongue(ctx, image, extra, tongue);
  ctx.drawImage(
    assets.upperTeeth,
    128,
    429,
    226 * upper.scale,
    72 * upper.scale,
  );
  ctx.restore();
  cavity(ctx, extra, width);
  ctx.strokeStyle = "#491c16";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.save();
  ctx.translate(210, 0);
  ctx.scale(width, 1);
  ctx.translate(-210, 0);
  ctx.beginPath();
  ctx.moveTo(143, 426);
  ctx.bezierCurveTo(177, 417, 191, 418, 210, 422);
  ctx.bezierCurveTo(237, 416, 252, 425, 277, 426);
  ctx.strokeStyle = "#c36c46";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  if (tongue > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(120, 429 + extra, 200, 140);
    ctx.clip();
    drawTongue(ctx, image, extra, tongue);
    ctx.restore();
  }
}
function drawTongue(ctx, image, extra, amount) {
  ctx.save();
  const top = 429 + extra * 0.52;
  ctx.translate(0, top - 482);
  ctx.translate(210, 482);
  ctx.scale(1, amount);
  ctx.translate(-210, -482);
  polygon(ctx, [
    [190, 484],
    [214, 480],
    [236, 490],
    [252, 511],
    [260, 542],
    [259, 566],
    [251, 587],
    [242, 593],
    [230, 585],
    [239, 564],
    [236, 540],
    [224, 522],
    [203, 514],
    [188, 501],
  ]);
  ctx.clip();
  ctx.drawImage(image, 178, 478, 92, 120, 178, 478, 92, 120);
  ctx.restore();
}
function eye(ctx, image, cx, cy, source, eyeAmount, t, idle, side) {
  const expansion = 1 + clamp(eyeAmount) * 0.32;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(expansion, expansion);
  ctx.translate(-cx, -cy);
  // Preserve the model's blue sockets, eyelids and iris texture.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 34, 23, side * 0.08, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, ...source, cx - 36, cy - 27, 72, 54);
  ctx.restore();
  const dx = idle * Math.sin(t * 0.48 + side * 0.7) * 2.2,
    dy = idle * Math.sin(t * 0.37 + side) * 1.1;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 12.5, 11.8, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#b1a26b";
  ctx.fillRect(cx - 14, cy - 14, 28, 28);
  ctx.drawImage(
    image,
    cx - 13,
    cy - 13,
    26,
    26,
    cx - 13 + dx,
    cy - 13 + dy,
    26,
    26,
  );
  ctx.restore();
  ctx.restore();
}
export function drawClownRig(ctx, state, options, time) {
  if (!assets) {
    if (!loading) loadClownRig().catch(() => {});
    ctx.fillStyle = "#74644e";
    ctx.font = "18px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(loadError || "Loading approved clown artwork…", 640, 360);
    return;
  }
  const idle =
      options.idle === "still" ? 0 : options.idle === "restless" ? 1.6 : 1,
    t = idle ? time : 0;
  const openness = clamp(
    (state.rig?.mouth ?? state.mouthAccent) +
      (state.midDrive || 0) * 0.5 +
      idle * (0.012 + 0.012 * Math.sin(t * 0.83)),
  );
  const pose = mouthPose(openness);
  ctx.save();
  ctx.translate(
    640 + idle * Math.sin(t * 0.31) * 8,
    36 + idle * Math.sin(t * 0.58) * 7,
  );
  ctx.rotate(idle * Math.sin(t * 0.39) * 0.015);
  ctx.translate(-212, 0);
  // Use the uploaded neutral plate intact: no reconstructed skin panels.
  ctx.translate(-70, 0);
  ctx.scale(1.34, 1.34);
  ctx.drawImage(assets.head, 0, 0, 423, 423);
  ctx.save();
  ctx.translate(212, 325);
  ctx.scale(0.85, 0.85);
  ctx.translate(-210, -429);
  drawTeeth(ctx, assets.image, pose.extra, state.rig?.width ?? 1, state.rig?.tongue ?? 0);
  ctx.restore();
  ctx.restore();
}
