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
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.__meshSurfaces = [];
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
      const result = original.call(this, type, attributes);
      if (type === "webgl" && result && !window.__meshSurfaces.includes(this))
        window.__meshSurfaces.push(this);
      return result;
    };
  });
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
  const emotions = await page.evaluate(async () => {
    const { approvedStatus } = await import("./src/approved-character.js");
    document.querySelector("#meshDemo").click();
    const start = performance.now(),
      startTime = approvedStatus(document.querySelector("#preview")).time,
      seen = new Set();
    return new Promise((resolve) => {
      function observe() {
        const s = approvedStatus(document.querySelector("#preview"));
        seen.add(s.emotion);
        if (s.time - startTime > 10.9 || performance.now() - start > 40000)
          resolve([...seen]);
        else requestAnimationFrame(observe);
      }
      observe();
    });
  });
  for (const name of [
    "grin",
    "snarl",
    "laughter",
    "smirk",
    "scream",
    "whisper",
  ])
    assert.ok(
      emotions.includes(name),
      "production acting demo missing " + name,
    );
  await page.locator("#meshDemo").click();
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
  await page.locator('[data-mode="studio"]').click();
  await page.locator("#meshSpeech").selectOption("closed");
  await page.locator("#rigGaze").selectOption("left");
  await page.locator("#rigPupil").selectOption("0");
  await page.waitForTimeout(700);
  const resting = await page.evaluate(async () => {
    const { approvedStatus } = await import("./src/approved-character.js");
    return approvedStatus(document.querySelector("#preview"));
  });
  await page.locator("#rigPupil").selectOption("1");
  await page.waitForTimeout(250);
  const dilated = await page.evaluate(async () => {
    const { approvedStatus } = await import("./src/approved-character.js");
    return approvedStatus(document.querySelector("#preview"));
  });
  assert.equal(resting.irisRadius, dilated.irisRadius);
  assert.ok(dilated.pupilRadius > resting.pupilRadius + 7);
  assert.ok(Math.abs(resting.gaze.x - dilated.gaze.x) < 0.1);
  await page
    .locator("#preview")
    .screenshot({ path: "artifacts/integration/pupil-dilation.png" });
  await page.locator("#rigPupil").selectOption("animated");
  await page.locator("#rigGaze").selectOption("idle");
  await page.locator('[data-mode="live"]').click();
  await page.locator("#startMic").click();
  await page.waitForFunction(
    () => !document.querySelector("#stopMic").disabled,
  );
  await page.waitForFunction(
    () =>
      document.querySelector("#preview").dataset.characterRenderer ===
      "approved-mesh",
  );
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#projector").click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () =>
      document.querySelector("#preview")?.dataset.characterRenderer ===
      "approved-mesh",
  );
  const projected = await popup.evaluate(async () => {
    const { approvedStatus } = await import("./src/approved-character.js");
    return approvedStatus(document.querySelector("#preview"));
  });
  assert.equal(projected.source, "public/mouth-prototype/rig.js");
  assert.equal(projected.teeth, 20);
  assert.ok(projected.headBounds.height <= projected.stage.height - 40);
  await popup.locator("#projectorHint").click();
  await popup.waitForFunction(() => !!document.fullscreenElement);
  await popup.screenshot({ path: "artifacts/integration/projector-mesh.png" });
  await popup.close();
  await page.locator("#stopMic").click();
  await page.screenshot({
    path: "artifacts/integration/live-mesh.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    const extension = window.__meshSurfaces[0]
      .getContext("webgl")
      .getExtension("WEBGL_lose_context");
    window.__lostExtension = extension;
    extension.loseContext();
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#preview").dataset.characterRenderer ===
      "legacy-fallback",
  );
  await page.evaluate(() => window.__lostExtension.restoreContext());
  await page.waitForFunction(
    () =>
      document.querySelector("#preview").dataset.characterRenderer ===
      "approved-mesh",
  );
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-mode="studio"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("#preview").dataset.characterRenderer ===
      "approved-mesh",
  );
  await page.screenshot({
    path: "artifacts/integration/offline-mesh.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Production integration passed: actual approved mesh in Studio/Song/Live/fullscreen projector; distinct detected notes and closures; pupils/gaze; fallback/context recovery; mobile layout and offline mesh.",
  );
} finally {
  await browser?.close();
  server.kill();
}
