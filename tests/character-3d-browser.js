import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.js"], {
  env: { ...process.env, PORT: "5197" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((r) => server.stdout.once("data", r));
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.error(m.text());
  });
  await page.goto("http://localhost:5197/public/character-3d/index.html");
  await page.waitForFunction(() => window.characterStudy);
  await page.evaluate(() => {
    characterStudy.orbit.enableDamping = false;
  });
  await mkdir("public/character-3d/review", { recursive: true });
  for (const [name, pose, view] of [
    ["front", "grin", "front"],
    ["three-quarter", "grin", "three-quarter"],
    ["side", "grin", "side"],
    ["mouth-open", "open", "three-quarter"],
    ["mouth-closed", "closed", "front"],
    ["neutral", "neutral", "three-quarter"],
  ]) {
    await page.evaluate(
      ({ pose, view }) => {
        characterStudy.setPose(pose);
        characterStudy.setView(view);
      },
      { pose, view },
    );
    await page.waitForTimeout(700);
    await page
      .locator("#viewport")
      .screenshot({ path: `public/character-3d/review/${name}.png` });
  }
  const s = await page.evaluate(() => characterStudy.state);
  assert.equal(s.teeth, 24);
  assert.equal(await page.locator("canvas").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => characterStudy.setPose("grin"));
  await page.waitForTimeout(700);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "public/character-3d/review/mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "public/character-3d/review/checks.json",
    JSON.stringify(
      {
        browser: "Chromium software WebGL",
        views: 6,
        teeth: 24,
        errors,
        physicalIPhoneTested: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "3D review captures produced; 24 rigid teeth, orbit views, mobile layout, no runtime errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
