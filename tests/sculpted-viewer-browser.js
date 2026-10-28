import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL,
  base = remote || "http://localhost:5201/freakshow-projection/";
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: {
        ...process.env,
        PORT: "5201",
        BASE_PATH: "/freakshow-projection/",
      },
      stdio: "pipe",
    });
try {
  if (server) await new Promise((r) => server.stdout.once("data", r));
  await mkdir("public/3d-character-viewer/review", { recursive: true });
  await mkdir("artifacts/sculpted-viewer", { recursive: true });
  for (const engine of [
    "chromium",
    ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
  ]) {
    const browser = await (engine === "webkit" ? webkit : chromium).launch({
      executablePath:
        engine === "webkit"
          ? process.env.FREAKSHOW_WEBKIT_EXECUTABLE
          : "/usr/bin/chromium",
      proxy:
        remote && process.env.HTTPS_PROXY
          ? { server: process.env.HTTPS_PROXY }
          : undefined,
      args:
        engine === "chromium"
          ? ["--no-sandbox", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      });
      const errors = [],
        bad = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) bad.push(r.url());
      });
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(base + "public/3d-character-viewer/index.html");
      await page.waitForFunction(() => window.assetViewer?.modelState.loaded);
      await page.evaluate(() => (assetViewer.orbit.enableDamping = false));
      assert.equal(
        await page.evaluate(() => assetViewer.modelState.source),
        "procedural-code",
      );
      assert.equal(await page.evaluate(() => assetViewer.modelState.teeth), 24);
      assert.ok(
        await page.evaluate(
          () => assetViewer.renderer.info.render.triangles > 20000,
        ),
      );
      assert.equal(
        requests.some((u) =>
          /clown-head|\.png|\.svg|approved-character|GLTFLoader|\/renderer.js/.test(
            u,
          ),
        ),
        false,
      );
      const originals = await page.evaluate(() =>
        assetViewer.character.teeth.map((t) =>
          Array.from(t.geometry.attributes.position.array),
        ),
      );
      for (const view of [
        "front",
        "three-quarter",
        "side",
        "back",
        "underside",
      ]) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForTimeout(250);
        if (engine === "chromium" && !remote)
          await page
            .locator("#stage")
            .screenshot({
              path: `public/3d-character-viewer/review/${view}.png`,
            });
      }
      await page.locator("#jaw").fill("0.8");
      await page.locator('[data-view="three-quarter"]').click();
      await page.waitForTimeout(250);
      if (engine === "chromium" && !remote)
        await page
          .locator("#stage")
          .screenshot({
            path: "public/3d-character-viewer/review/jaw-open.png",
          });
      assert.deepEqual(
        await page.evaluate(() =>
          assetViewer.character.teeth.map((t) =>
            Array.from(t.geometry.attributes.position.array),
          ),
        ),
        originals,
      );
      assert.ok(
        await page.evaluate(() => assetViewer.character.lower.rotation.x > 0.3),
      );
      await page.locator("#jaw").fill("0");
      await page.locator("#expression").selectOption("smirk");
      await page.locator("#reset").click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `artifacts/sculpted-viewer/${engine}-${remote ? "published" : "generated"}-mobile.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
      console.log(
        `${engine}: visible procedural head; front/three-quarter/side/back/underside views; 24 rigid teeth under shared jaw rotation; no illustration or external model requests; mobile layout passes.`,
      );
      if (!remote)
        await writeFile(
          "public/3d-character-viewer/review/checks.json",
          JSON.stringify(
            {
              engine,
              errors,
              teeth: 24,
              source: "procedural-code",
              physicalIPhoneTested: false,
            },
            null,
            2,
          ),
        );
    } finally {
      await browser.close();
    }
  }
} finally {
  server?.kill();
}
