import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  POSES,
  TEETH,
  scene,
  faceMesh,
  jawPoint,
  rehearsal,
} from "../public/mouth-prototype/rig.js";
const original = JSON.stringify(TEETH);
for (const p of Object.values(POSES)) {
  const meshes = scene(p);
  assert.equal(meshes.filter((m) => m.id.includes("incisor")).length, 2);
  for (const t of TEETH) {
    const m = meshes.find((m) => m.id === t.id);
    const expected = t.upper
      ? t.mesh.vertices[20]
      : jawPoint(t.mesh.vertices[20], p.jaw);
    assert.deepEqual(m.vertices[20], expected);
    const d = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
    assert.ok(
      Math.abs(
        d(m.vertices[20], m.vertices[32]) -
          d(t.mesh.vertices[20], t.mesh.vertices[32]),
      ) < 1e-8,
    );
  }
}
assert.equal(JSON.stringify(TEETH), original);
const a = faceMesh(POSES.a),
  c = faceMesh(POSES.closed);
assert.equal(a.vertices.length, c.vertices.length);
assert.deepEqual(a.faces, c.faces);
assert.ok(
  a.vertices.some(
    (v, i) => v[1] > 600 && Math.abs(v[1] - c.vertices[i][1]) > 15,
  ),
  "chin must travel",
);
assert.ok(
  a.vertices.some(
    (v, i) => v[0] < 300 && v[1] > 400 && Math.abs(v[0] - c.vertices[i][0]) > 5,
  ),
  "cheek must deform",
);
for (const time of [0.55, 1.27, 1.99]) assert.equal(rehearsal(time).amount, 0);
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5188", BASE_PATH: "/freakshow-projection/" },
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
      viewport: { width: 1600, height: 1200 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Exercise navigation from the installed production offline worker as well.
  await page.goto("http://localhost:5188/freakshow-projection/");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto(
    "http://localhost:5188/freakshow-projection/public/mouth-prototype/index.html",
  );
  await page.waitForFunction(
    () => window.mouthStudy?.snapshot().renderCount > 2,
  );
  const visibility = await page.evaluate(async () => {
    const { createRenderer, POSES, faceMesh, mix } = await import("./rig.js");
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 900;
    const render = createRenderer(canvas),
      gl = canvas.getContext("webgl"),
      results = [];
    function inside(x, y, poly) {
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
    }
    const cases = Object.entries(POSES).flatMap(([name, target]) => [
      ...[0, 0.25, 0.5, 0.75, 1].map((strength) => ({
        name,
        strength,
        yaw: 0,
        p: mix(POSES.closed, target, strength),
      })),
      ...[-25, 25].map((yaw) => ({ name, strength: 1, yaw, p: target })),
    ]);
    for (const { name, p, strength, yaw } of cases) {
      render(p, { diagnostic: true, yaw });
      const pixels = new Uint8Array(900 * 900 * 4);
      gl.readPixels(0, 0, 900, 900, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const angle = (yaw * Math.PI) / 180;
      const rim = faceMesh(p).rim.map(([x, y, z]) => [
        450 + (((x - 450) * Math.cos(angle) + z * Math.sin(angle)) * 900) / 800,
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
      results.push({ name, strength, yaw, exposed, outside });
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return results;
  });
  for (const r of visibility) {
    assert.ok(
      r.outside < 8,
      JSON.stringify(r) + " teeth must stay within lip aperture",
    );
    if (r.name === "closed" || r.strength === 0)
      assert.equal(r.exposed, 0, "closed lips must hide every crown");
  }
  console.log(
    "Rendered dental visibility:",
    visibility.length,
    "front/intermediate/angled views; max outside-aperture crown pixels:",
    Math.max(...visibility.map((v) => v.outside)),
  );
  await mkdir("artifacts/mouth-prototype", { recursive: true });
  for (const pose of ["closed", "o", "a", "e"]) {
    await page.locator(`[data-pose="${pose}"]`).click();
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => window.mouthStudy.snapshot());
    assert.ok(state.stats.depthTest);
    assert.equal(state.stats.teeth, 20);
    await page
      .locator("#anatomy")
      .screenshot({ path: `artifacts/mouth-prototype/${pose}.png` });
  }
  await page.evaluate(async () => {
    const { createRenderer, POSES } = await import("./rig.js");
    const contact = document.createElement("div");
    contact.id = "expression-contact";
    Object.assign(contact.style, {
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "1000",
      width: "1200px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "#192126",
      padding: "20px",
      gap: "16px",
      color: "#ead1a7",
    });
    document.body.append(contact);
    for (const [name, p] of Object.entries(POSES)) {
      const figure = document.createElement("figure");
      figure.style.margin = "0";
      const label = document.createElement("figcaption");
      label.textContent = {
        closed: "Closed",
        o: "Rounded O",
        a: "Wide A",
        e: "Stretched E",
      }[name];
      label.style.cssText = "font:22px Georgia;padding:12px";
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 900;
      canvas.style.cssText =
        "display:block;width:564px;height:564px;min-height:0;max-height:none";
      figure.append(label, canvas);
      contact.append(figure);
      createRenderer(canvas)(p);
    }
  });
  await page
    .locator("#expression-contact")
    .screenshot({ path: "artifacts/mouth-prototype/expressions.png" });
  await page.locator("#expression-contact").evaluate((e) => {
    for (const c of e.querySelectorAll("canvas"))
      c.getContext("webgl").getExtension("WEBGL_lose_context")?.loseContext();
    e.remove();
  });
  await page.locator('[data-pose="a"]').click();
  await page.waitForTimeout(700);
  await page.locator("#wire").check();
  await page.waitForTimeout(100);
  await page
    .locator("#anatomy")
    .screenshot({ path: "artifacts/mouth-prototype/mesh.png" });
  await page.locator("#wire").uncheck();
  await page.locator("#cutaway").check();
  await page.locator("#yaw").fill("22");
  await page.waitForTimeout(200);
  await page
    .locator("#anatomy")
    .screenshot({ path: "artifacts/mouth-prototype/cutaway.png" });
  await page.locator("#cutaway").uncheck();
  await page.locator("#yaw").fill("0");
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.getElementById("rehearse").click();
        const out = [],
          start = performance.now();
        function sample() {
          const s = window.mouthStudy.snapshot();
          out.push({
            t: s.elapsed % 2.8,
            jaw: s.current.jaw,
            note: s.lastNote,
          });
          if (s.elapsed > 5.2 || performance.now() - start > 25000)
            resolve(out);
          else requestAnimationFrame(sample);
        }
        sample();
      }),
  );
  for (const name of ["o", "a", "e"])
    assert.ok(
      samples.some((s) => s.note === name && s.jaw > 0.07),
      name + " must open",
    );
  for (const [lo, hi] of [
    [0.49, 0.7],
    [1.21, 1.42],
    [1.93, 2.14],
  ])
    assert.ok(
      samples.some((s) => s.t > lo && s.t < hi && s.jaw < 0.004),
      "closure " + lo,
    );
  await page.locator("#pause").click();
  const held = await page.evaluate(() => window.mouthStudy.snapshot().current);
  await page.waitForTimeout(150);
  assert.deepEqual(
    await page.evaluate(() => window.mouthStudy.snapshot().current),
    held,
  );
  await page.locator('[data-pose="a"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "artifacts/mouth-prototype/inspection-page.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 430, height: 900 });
  await page.screenshot({
    path: "artifacts/mouth-prototype/mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Prototype checks passed: shared mesh cheek/chin displacement; 20 rigid tooth identities; depth testing; four poses; three distinct gestures with closure; pause; mobile; no runtime errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
