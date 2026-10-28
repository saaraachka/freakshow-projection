import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.js", "dist"], {
  env: { ...process.env, PORT: "5177", BASE_PATH: "/freakshow-projection/" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("http://localhost:5177/freakshow-projection/");
  await page.evaluate(async () => {
    const rig = await import("./src/clown-rig.js");
    await rig.loadClownRig();
  });
  await page.locator('[data-mode="studio"]').click();
  await page.locator("#idle").selectOption("still");
  await mkdir("artifacts", { recursive: true });
  await page.locator("#rigPose").selectOption("closed");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/approved-rig-closed.png",
    fullPage: true,
  });
  const closed = await page.locator("#preview").evaluate((c) => c.toDataURL());
  await page.locator("#rigPose").selectOption("extreme");
  await page.waitForTimeout(500);
  const open = await page.locator("#preview").evaluate((c) => c.toDataURL());
  assert.notEqual(open, closed);
  await page.screenshot({
    path: "artifacts/approved-rig-open.png",
    fullPage: true,
  });
  const geometry = await page.evaluate(async () => {
    const { drawScene } = await import("./src/renderer.js"),
      { loadClownRig } = await import("./src/clown-rig.js"),
      { RIG_POSES } = await import("./src/rig-motion.js"),
      { Engine, DEFAULTS } = await import("./src/engine.js");
    await loadClownRig();
    const contact = document.createElement("canvas");
    contact.id = "rigContact";
    contact.width = 1440;
    contact.height = 1100;
    Object.assign(contact.style, { position: "fixed", inset: 0, zIndex: 9999 });
    document.body.append(contact);
    const c = contact.getContext("2d");
    c.fillStyle = "#201b22";
    c.fillRect(0, 0, 1440, 1100);
    c.font = "18px Arial";
    const image = new Image();
    image.src = "Vintage%20Horror%20Clown%20Model%20Sheet.png";
    await image.decode();
    c.drawImage(image, 0, 0, 423, 606, 0, 35, 360, 516);
    c.fillStyle = "#eee";
    c.fillText("APPROVED REFERENCE", 12, 23);
    const records = [];
    let index = 1;
    for (const [name, pose] of Object.entries(RIG_POSES)) {
      const stage = document.createElement("canvas");
      stage.width = 1280;
      stage.height = 720;
      const x = stage.getContext("2d"),
        draw = x.drawImage.bind(x),
        teeth = [];
      x.drawImage = (...args) => {
        const source = args[0];
        if (
          (source.width === 226 && source.height === 72) ||
          (source.width === 195 && source.height === 74)
        )
          teeth.push({ source, width: args[3], height: args[4] });
        draw(...args);
      };
      const state = new Engine().step({ bass: 0, mid: 0, high: 0 }, 0);
      state.rig = { ...pose, eye: 0 };
      drawScene(stage, state, { ...DEFAULTS, idle: "still" }, 0);
      records.push({ name, teeth });
      const column = index % 4,
        row = Math.floor(index / 4);
      c.drawImage(
        stage,
        400,
        0,
        480,
        720,
        column * 360,
        row * 550 + 35,
        360,
        510,
      );
      c.fillStyle = "#eee";
      c.fillText(name.toUpperCase(), column * 360 + 12, row * 550 + 23);
      index++;
    }
    const upper = records[0].teeth.find((t) => t.source.width === 226),
      lower = records[0].teeth.find((t) => t.source.width === 195);
    return records.map((r) => ({
      name: r.name,
      upperSame:
        r.teeth.find((t) => t.source.width === 226)?.source === upper.source,
      lowerSame:
        r.teeth.find((t) => t.source.width === 195)?.source === lower.source,
      sizes: r.teeth.map((t) => [t.width, t.height]),
    }));
  });
  assert.equal(geometry.length, 7);
  for (const pose of geometry) {
    assert.ok(
      pose.upperSame && pose.lowerSame,
      pose.name + " must reuse identical tooth textures",
    );
    assert.deepEqual(pose.sizes, geometry[0].sizes);
  }
  await page
    .locator("#rigContact")
    .screenshot({ path: "artifacts/approved-rig-contact-sheet.png" });
  await page.locator("#rigContact").evaluate((c) => c.remove());
  await page.locator("#rigMouth").fill("0.5");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#rigPose").inputValue(), "custom");
  await page.locator("#triggerMouth").click();
  assert.equal(await page.locator("#rigPose").inputValue(), "animated");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.evaluate(async () => {
    await (await import("./src/clown-rig.js")).loadClownRig();
  });
  assert.deepEqual(errors, []);
  console.log(
    "Rig browser checks passed: approved image loads under Pages path and offline; seven rendered poses share identical tooth sprites and dimensions; manual and triggered preview work; no console/asset errors.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
