import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { synthesize, wav } from "./helpers.js";
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/accents.json", import.meta.url)),
);
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/accents.wav",
  wav(synthesize(fixture), fixture.sampleRate),
);
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5174" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
    server.once("exit", (code) => reject(Error("Server exited " + code)));
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["microphone"],
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5174");
  await page.waitForFunction(() =>
    document.querySelector("#offlineStatus").textContent.includes("cached"),
  );
  await page.screenshot({
    path: "artifacts/song-lab-empty.png",
    fullPage: true,
  });
  await page.locator("#audioFile").setInputFiles("artifacts/accents.wav");
  await page.waitForFunction(() => !document.querySelector("#play").disabled);
  assert.match(
    await page.locator("#analysisLabel").textContent(),
    /240 FIXED STEPS/,
  );
  for (const note of fixture.annotations) {
    await page.locator("#noteTime").fill(String(note.time));
    await page.locator("#noteKind").selectOption(note.kind);
    await page.locator("#noteText").fill(note.text);
    await page.locator("#addNote").click();
  }
  await page.locator("#runRegression").click();
  assert.match(
    await page.locator("#regressionSummary").textContent(),
    /4 of 4/,
  );
  async function seek(value) {
    await page.locator("#seek").evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event("input"));
    }, value);
    await page.waitForTimeout(120);
  }
  await seek(0.6);
  const atAccent = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  await page.screenshot({
    path: "artifacts/song-lab-accent.png",
    fullPage: true,
  });
  await seek(2.5);
  const atSilence = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(atAccent, atSilence);
  await seek(0.6);
  assert.equal(
    await page.locator("#preview").evaluate((c) => c.toDataURL()),
    atAccent,
    "seeking must reproduce exact rendered pose",
  );
  await page.locator("#play").click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator("#play").textContent(), "Ⅱ Pause");
  await page.locator("#play").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportNotes").click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/session.json");
  await page.reload();
  await page.locator("#audioFile").setInputFiles("artifacts/accents.wav");
  await page.waitForFunction(() => !document.querySelector("#play").disabled);
  assert.equal(
    await page.locator("#notes li").count(),
    4,
    "notes persist per audio fingerprint",
  );
  await page.locator("#notesFile").setInputFiles("artifacts/session.json");
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("restored"),
  );
  await page.locator("#audioFile").setInputFiles("tests/fixtures/accents.mp3");
  await page.waitForFunction(() => !document.querySelector("#play").disabled);
  assert.match(await page.locator("#songName").textContent(), /accents.mp3/);
  for (const note of fixture.annotations) {
    await page.locator("#noteTime").fill(String(note.time));
    await page.locator("#noteKind").selectOption(note.kind);
    await page.locator("#addNote").click();
  }
  await page.locator("#runRegression").click();
  assert.match(
    await page.locator("#regressionSummary").textContent(),
    /4 of 4/,
    "MP3 decoding must retain annotated onsets",
  );
  await page.locator('[data-mode="studio"]').click();
  await page.locator("#idle").selectOption("still");
  await page.locator("#pauseMotion").click();
  const idle = await page.locator("#preview").evaluate((c) => c.toDataURL());
  await page.locator("#triggerEye").click();
  await page.locator("#pauseMotion").click();
  await page.waitForTimeout(170);
  const triggered = await page
    .locator("#preview")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(idle, triggered);
  await page.screenshot({
    path: "artifacts/visual-studio-eyes.png",
    fullPage: true,
  });
  await page.waitForTimeout(900);
  await page.locator("#triggerMouth").click();
  await page.waitForTimeout(170);
  await page.screenshot({
    path: "artifacts/visual-studio-jaw.png",
    fullPage: true,
  });
  await page.locator('[data-mode="live"]').click();
  await page.locator("#startMic").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Microphone live"),
  );
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#projector").click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup.waitForTimeout(250);
  const projected = await popup.locator("#preview").evaluate((c) => {
    const p = c.getContext("2d").getImageData(640, 360, 1, 1).data;
    return [...p];
  });
  assert.equal(projected[3], 255, "projector receives actual artwork");
  await popup.locator("#projectorHint").click();
  await popup.waitForFunction(() => !!document.fullscreenElement);
  await popup.screenshot({ path: "artifacts/projector.png" });
  await page.locator("#stopMic").click();
  await page.waitForFunction(
    () => !document.querySelector("#startMic").disabled,
  );
  await popup.close();
  await page.locator('[data-mode="studio"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/mobile-studio.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile layout must fit viewport",
  );
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector("#stateLabel").textContent.includes("IDLE"),
  );
  await page.locator('[data-mode="studio"]').click();
  await page.locator("#triggerEye").click();
  await page.waitForTimeout(150);
  assert.match(await page.locator("#stateLabel").textContent(), /EYES/);
  await page.locator('[data-mode="live"]').click();
  const offlinePopupPromise = page.waitForEvent("popup");
  await page.locator("#projector").click();
  const offlinePopup = await offlinePopupPromise;
  await offlinePopup.waitForLoadState();
  await offlinePopup.waitForFunction(
    () =>
      document
        .querySelector("#preview")
        .getContext("2d")
        .getImageData(640, 360, 1, 1).data[3] === 255,
  );
  await offlinePopup.close();
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: WAV + MP3, annotations, regression, exact seek rendering, playback, persistence, import/export, studio triggers, microphone, fullscreen projector, mobile layout and offline reload.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
