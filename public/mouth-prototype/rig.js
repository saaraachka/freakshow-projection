// Standalone geometry. No production renderer, image assets, detector, or audio imports.
export const POSES = Object.freeze({
  closed: {
    jaw: 0,
    width: 132,
    lift: 0,
    corner: 450,
    round: 1,
    cheek: 0,
    tension: 0,
  },
  o: {
    jaw: 0.36,
    width: 62,
    lift: 37,
    corner: 468,
    round: 1,
    cheek: -17,
    tension: 0.5,
  },
  a: {
    jaw: 0.62,
    width: 151,
    lift: 46,
    corner: 470,
    round: 0.54,
    cheek: -9,
    tension: 1,
  },
  e: {
    jaw: 0.13,
    width: 192,
    lift: 11,
    corner: 446,
    round: 0.8,
    cheek: 14,
    tension: 0.4,
  },
});
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
  const bottom = jawPoint([450, 450, 130], p.jaw);
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
      const ix = 450 + p.width * c * (1 - (p.round < 0.7 ? 0.15 : 0) * lower);
      const iy =
        s >= 0
          ? corner - (corner - top) * Math.pow(s, p.round)
          : corner + (bottom[1] - corner) * Math.pow(-s, p.round);
      const iz = lerp(130, bottom[2], lower);
      const rest = [450 + 280 * c, 400 - (s >= 0 ? 220 : 350) * s, 120];
      const hinged = jawPoint(rest, p.jaw);
      const w = Math.pow(lower, 1.4);
      const ox = rest[0] + p.cheek * c * Math.pow(Math.abs(c), 2);
      const oy = lerp(rest[1], hinged[1], w),
        oz = lerp(rest[2], hinged[2], w);
      const x = lerp(ix, ox, r),
        y = lerp(iy, oy, r);
      const cheekBulge = (30 - p.tension * 12) * Math.sin(r * Math.PI) * c * c;
      const nose =
        Math.exp(-(((x - 450) / 47) ** 2) - ((y - 290) / 54) ** 2) * 75;
      const lipVolume = r < 0.08 ? Math.sin((r / 0.08) * Math.PI) * 9 : 0;
      const z = lerp(iz, oz, r) + cheekBulge + nose + lipVolume;
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
function tooth(id, x, length, width, upper) {
  const z = 72 - (x / 118) ** 2 * 45,
    root = upper ? 411 + (x / 118) ** 2 * 10 : 497 - (x / 118) ** 2 * 8;
  const shape = grid(
    7,
    16,
    (r, c) => {
      const t = r / 6,
        a = (c / 16) * Math.PI * 2;
      const taper = id.includes("fang")
        ? 1 - t * 0.86
        : (1 - t * 0.15) * (t > 0.8 ? 1 - (t - 0.8) * 1.1 : 1);
      return [
        450 + x + Math.cos(a) * width * 0.5 * taper,
        root + (upper ? 1 : -1) * length * t,
        z + Math.sin(a) * 9 * taper,
      ];
    },
    ivory,
    id,
    true,
  );
  const cap = shape.vertices.length;
  shape.vertices.push([450 + x, root + (upper ? 1 : -1) * length, z]);
  for (let c = 0; c < 16; c++)
    shape.faces.push([cap, 6 * 16 + c, 6 * 16 + ((c + 1) % 16)]);
  return { id, upper, mesh: shape, root: [450 + x, root, z] };
}
// Created once, with immutable tooth-local vertices and anatomical order.
export const TEETH = Object.freeze(
  [-1, 1].flatMap((sign) => [
    tooth(`U${sign < 0 ? "L" : "R"}-incisor`, sign * 13, 45, 24, true),
    tooth(`U${sign < 0 ? "L" : "R"}-lateral`, sign * 36, 37, 18, true),
    tooth(`U${sign < 0 ? "L" : "R"}-fang`, sign * 58, 55, 17, true),
    tooth(`U${sign < 0 ? "L" : "R"}-premolar`, sign * 80, 30, 18, true),
    tooth(`U${sign < 0 ? "L" : "R"}-molar`, sign * 100, 24, 17, true),
    ...[12, 33, 54, 75, 94].map((x, i) =>
      tooth(
        `L${sign < 0 ? "L" : "R"}-${i + 1}`,
        sign * x,
        28 - i * 2,
        18,
        false,
      ),
    ),
  ]),
);
function gumMesh(upper) {
  return grid(
    8,
    81,
    (r, c) => {
      const x = -113 + (c / 80) * 226,
        t = r / 7,
        curve = (x / 118) ** 2;
      const base = upper ? 402 + curve * 10 : 508 - curve * 8;
      const scallop = Math.cos((x / 22) * Math.PI * 2) * 2;
      return [
        450 + x,
        base + (upper ? 1 : -1) * (23 * t + scallop * t),
        90 - curve * 45 + Math.sin(t * Math.PI) * 5,
      ];
    },
    gum,
    upper ? "upper-gum" : "lower-gum",
  );
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
  return { ...m, vertices: m.vertices.map((v) => jawPoint(v, p.jaw)) };
}
export function scene(p, cutaway = false) {
  return [
    ...(cutaway ? [] : [cavity]),
    ...(!cutaway ? cheekWalls : []),
    moved(tongue, p),
    moved(mandible, p),
    ...arms.map((m) => moved(m, p)),
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
      `attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute vec2 uv;uniform float yaw;varying vec3 vColor;varying vec3 vNormal;varying vec2 vUV;void main(){float c=cos(yaw),s=sin(yaw);vec3 p=position;p.x-=450.;p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);gl_Position=vec4(p.x/400.,1.-(p.y-100.)/400.,-p.z/500.,1.);vNormal=vec3(normal.x*c+normal.z*s,normal.y,-normal.x*s+normal.z*c);vColor=color;vUV=uv;}`,
    ),
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float;varying vec3 vColor;varying vec3 vNormal;varying vec2 vUV;uniform float wire;uniform float diagnostic;void main(){vec3 n=normalize(vNormal);if(n.z<0.)n=-n;float light=.55+.45*max(0.,dot(n,normalize(vec3(-.35,-.5,1.))));float grain=fract(sin(dot(floor(vUV*2.),vec2(12.9898,78.233)))*43758.5453);float hatch=step(.88,sin(vUV.x*.8+vUV.y*.65))*(1.-light)*.25;vec3 c=vColor*(light-hatch)+(grain-.5)*.024;gl_FragColor=vec4(mix(mix(c,vec3(.25,.85,.75),wire),vColor,diagnostic),1.);}`,
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
  ]) {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 44, offset * 4);
  }
  const yawLoc = gl.getUniformLocation(program, "yaw"),
    wireLoc = gl.getUniformLocation(program, "wire"),
    diagnosticLoc = gl.getUniformLocation(program, "diagnostic");
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.098, 0.129, 0.149, 1);
  function packed(m, lines = false) {
    const n = normals(m),
      out = [];
    for (const face of m.faces) {
      const indices = lines
        ? [face[0], face[1], face[1], face[2], face[2], face[0]]
        : face;
      for (const i of indices) {
        const v = m.vertices[i];
        out.push(...v, ...n[i], ...(m.colors?.[i] ?? m.color), v[0], v[1]);
      }
    }
    return new Float32Array(out);
  }
  return function render(
    p,
    { cutaway = false, wire = false, yaw = 0, diagnostic = false } = {},
  ) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(yawLoc, (yaw * Math.PI) / 180);
    gl.uniform1f(wireLoc, 0);
    gl.uniform1f(diagnosticLoc, diagnostic ? 1 : 0);
    const meshes = scene(p, cutaway);
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
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 11);
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
      gl.drawArrays(gl.LINES, 0, data.length / 11);
    }
    return {
      triangles,
      teeth: TEETH.length,
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      jaw: p.jaw,
    };
  };
}
