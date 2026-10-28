import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5192" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      permissions: ["microphone"],
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5192/");
  await page.locator('[data-mode="studio"]').click();
  await page.locator("#idle").selectOption("still");
  await page.waitForFunction(
    () =>
      document.querySelector("#preview").dataset.characterRenderer ===
      "approved-mesh",
  );
  await page.locator("summary").filter({ hasText: "Stage appearance" }).click();
  await page.locator("#characterQuality").selectOption("high");
  await page.locator("#meshSpeech").selectOption("a");
  await page.locator("#meshEmotion").selectOption("grin");
  await page.waitForTimeout(600);
  await mkdir("artifacts/integration", { recursive: true });
  await page.screenshot({
    path: "artifacts/integration/studio-mesh.png",
    fullPage: true,
  });
  assert.ok(
    Number(await page.locator("#preview").getAttribute("data-mesh-triangles")) >
      15000,
  );
  await page.locator("#character").selectOption("legacy");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/integration/studio-legacy.png",
    fullPage: true,
  });
  assert.equal(
    await page.locator("#preview").getAttribute("data-character-renderer"),
    "legacy",
  );
  await page.locator("#character").selectOption("mesh");
  await page.locator("#meshEmotion").selectOption("none");
  await page.locator("#meshSpeech").selectOption("closed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/integration/mobile-mesh.png",
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
    "Stage 1: actual approved mesh, legacy fallback, full expression controls and narrow viewport render without runtime errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
