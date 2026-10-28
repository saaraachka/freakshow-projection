import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { synthesize, wav } from "./helpers.js";
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
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('[data-mode="song"]').click();
  const melody = {
    duration: 1.7,
    sampleRate: 44100,
    tones: [0.3, 0.6, 0.9].map((start, i) => ({
      start,
      end: start + 0.13,
      frequency: [440, 554, 659][i],
      amplitude: 0.65,
    })),
  };
  await writeFile(
    "artifacts/integration/three-notes.wav",
    wav(synthesize(melody), 44100),
  );
  await page
    .locator("#audioFile")
    .setInputFiles("artifacts/integration/three-notes.wav");
  await page.waitForFunction(() => !document.querySelector("#play").disabled);
  for (let i = 0; i < 3; i++) {
    await page.locator("#seek").evaluate(
      (el, t) => {
        el.value = t;
        el.dispatchEvent(new Event("input"));
      },
      0.4 + i * 0.3,
    );
    await page.waitForFunction(async (note) => {
      const { approvedStatus } = await import("./src/approved-character.js");
      const s = approvedStatus(document.querySelector("#preview"));
      return s?.note === note && s.params.open > 0.25;
    }, i + 1);
    await page
      .locator("#preview")
      .screenshot({ path: `artifacts/integration/song-note-${i + 1}.png` });
    const status = await page.evaluate(async () => {
      const { approvedStatus } = await import("./src/approved-character.js");
      return approvedStatus(document.querySelector("#preview"));
    });
    assert.equal(status.speech, ["o", "a", "e"][i]);
    assert.equal(status.teeth, 20);
    await page.locator("#seek").evaluate(
      (el, t) => {
        el.value = t;
        el.dispatchEvent(new Event("input"));
      },
      0.57 + i * 0.3,
    );
    await page.waitForFunction(async () => {
      const { approvedStatus } = await import("./src/approved-character.js");
      return (
        approvedStatus(document.querySelector("#preview"))?.params.open < 0.025
      );
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Stage 1: actual approved mesh, legacy fallback, full expression controls and narrow viewport render without runtime errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
