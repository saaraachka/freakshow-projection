import { webkit } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.js"], {
  env: { ...process.env, PORT: "5198" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((r) => server.stdout.once("data", r));
  browser = await webkit.launch({
    executablePath: process.env.FREAKSHOW_WEBKIT_EXECUTABLE,
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5198/public/character-3d/index.html");
  await page.waitForFunction(() => window.characterStudy);
  await page.locator("#quality").selectOption("low");
  await page.waitForTimeout(800);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const result = await page.evaluate(() => ({
    webgl: characterStudy.renderer.capabilities.isWebGL2,
    teeth: characterStudy.state.teeth,
    triangles: characterStudy.renderer.info.render.triangles,
    dpr: characterStudy.renderer.getPixelRatio(),
  }));
  assert.equal(result.teeth, 24);
  assert.ok(result.triangles > 0);
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: "public/character-3d/review/webkit-mobile.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      engine: "WebKit software WebGL",
      ...result,
      errors,
      physicalIPhone: false,
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
