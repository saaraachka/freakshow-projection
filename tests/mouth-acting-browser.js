import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  POSES,
  EMOTIONS,
  EMOTION_NAMES,
  TEETH,
  scene,
  faceMesh,
  composePose,
  jawPoint,
  actingPreview,
} from "../public/mouth-prototype/rig.js";
const states = [
  ...Object.values(POSES),
  ...Object.keys(EMOTIONS).flatMap((name) =>
    [0, 0.5, 1].map((open) => composePose("closed", 1, name, 1, open)),
  ),
];
// Independent conservative clearance check: disjoint x bounds cannot intersect
// under the preserved jaw hinge (which rotates only y/z).
for (const upper of [true, false]) {
  const row = TEETH.filter((t) => t.upper === upper).sort(
    (a, b) => a.root[0] - b.root[0],
  );
  for (let i = 1; i < row.length; i++) {
    const gap =
      Math.min(...row[i].mesh.vertices.map((v) => v[0])) -
      Math.max(...row[i - 1].mesh.vertices.map((v) => v[0]));
    assert.ok(
      gap > 0.25,
      row[i - 1].id +
        " / " +
        row[i].id +
        " must have nonintersecting crown bounds",
    );
  }
}
const frontUpper = TEETH.filter((t) => t.upper && t.id.endsWith("-incisor"));
const frontLower = TEETH.filter((t) => !t.upper && t.id.endsWith("-1"));
const upperEdge = Math.max(
  ...frontUpper.flatMap((t) => t.mesh.vertices.map((v) => v[1])),
);
const lowerEdge = Math.min(
  ...frontLower.flatMap((t) => t.mesh.vertices.map((v) => v[1])),
);
assert.ok(
  lowerEdge - upperEdge > 0 && lowerEdge - upperEdge < 8,
  "rest bite must align without relying on closed lips",
);
const original = JSON.stringify(TEETH);
for (const p of states) {
  const meshes = scene(p);
  assert.deepEqual(
    faceMesh(p).faces,
    faceMesh(POSES.closed).faces,
    "preserve connected topology",
  );
  for (const tooth of TEETH) {
    const transformed = meshes.find((m) => m.id === tooth.id);
    for (const i of [5, 31, 145, 287])
      assert.deepEqual(
        transformed.vertices[i],
        tooth.upper
          ? tooth.mesh.vertices[i]
          : jawPoint(tooth.mesh.vertices[i], p.jaw),
      );
    const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    assert.ok(
      Math.abs(
        distance(transformed.vertices[5], transformed.vertices[145]) -
          distance(tooth.mesh.vertices[5], tooth.mesh.vertices[145]),
      ) < 1e-8,
      "rigid crowns",
    );
  }
}
assert.equal(JSON.stringify(TEETH), original);
assert.equal(new Set(TEETH.map((t) => t.id)).size, 20);
assert.notDeepEqual(
  composePose("o", 1, "grin", 0.5),
  POSES.o,
  "acting blends with speech",
);
assert.equal(
  new Set(
    Array.from({ length: 6 }, (_, i) => actingPreview(i * 1.8 + 0.6).name),
  ).size,
  6,
);
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5189", BASE_PATH: "/freakshow-projection/" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("server exited " + code)));
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1250 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "http://localhost:5189/freakshow-projection/public/mouth-prototype/index.html",
  );
  await page.waitForFunction(
    () => window.mouthStudy?.snapshot().renderCount > 2,
  );
  await mkdir("artifacts/mouth-acting", { recursive: true });
  // Capture actual UI poses before the independent pixel-occlusion sweep.
  for (const name of Object.keys(EMOTIONS)) {
    await page.locator("#emotion").selectOption(name);
    await page.waitForFunction(async (name) => {
      const { composePose } = await import("./rig.js");
      const actual = window.mouthStudy.snapshot().current,
        target = composePose("closed", 1, name, 1, 1);
      return Object.keys(target).every(
        (k) => Math.abs(actual[k] - target[k]) < 0.03,
      );
    }, name);
    await page
      .locator("#anatomy")
      .screenshot({ path: `artifacts/mouth-acting/${name}.png` });
  }
  await page.locator("#emotion").selectOption("laughter");
  await page.locator("#closeup").check();
  await page.waitForTimeout(600);
  await page
    .locator("#anatomy")
    .screenshot({ path: "artifacts/mouth-acting/teeth-front.png" });
  await page.locator("#cutaway").check();
  await page.locator("#yaw").fill("22");
  await page.waitForTimeout(200);
  await page
    .locator("#anatomy")
    .screenshot({ path: "artifacts/mouth-acting/teeth-oblique.png" });
  await page.locator("#cutaway").uncheck();
  await page.locator("#closeup").uncheck();
  await page.locator("#yaw").fill("0");
  const visibility = await page.evaluate(async () => {
    const {
      createRenderer,
      composePose,
      POSES,
      EMOTIONS,
      faceMesh,
      TEETH,
      jawPoint,
    } = await import("./rig.js");
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 900;
    const render = createRenderer(canvas),
      gl = canvas.getContext("webgl"),
      results = [];
    const inside = (x, y, poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i],
          b = poly[j];
        if (
          a[1] > y != b[1] > y &&
          x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
        )
          hit = !hit;
      }
      return hit;
    };
    const cases = Object.keys(EMOTIONS).flatMap((name) => [
      ...[0, 0.25, 0.5, 0.75, 1].map((opening) => ({
        name,
        opening,
        yaw: 0,
        p: composePose("closed", 1, name, 1, opening),
      })),
      ...[-25, 25].map((yaw) => ({
        name,
        opening: 1,
        yaw,
        p: composePose("closed", 1, name),
      })),
    ]);
    for (const speech of Object.keys(POSES))
      for (const name of ["none", "grin", "snarl", "whisper"])
        cases.push({
          name: speech + "+" + name,
          opening: speech === "closed" && name === "none" ? 0 : 1,
          yaw: 0,
          p: composePose(speech, 1, name, 0.5),
        });
    for (const { name, p, opening, yaw } of cases) {
      render(p, { diagnostic: true, yaw });
      const pixels = new Uint8Array(900 * 900 * 4);
      gl.readPixels(0, 0, 900, 900, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const angle = (yaw * Math.PI) / 180,
        rim = faceMesh(p).rim.map(([x, y, z]) => [
          450 +
            (((x - 450) * Math.cos(angle) + z * Math.sin(angle)) * 900) / 800,
          ((y - 100) * 900) / 800,
        ]);
      let exposed = 0,
        outside = 0;
      for (let y = 0; y < 900; y++)
        for (let x = 0; x < 900; x++) {
          const i = ((899 - y) * 900 + x) * 4;
          if (pixels[i] < 5 && pixels[i + 1] > 250) {
            exposed++;
            if (!inside(x + 0.5, y + 0.5, rim)) outside++;
          }
        }
      let rootLeaks = 0;
      for (const tooth of TEETH) {
        const point = tooth.upper
          ? tooth.mesh.vertices[30]
          : jawPoint(tooth.mesh.vertices[30], p.jaw);
        const x = Math.floor(
            450 +
              (((point[0] - 450) * Math.cos(angle) +
                point[2] * Math.sin(angle)) *
                900) /
                800,
          ),
          y = Math.floor(((point[1] - 100) * 900) / 800);
        if (x < 0 || x >= 900 || y < 0 || y >= 900) continue;
        const i = ((899 - y) * 900 + x) * 4;
        if (pixels[i] < 5 && pixels[i + 1] > 250) rootLeaks++;
      }
      results.push({ name, opening, yaw, exposed, outside, rootLeaks });
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return results;
  });
  for (const r of visibility) {
    assert.equal(
      r.rootLeaks,
      0,
      "cervical crowns must remain covered by gums: " + JSON.stringify(r),
    );
    assert.ok(
      r.outside < 8,
      "crown outside lip aperture: " + JSON.stringify(r),
    );
    if (r.opening === 0)
      assert.equal(r.exposed, 0, "closed acting lips: " + JSON.stringify(r));
  }
  console.log(
    "Acting occlusion:",
    visibility.length,
    "views; max external crown pixels",
    Math.max(...visibility.map((r) => r.outside)),
  );
  // Review panels render through the same geometry/material pipeline as the UI.
  await page.locator("#pause").click();
  for (const matrix of [false, true]) {
    await page.evaluate(async (matrix) => {
      const { createRenderer, composePose, EMOTIONS, EMOTION_NAMES } =
        await import("./rig.js");
      const panel = document.createElement("canvas");
      panel.id = "actingReview";
      panel.width = 1500;
      panel.height = matrix ? 6 * 530 : 1100;
      Object.assign(panel.style, {
        position: "absolute",
        top: "0",
        left: "0",
        zIndex: 9999,
        width: "1500px",
        height: panel.height + "px",
        maxHeight: "none",
        minHeight: "0",
      });
      document.body.append(panel);
      const ctx = panel.getContext("2d");
      ctx.fillStyle = "#192126";
      ctx.fillRect(0, 0, panel.width, panel.height);
      const frame = document.createElement("canvas");
      frame.width = 900;
      frame.height = 900;
      const render = createRenderer(frame);
      let index = 0;
      for (const name of Object.keys(EMOTIONS)) {
        const strengths = matrix ? [0, 0.5, 1] : [1];
        for (let i = 0; i < strengths.length; i++) {
          const column = matrix ? i : index % 3,
            row = matrix ? index : Math.floor(index / 3),
            strength = strengths[i];
          render(composePose("closed", 1, name, 1, strength));
          ctx.drawImage(
            frame,
            column * 500,
            row * (matrix ? 530 : 550) + 45,
            500,
            500,
          );
          ctx.fillStyle = "#ead1a7";
          ctx.font = "21px Georgia";
          ctx.fillText(
            EMOTION_NAMES[name] +
              (matrix ? " / " + Math.round(strength * 100) + "%" : ""),
            column * 500 + 16,
            row * (matrix ? 530 : 550) + 30,
          );
        }
        index++;
      }
      frame
        .getContext("webgl")
        .getExtension("WEBGL_lose_context")
        ?.loseContext();
    }, matrix);
    await page.locator("#actingReview").screenshot({
      path: `artifacts/mouth-acting/${matrix ? "opening-matrix" : "expressions"}.png`,
    });
    await page.locator("#actingReview").evaluate((c) => c.remove());
  }
  // Exercise independent controls and demonstrate the real UI sequence, not just pure poses.
  await page.locator('[data-pose="o"]').click();
  await page.locator("#emotion").selectOption("grin");
  await page.locator("#affect").fill("0.5");
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(() => window.mouthStudy.snapshot().lastEmotion),
    "grin",
  );
  const seen = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.querySelector("#demo").click();
        const names = new Set(),
          start = performance.now();
        function check() {
          const s = window.mouthStudy.snapshot();
          names.add(s.lastEmotion);
          if (s.demoTime > 10.5 || performance.now() - start > 25000)
            resolve([...names]);
          else requestAnimationFrame(check);
        }
        check();
      }),
  );
  for (const name of Object.keys(EMOTIONS))
    assert.ok(seen.includes(name), "demo missing " + name);
  // Three-note rehearsal with emotion held: each closure must hide all teeth.
  await page.locator("#emotion").selectOption("snarl");
  await page.locator("#affect").fill("1");
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.querySelector("#rehearse").click();
        const out = [],
          start = performance.now();
        function check() {
          const s = window.mouthStudy.snapshot();
          out.push({
            t: s.elapsed % 2.8,
            jaw: s.current.jaw,
            open: s.current.open,
            note: s.lastNote,
          });
          if (s.elapsed > 5.2 || performance.now() - start > 25000)
            resolve(out);
          else requestAnimationFrame(check);
        }
        check();
      }),
  );
  for (const name of ["o", "a", "e"])
    assert.ok(
      samples.some((s) => s.note === name && s.jaw > 0.06),
      name + " must articulate with emotion",
    );
  for (const [lo, hi] of [
    [0.49, 0.7],
    [1.21, 1.42],
    [1.93, 2.14],
  ])
    assert.ok(
      samples.some(
        (s) => s.t > lo && s.t < hi && s.open < 0.006 && s.jaw < 0.004,
      ),
      "closure " + lo,
    );
  await page.locator('[data-pose="closed"]').click();
  await page.locator("#emotion").selectOption("grin");
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "artifacts/mouth-acting/inspection-page.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Acting checks passed: fixed topology/hinge, 20 rigid crown identities, speech/affect blend, six-expression UI demo, emotion-held three-note closures and browser errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
