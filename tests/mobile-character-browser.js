import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5193" },
  stdio: "pipe",
});
let browser;
const report = [];
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  await mkdir("artifacts/integration", { recursive: true });
  for (const engine of process.env.FREAKSHOW_WEBKIT_EXECUTABLE ||
  process.env.FREAKSHOW_TEST_WEBKIT
    ? ["chromium", "webkit"]
    : ["chromium"]) {
    browser = await (engine === "webkit" ? webkit : chromium).launch(
      engine === "webkit"
        ? process.env.FREAKSHOW_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.FREAKSHOW_WEBKIT_EXECUTABLE }
          : {}
        : {
            executablePath: "/usr/bin/chromium",
            args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
          },
    );
    const context = await browser.newContext({ ...devices["iPhone 13"] }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:5193/");
    await page.locator('[data-mode="studio"]').click();
    await page.locator("#idle").selectOption("still");
    await page.locator("#meshSpeech").selectOption("closed");
    await page.locator("#meshEmotion").selectOption("scream");
    await page
      .locator("summary")
      .filter({ hasText: "Stage appearance" })
      .click();
    await page.locator("#characterQuality").selectOption("high");
    await page.waitForFunction(
      () =>
        document.querySelector("#preview").dataset.characterRenderer ===
        "approved-mesh",
    );
    await page.waitForTimeout(500);
    const sample = async () =>
      page.evaluate(async () => {
        const { approvedStatus } = await import("./src/approved-character.js");
        const c = document.querySelector("#preview"),
          r = c.getBoundingClientRect();
        return {
          ...approvedStatus(c),
          canvas: {
            width: c.width,
            height: c.height,
            cssWidth: r.width,
            cssHeight: r.height,
            dpr: devicePixelRatio,
          },
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
    const high = await sample();
    assert.equal(high.source, "public/mouth-prototype/rig.js");
    assert.equal(high.teeth, 20);
    assert.equal(high.overflow, false);
    assert.ok(high.canvas.width >= high.canvas.cssWidth * 2.95);
    assert.ok(high.canvas.height >= high.canvas.cssHeight * 2.95);
    assert.ok(
      high.headBounds.width <= high.stage.width - 40 &&
        high.headBounds.height <= high.stage.height - 40,
      "whole head and jaw fit",
    );
    const chin = await page.evaluate(async () => {
      const { approvedStatus } = await import("./src/approved-character.js"),
        { faceMesh } = await import("./public/mouth-prototype/rig.js");
      const c = document.querySelector("#preview"),
        s = approvedStatus(c),
        point = faceMesh(s.params).vertices[8 * 128 + 96],
        scale = s.headBounds.width / 900;
      const x = Math.round(
          ((s.stage.width / 2 + (point[0] - 450) * scale) * c.width) / 1280,
        ),
        y = Math.round(
          ((s.stage.height / 2 + (point[1] - 420) * scale) * c.width) / 1280,
        );
      return [...c.getContext("2d").getImageData(x, y, 1, 1).data];
    });
    assert.ok(
      chin[0] > 45 && chin[1] > 30,
      "connected chin must shade as skin, not black/NaN: " + chin,
    );
    await page.screenshot({
      path: `artifacts/integration/${engine}-iphone-high.png`,
      fullPage: true,
    });
    await page.locator("#characterQuality").selectOption("economy");
    await page.waitForTimeout(500);
    const low = await sample();
    assert.equal(low.triangles, high.triangles);
    assert.equal(low.teeth, high.teeth);
    assert.ok(low.resolution < high.resolution);
    assert.equal(low.targetFPS, 24);
    for (const k of Object.keys(high.params))
      assert.ok(
        Math.abs(high.params[k] - low.params[k]) < 0.001,
        "quality must preserve pose/anatomy",
      );
    await page.screenshot({
      path: `artifacts/integration/${engine}-iphone-economy.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    const landscape = await sample();
    assert.equal(landscape.overflow, false);
    assert.ok(landscape.headBounds.height <= landscape.stage.height - 40);
    await page.screenshot({
      path: `artifacts/integration/${engine}-iphone-landscape.png`,
      fullPage: true,
    });
    await page.locator("#preview").scrollIntoViewIfNeeded();
    const frameTimes = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [],
            begin = performance.now();
          let last = begin;
          function tick(t) {
            times.push(t - last);
            last = t;
            if (t - begin > 1200) resolve(times);
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }),
    );
    report.push({
      engine,
      environment: "Cloud software rendering; not a physical device benchmark",
      device: "iPhone 13 emulation",
      dpr: high.canvas.dpr,
      high: {
        resolution: high.resolution,
        triangles: high.triangles,
        drawMs: high.totalMs,
      },
      economy: {
        resolution: low.resolution,
        triangles: low.triangles,
        drawMs: low.totalMs,
        targetFPS: low.targetFPS,
      },
      rafMedianMs: frameTimes.sort((a, b) => a - b)[
        Math.floor(frameTimes.length / 2)
      ],
    });
    await page.locator("#meshEmotion").selectOption("none");
    await page.locator('[data-mode="song"]').click();
    await page
      .locator("#audioFile")
      .setInputFiles("tests/fixtures/accents.mp3");
    await page.waitForFunction(() => !document.querySelector("#play").disabled);
    await page.locator("#seek").evaluate((el) => {
      el.value = 1.6;
      el.dispatchEvent(new Event("input"));
    });
    await page.waitForFunction(async () => {
      const { approvedStatus } = await import("./src/approved-character.js");
      return (
        approvedStatus(document.querySelector("#preview"))?.params.open > 0.05
      );
    });
    await page.screenshot({
      path: `artifacts/integration/${engine}-iphone-song.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    browser = null;
  }
  await writeFile(
    "artifacts/integration/mobile-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
