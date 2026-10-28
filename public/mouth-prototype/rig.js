// Standalone geometry. No production renderer, image assets, detector, or audio imports.
const pose = (values) => ({
  asym: 0,
  snarl: 0,
  cheekLift: 0,
  chinShift: 0,
  pucker: 0,
  lowerRetract: 0,
  open: 1,
  ...values,
});
export const POSES = Object.freeze({
  closed: pose({
    jaw: 0,
    width: 132,
    lift: 0,
    corner: 450,
    round: 1,
    cheek: 0,
    tension: 0,
  }),
  o: pose({
    jaw: 0.36,
    width: 62,
    lift: 37,
    corner: 468,
    round: 1,
    cheek: -17,
    tension: 0.5,
  }),
  a: pose({
    jaw: 0.62,
    width: 151,
    lift: 46,
    corner: 470,
    round: 0.54,
    cheek: -9,
    tension: 1,
  }),
  e: pose({
    jaw: 0.13,
    width: 192,
    lift: 11,
    corner: 446,
    round: 0.8,
    cheek: 14,
    tension: 0.4,
  }),
});
export const EMOTIONS = Object.freeze({
  grin: pose({
    jaw: 0.13,
    width: 190,
    lift: 26,
    corner: 410,
    round: 0.68,
    cheek: 18,
    tension: 0.65,
    asym: 15,
    snarl: 8,
    cheekLift: 22,
    lowerRetract: 10,
  }),
  snarl: pose({
    jaw: 0.09,
    width: 147,
    lift: 14,
    corner: 438,
    round: 0.64,
    cheek: -7,
    tension: 1,
    asym: -9,
    snarl: 43,
    cheekLift: 13,
    lowerRetract: 25,
    chinShift: 5,
  }),
  laughter: pose({
    jaw: 0.53,
    width: 194,
    lift: 36,
    corner: 411,
    round: 0.6,
    cheek: 22,
    tension: 0.6,
    asym: 5,
    cheekLift: 35,
    chinShift: 9,
    lowerRetract: 9,
  }),
  smirk: pose({
    jaw: 0.035,
    width: 143,
    lift: 3,
    corner: 447,
    round: 1,
    cheek: 6,
    tension: 0.25,
    asym: 25,
    snarl: 13,
    cheekLift: 13,
    pucker: 4,
  }),
  scream: pose({
    jaw: 0.71,
    width: 100,
    lift: 54,
    corner: 468,
    round: 0.95,
    cheek: -23,
    tension: 1,
    asym: -4,
    cheekLift: -6,
    chinShift: 20,
    pucker: 3,
  }),
  whisper: pose({
    jaw: 0.018,
    width: 78,
    lift: 1,
    corner: 450,
    round: 1.15,
    cheek: -13,
    tension: 0.25,
    asym: 3,
    cheekLift: 2,
    pucker: 20,
  }),
});
export const EMOTION_NAMES = Object.freeze({
  grin: "Sinister grin",
  snarl: "Angry snarl",
  laughter: "Manic laughter",
  smirk: "Evil smirk",
  scream: "Unhinged scream",
  whisper: "Creepy whisper",
});
// Add acting deltas to a speech shape, retaining independent speech/affect controls.
export function composePose(
  speech = "closed",
  strength = 1,
  emotion = "none",
  affect = 1,
  opening = 1,
) {
  const p = mix(POSES.closed, POSES[speech] ?? POSES.closed, strength);
  if (EMOTIONS[emotion])
    for (const key of Object.keys(p))
      p[key] += (EMOTIONS[emotion][key] - POSES.closed[key]) * affect;
  p.jaw = Math.max(0, Math.min(0.73, p.jaw));
  p.width = Math.max(48, Math.min(210, p.width));
  p.lift = Math.max(0, Math.min(65, p.lift));
  p.corner = Math.max(398, Math.min(475, p.corner));
  p.round = Math.max(0.48, Math.min(1.2, p.round));
  p.open = Math.max(0, Math.min(1, opening));
  for (const key of ["jaw", "lift", "snarl", "lowerRetract"]) p[key] *= p.open;
  return p;
}
export function actingPreview(time) {
  const index = Math.floor(Math.max(0, time) / 1.8) % 6,
    local = time % 1.8,
    name = Object.keys(EMOTIONS)[index];
  const smooth = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  const weight =
    local < 0.25
      ? smooth(local / 0.25)
      : local < 1.4
        ? 1
        : 1 - smooth((local - 1.4) / 0.4);
  const opening =
    name === "laughter"
      ? 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(local * 19))
      : name === "whisper"
        ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(local * 16))
        : 1;
  return { name, weight, opening };
}
export const mix = (a, b, t) =>
  Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * t]));
const lerp = (a, b, t) => a + (b - a) * t;
export function jawPoint(v, angle) {
  const [x, y, z] = v,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return [
    x,
    320 + (y - 320) * c + (z + 180) * s,
    -180 - (y - 320) * s + (z + 180) * c,
  ];
}
export function rehearsal(t) {
  t = ((t % 2.8) + 2.8) % 2.8;
  const note = Math.min(2, Math.floor(t / 0.72)),
    local = t - note * 0.72;
  const ease = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  return {
    name: ["o", "a", "e"][note],
    amount:
      local < 0.09
        ? ease(local / 0.09)
        : local < 0.17
          ? 1
          : 1 - ease((local - 0.17) / 0.16),
  };
}
const skin = [0.79, 0.65, 0.47],
  lip = [0.48, 0.105, 0.09],
  gum = [0.42, 0.13, 0.125],
  ivory = [0.91, 0.82, 0.62];
function mesh(vertices, faces, color, id = "tissue") {
  return { vertices, faces, color, id };
}
function grid(rows, cols, point, color, id, wrap = false) {
  const vertices = [],
    faces = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) vertices.push(point(r, c));
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - (wrap ? 0 : 1); c++) {
      const a = r * cols + c,
        b = r * cols + ((c + 1) % cols),
        d = (r + 1) * cols + c,
        e = (r + 1) * cols + ((c + 1) % cols);
      faces.push([a, d, b], [b, d, e]);
    }
  return mesh(vertices, faces, color, id);
}
export function faceMesh(p) {
  const n = 128,
    rings = [0, 0.025, 0.06, 0.105, 0.17, 0.25, 0.36, 0.5, 0.67, 0.83, 1];
  p = { ...POSES.closed, ...p };
  const bottom = jawPoint([450, 450, 130], p.jaw);
  bottom[1] += p.lowerRetract;
  const result = grid(
    rings.length,
    n,
    (row, col) => {
      const r = rings[row],
        a = (col / n) * Math.PI * 2,
        s = Math.sin(a),
        c = Math.cos(a),
        lower = Math.max(0, -s);
      // The aperture rim and the outside face share every intermediate ring.
      const top = 450 - p.lift,
        corner = p.corner;
      const ix =
        450 +
        p.width *
          c *
          (1 -
            Math.max(0, Math.min(1, (0.85 - p.round) / 0.4)) *
              0.15 *
              p.open *
              lower);
      let iy =
        s >= 0
          ? corner - (corner - top) * Math.pow(s, p.round)
          : corner + (bottom[1] - corner) * Math.pow(-s, p.round);
      iy += p.asym * c * Math.pow(Math.abs(c), 0.5);
      if (s > 0)
        iy -= p.snarl * Math.exp(-(((c + 0.52) / 0.28) ** 2)) * Math.sqrt(s);
      const iz = lerp(130, bottom[2], lower) + p.pucker;
      const rest = [450 + 280 * c, 400 - (s >= 0 ? 220 : 350) * s, 120];
      const hinged = jawPoint(rest, p.jaw);
      const w = Math.pow(lower, 1.4);
      const ox = rest[0] + p.cheek * c * Math.pow(Math.abs(c), 2);
      const oy =
          lerp(rest[1], hinged[1], w) +
          p.chinShift * lower * lower -
          p.cheekLift * Math.abs(c) ** 3,
        oz = lerp(rest[2], hinged[2], w);
      const x = lerp(ix, ox, r),
        y =
          lerp(iy, oy, r) -
          p.cheekLift * Math.sin(r * Math.PI) * Math.abs(c) ** 3;
      const cheekBulge = (30 - p.tension * 12) * Math.sin(r * Math.PI) * c * c;
      const nose =
        Math.exp(-(((x - 450) / 47) ** 2) - ((y - 290) / 54) ** 2) * 75;
      const lipVolume = r < 0.08 ? Math.sin((r / 0.08) * Math.PI) * 9 : 0;
      const z =
        lerp(iz, oz, r) +
        cheekBulge +
        nose +
        lipVolume +
        p.pucker * Math.exp(-((r / 0.18) ** 2));
      return [x, y, z];
    },
    null,
    "face",
    true,
  );
  result.colors = result.vertices.map((v, i) => {
    const r = rings[Math.floor(i / n)],
      a = ((i % n) / n) * Math.PI * 2;
    const pigment =
      r < 0.025
        ? lip
        : r < 0.06
          ? lip.map((v, k) => lerp(v, skin[k], (r - 0.025) / 0.035))
          : skin;
    const shade = 1 - 0.1 * Math.cos(a * 2) * Math.sin(r * Math.PI);
    return pigment.map((v) => v * shade);
  });
  result.rim = result.vertices.slice(0, n);
  return result;
}
function ellipsoid(center, radius, color, id) {
  return grid(
    17,
    32,
    (r, c) => {
      const a = (r / 16) * Math.PI,
        b = (c / 32) * Math.PI * 2;
      return [
        center[0] + radius[0] * Math.sin(a) * Math.cos(b),
        center[1] + radius[1] * Math.cos(a),
        center[2] + radius[2] * Math.sin(a) * Math.sin(b),
      ];
    },
    color,
    id,
    true,
  );
}
// Authored crown sections: flattened labial surfaces, cervical necks and cutting edges.
function tooth(id, x, length, width, upper, type = "incisor") {
  const sign = Math.sign(x),
    seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0),
    jitter = Math.sin(seed * 1.73);
  x += jitter * 0.65;
  length *= 1 + jitter * 0.035;
  width *= 1 + Math.cos(seed) * 0.018;
  const z = (upper ? 80 : 64) - (Math.abs(x) / 118) ** 2 * (upper ? 62 : 48);
  const root =
    (upper ? 412 + (x / 118) ** 2 * 10 : 476 - (x / 118) ** 2 * 8) +
    Math.cos(seed * 2.13) * 0.65;
  const angle = jitter * 0.045,
    arch = -sign * (Math.abs(x) / 118) * 0.36;
  const rows = 13,
    cols = 24,
    uvs = [];
  const shape = grid(
    rows,
    cols,
    (r, c) => {
      const t = r / (rows - 1),
        a = (c / cols) * Math.PI * 2;
      const u = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.46;
      const v = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.68;
      let breadth =
          0.78 + 0.23 * Math.sin((Math.min(1, t / 0.65) * Math.PI) / 2),
        thickness = 8.5 * (1 - 0.68 * t);
      let bend = 0,
        edge = 0;
      if (type === "canine") {
        breadth =
          t < 0.28
            ? 0.72 + t
            : Math.max(upper ? 0.025 : 0.1, 1 - ((t - 0.28) / 0.72) ** 1.25);
        bend = sign * (upper ? 3.5 : -3) * t * t;
        thickness = 8 * (1 - 0.87 * t);
        edge = 1.8 * u * (1 - t);
      } else if (type === "premolar") {
        breadth *= 0.9 - 0.17 * t;
        thickness = 9 * (1 - 0.45 * t);
        edge =
          -4.5 * (1 - Math.abs(u)) * t ** 7 + 1.8 * Math.sin(a * 2) * t ** 8;
      } else {
        breadth *= 1 - 0.05 * t;
        edge = (0.65 * Math.sin(u * 5 + seed) + 0.4 * u) * t ** 9;
      }
      const localX = u * width * 0.5 * breadth + bend,
        localY = (upper ? 1 : -1) * (length * t + edge);
      const localZ =
        v * thickness + (type === "incisor" ? 2 * Math.sin(t * Math.PI) : 0);
      const rx = localX * Math.cos(angle) - localY * Math.sin(angle),
        ry = localX * Math.sin(angle) + localY * Math.cos(angle);
      uvs.push([u, t]);
      return [
        450 + x + rx * Math.cos(arch) + localZ * Math.sin(arch),
        root + ry,
        z - rx * Math.sin(arch) + localZ * Math.cos(arch),
      ];
    },
    ivory,
    id,
    true,
  );
  // Close the cutting surface; no open cylinder ends.
  const cap = shape.vertices.length;
  const last = shape.vertices.slice((rows - 1) * cols, rows * cols);
  shape.vertices.push(
    [0, 1, 2].map((k) => last.reduce((sum, v) => sum + v[k], 0) / cols),
  );
  uvs.push([0, 1]);
  for (let c = 0; c < cols; c++)
    shape.faces.push([
      cap,
      (rows - 1) * cols + c,
      (rows - 1) * cols + ((c + 1) % cols),
    ]);
  shape.uvs = uvs;
  shape.enamel = true;
  shape.colors = uvs.map(([u, t]) => {
    const neck = 0.18 * Math.exp(-t * 9),
      edgeShade = 0.1 * Math.abs(u) ** 5;
    return [
      0.94 - neck - edgeShade,
      0.84 - neck * 1.2 - edgeShade,
      0.63 - neck * 1.2 - edgeShade * 0.7,
    ];
  });
  shape.normals = normals(shape);
  return {
    id,
    upper,
    type,
    width,
    length,
    mesh: shape,
    root: [450 + x, root, z],
  };
}
export const TEETH = Object.freeze(
  [-1, 1].flatMap((sign) => [
    tooth(`U${sign < 0 ? "L" : "R"}-incisor`, sign * 13, 35, 25.5, true),
    tooth(`U${sign < 0 ? "L" : "R"}-lateral`, sign * 36, 29, 18, true),
    tooth(`U${sign < 0 ? "L" : "R"}-fang`, sign * 58, 53, 18, true, "canine"),
    tooth(
      `U${sign < 0 ? "L" : "R"}-premolar`,
      sign * 79,
      27,
      16,
      true,
      "premolar",
    ),
    tooth(
      `U${sign < 0 ? "L" : "R"}-molar`,
      sign * 97,
      23,
      14,
      true,
      "premolar",
    ),
    ...[9, 28, 47, 65, 82].map((x, i) =>
      tooth(
        `L${sign < 0 ? "L" : "R"}-${i + 1}`,
        sign * x,
        [24, 23, 28, 21, 19][i],
        [17, 16, 15, 14, 13][i],
        false,
        i === 2 ? "canine" : i > 2 ? "premolar" : "incisor",
      ),
    ),
  ]),
);
function gumMesh(upper) {
  const teeth = TEETH.filter((t) => t.upper === upper);
  const m = grid(
    10,
    161,
    (r, c) => {
      const x = -110 + (c / 160) * 220,
        t = r / 9,
        curve = (x / 118) ** 2;
      const nearest = teeth.reduce((a, b) =>
        Math.abs(a.root[0] - 450 - x) < Math.abs(b.root[0] - 450 - x) ? a : b,
      );
      const u = Math.min(
        1,
        Math.abs(x - (nearest.root[0] - 450)) / (nearest.width * 0.55),
      );
      const edge =
        nearest.root[1] + (upper ? 1 : -1) * ((upper ? 6 : 10) + 8 * u ** 1.8);
      const base = upper ? 396 + curve * 10 : 501 - curve * 8;
      return [
        450 + x,
        lerp(base, edge, t),
        (upper ? 80 : 64) -
          curve * (upper ? 62 : 48) +
          12 +
          Math.sin(t * Math.PI) * 3,
      ];
    },
    gum,
    upper ? "upper-gum" : "lower-gum",
  );
  m.colors = m.vertices.map((_, i) => {
    const t = Math.floor(i / 161) / 9,
      d = t > 0.9 ? 0.13 : 0;
    return [0.43 - d, 0.14 - d * 0.6, 0.12 - d * 0.5];
  });
  m.normals = normals(m);
  return m;
}
const upperGum = gumMesh(true),
  lowerGum = gumMesh(false);
const tongue = ellipsoid(
  [450, 496, -8],
  [66, 22, 42],
  [0.55, 0.22, 0.2],
  "tongue",
);
const cavity = ellipsoid(
  [450, 475, -140],
  [218, 206, 30],
  [0.065, 0.035, 0.045],
  "cavity",
);
const mandible = grid(
  10,
  65,
  (r, c) => {
    const x = -126 + (c / 64) * 252,
      t = r / 9;
    return [
      450 + x,
      501 + t * 66 - (x / 130) ** 2 * 14,
      35 - (x / 130) ** 2 * 50 - t * 25,
    ];
  },
  [0.56, 0.48, 0.36],
  "mandible",
);
function jawArm(sign) {
  const start = [450 + sign * 120, 525, 20],
    end = [450 + sign * 190, 320, -180];
  return grid(
    14,
    16,
    (r, c) => {
      const t = r / 13,
        a = (c / 16) * Math.PI * 2;
      return [
        lerp(start[0], end[0], t) + Math.cos(a) * 12,
        lerp(start[1], end[1], t) + Math.sin(a) * 8,
        lerp(start[2], end[2], t) + Math.sin(a) * 10,
      ];
    },
    [0.56, 0.48, 0.36],
    sign < 0 ? "left-ramus" : "right-ramus",
    true,
  );
}
const arms = [jawArm(-1), jawArm(1)];
const cheekWalls = [-1, 1].map((sign) =>
  ellipsoid(
    [450 + sign * 164, 490, -55],
    [55, 145, 95],
    [0.17, 0.065, 0.055],
    sign < 0 ? "left-buccal-lining" : "right-buccal-lining",
  ),
);
function moved(m, p) {
  const c = Math.cos(p.jaw),
    s = Math.sin(p.jaw);
  return {
    ...m,
    dynamic: true,
    vertices: m.vertices.map((v) => jawPoint(v, p.jaw)),
    normals: m.normals?.map(([x, y, z]) => [x, y * c + z * s, -y * s + z * c]),
  };
}
export function scene(p, cutaway = false) {
  return [
    ...(cutaway ? [] : [cavity]),
    ...(!cutaway ? cheekWalls : []),
    moved(tongue, p),
    // The jaw remains rigid. Normal views show its opaque mucosal covering;
    // the diagnostic cutaway exposes the same mandibular body and side supports.
    moved(cutaway ? mandible : { ...mandible, color: [0.21, 0.07, 0.06] }, p),
    ...arms.map((m) =>
      moved(cutaway ? m : { ...m, color: [0.17, 0.055, 0.05] }, p),
    ),
    ...TEETH.map((t) => (t.upper ? t.mesh : moved(t.mesh, p))),
    upperGum,
    moved(lowerGum, p),
    ...(cutaway ? [] : [faceMesh(p)]),
  ];
}
function normals(m) {
  const n = m.vertices.map(() => [0, 0, 0]);
  for (const [a, b, c] of m.faces) {
    const A = m.vertices[a],
      B = m.vertices[b],
      C = m.vertices[c],
      u = B.map((v, i) => v - A[i]),
      v = C.map((x, i) => x - A[i]);
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    for (const j of [a, b, c]) for (let k = 0; k < 3; k++) n[j][k] += cross[k];
  }
  return n.map((v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  });
}
export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw Error("WebGL is required for depth-tested anatomy.");
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      `attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute vec2 uv;attribute float enamel;attribute float facepaint;uniform float yaw;uniform float zoom;uniform float focus;varying float vEnamel;varying float vFace;varying vec3 vColor;varying vec3 vNormal;varying vec2 vUV;void main(){float c=cos(yaw),s=sin(yaw);vec3 p=position;p.x-=450.;p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);gl_Position=vec4(p.x/400.*zoom,(focus-p.y)/400.*zoom,-p.z/500.,1.);vEnamel=enamel;vFace=facepaint;vNormal=vec3(normal.x*c+normal.z*s,normal.y,-normal.x*s+normal.z*c);vColor=color;vUV=uv;}`,
    ),
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vColor;varying vec3 vNormal;varying vec2 vUV;varying float vEnamel;varying float vFace;uniform float costume;uniform float wire;uniform float diagnostic;void main(){vec3 n=normalize(vNormal);if(n.z<0.)n=-n;float light=.55+.45*max(0.,dot(n,normalize(vec3(-.35,-.5,1.))));vec2 grainUV=mod(floor(vUV*2.),128.);float grain=fract(sin(dot(grainUV,vec2(.129898,.78233)))*4375.85453);float hatch=step(.88,sin(vUV.x*.8+vUV.y*.65))*(1.-light)*.25;vec3 pigment=vColor;if(costume>.5&&vFace>.5){float y=vUV.y;float edge=16.*(1.-(y-285.)/155.);float mark=step(285.,y)*step(y,440.)*step(min(abs(vUV.x-(362.-(y-285.)*.1)),abs(vUV.x-(536.+(y-285.)*.1))),edge);float brow=step(205.,y)*step(y,265.)*step(min(abs(vUV.x-(362.+(265.-y)*.12)),abs(vUV.x-(536.-(265.-y)*.12))),18.*(y-205.)/60.);mark=max(mark,brow);pigment=mix(vColor*1.1,vec3(.025,.12,.19),mark);}vec3 c=pigment*(light-hatch)+(grain-.5)*.024;if(vEnamel>.5){float edge=smoothstep(.82,.98,abs(vUV.x));float shadow=max(abs(vUV.x)*.75,1.-light);float h1=step(.83,sin(vUV.x*68.+vUV.y*78.));float h2=step(.9,sin(vUV.x*73.-vUV.y*102.));float ink=(h1+h2*.65)*smoothstep(.28,.7,shadow)*.27+edge*.38;vec2 glint=vec2((vUV.x+.24)/.16,(vUV.y-.46)/.28);float shine=exp(-dot(glint,glint))*.09;c=c*(1.-ink)+shine*vec3(1.,.91,.68);}gl_FragColor=vec4(mix(mix(c,vec3(.25,.85,.75),wire),vColor,diagnostic),1.);}`,
    ),
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, size, offset] of [
    ["position", 3, 0],
    ["normal", 3, 3],
    ["color", 3, 6],
    ["uv", 2, 9],
    ["enamel", 1, 11],
    ["facepaint", 1, 12],
  ]) {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 52, offset * 4);
  }
  const yawLoc = gl.getUniformLocation(program, "yaw"),
    wireLoc = gl.getUniformLocation(program, "wire"),
    diagnosticLoc = gl.getUniformLocation(program, "diagnostic"),
    zoomLoc = gl.getUniformLocation(program, "zoom"),
    focusLoc = gl.getUniformLocation(program, "focus"),
    costumeLoc = gl.getUniformLocation(program, "costume");
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.098, 0.129, 0.149, 1);
  const staticPacked = new WeakMap();
  function packed(m, lines = false) {
    const cacheable = !lines && !m.dynamic && m.id !== "face";
    if (cacheable && staticPacked.has(m)) return staticPacked.get(m);
    const n = m.normals ?? normals(m),
      out = [];
    for (const face of m.faces) {
      const indices = lines
        ? [face[0], face[1], face[1], face[2], face[2], face[0]]
        : face;
      for (const i of indices) {
        const v = m.vertices[i];
        out.push(
          ...v,
          ...n[i],
          ...(m.colors?.[i] ?? m.color),
          ...(m.uvs?.[i] ?? [v[0], v[1]]),
          m.enamel ? 1 : 0,
          m.id === "face" ? 1 : 0,
        );
      }
    }
    const result = new Float32Array(out);
    if (cacheable) staticPacked.set(m, result);
    return result;
  }
  let costumeBinding = null;
  return function render(
    p,
    {
      cutaway = false,
      wire = false,
      yaw = 0,
      diagnostic = false,
      zoom = 1,
      transparent = false,
      costume = false,
    } = {},
  ) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(
      transparent ? 0 : 0.098,
      transparent ? 0 : 0.129,
      transparent ? 0 : 0.149,
      transparent ? 0 : 1,
    );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(yawLoc, (yaw * Math.PI) / 180);
    gl.uniform1f(costumeLoc, costume ? 1 : 0);
    gl.uniform1f(zoomLoc, zoom);
    gl.uniform1f(
      focusLoc,
      zoom > 1 ? (412 + jawPoint([450, 497, 64], p.jaw)[1]) / 2 : 500,
    );
    gl.uniform1f(wireLoc, 0);
    gl.uniform1f(diagnosticLoc, diagnostic ? 1 : 0);
    const meshes = scene(p, cutaway);
    if (costume && !cutaway) {
      const neutral =
        costumeBinding ?? (costumeBinding = faceMesh(POSES.closed));
      meshes.at(-1).uvs = neutral.vertices.map(([x, y]) => [x, y]);
    }
    let triangles = 0;
    for (const m of meshes) {
      const data = packed(
        diagnostic
          ? {
              ...m,
              colors: null,
              color:
                m.id === "face"
                  ? [0.3, 0.3, 0.3]
                  : m.id.startsWith("U")
                    ? [0, 1, 1]
                    : m.id.startsWith("L")
                      ? [0, 1, 0]
                      : [0.2, 0, 0],
            }
          : m,
      );
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 13);
      triangles += m.faces.length;
    }
    if (wire && !cutaway) {
      gl.uniform1f(wireLoc, 1);
      const m = meshes.at(-1);
      const data = packed(
        { ...m, vertices: m.vertices.map(([x, y, z]) => [x, y, z + 0.45]) },
        true,
      );
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, data.length / 13);
    }
    return {
      triangles,
      teeth: TEETH.length,
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      jaw: p.jaw,
    };
  };
}
