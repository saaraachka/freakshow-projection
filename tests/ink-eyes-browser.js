import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base =
    process.env.SHOW_BASE || "http://localhost:5195/freakshow-projection/",
  wk = !!process.env.SHOW_WEBKIT,
  dir =
    process.env.SHOW_EVIDENCE ||
    "artifacts/ink-eyes-" + (wk ? "webkit" : "chromium");
await mkdir(dir, { recursive: true });
const b = await (wk ? webkit : chromium).launch({
  executablePath: wk ? "/tmp/freakshow-webkit-run" : "/usr/bin/chromium",
  ...(base.startsWith("https:")
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
  ...(!wk ? { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] } : {}),
});
try {
  const context = await b.newContext({
      viewport: { width: 1100, height: 800 },
    }),
    p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text() + " " + m.location().url);
  });
  await p.goto(base + "public/live-show/index.html?ink-review");
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  await p.click("#reset");
  console.log("Ink stage ready");
  assert.equal(await p.evaluate(() => freakshowLive.ink.mode), "ink");
  const geometry = await p.evaluate(() => {
    const a = freakshowLive;
    return {
      exact: Array.from(
        a.character.face.geometry.attributes.position.array,
      ).every((v, i) => v === a.rig.rest[i]),
      shared: a.ink.records.every(
        (r) => r.mesh.geometry === r.outline.geometry,
      ),
      globes: a.eyeDetails.globes.size,
    };
  });
  assert.ok(geometry.exact && geometry.shared);
  assert.equal(geometry.globes, 2);
  // Freeze only the test sampling time so all matched captures show the actual GPU
  // shader at precise dilation/gaze values, without relying on screenshot latency.
  const freeze = async (pose, pulse = 0, angle = 0) => {
    await p.evaluate(
      ({ pose, pulse, angle }) => {
        const a = freakshowLive;
        a.controller.reset();
        a.controller.base = { ...a.controller.zero(), ...pose };
        document.querySelector("#idle").checked = false;
        document.querySelector("#headPulseIntensity").value = "0";
        document
          .querySelector("#headPulseIntensity")
          .dispatchEvent(new Event("change"));
        document.querySelector("#pulseEnabled").checked = false;
        a.eyePulse.sample = () => pulse;
        document.querySelector("#pulseEnabled").checked = true;
        document.querySelector("#pulseSource").value = "kick";
        a.character.root.userData.reviewAngle = angle;
      },
      { pose, pulse, angle },
    );
  };
  // Root orientation normally belongs to idle. For camera review, use the existing
  // camera rather than modifying any sculpt transforms or facial buffers.
  async function cameraAngle(angle) {
    await p.evaluate((angle) => {
      const a = freakshowLive;
      a.camera.position.set(
        Math.sin(angle) * 5.4,
        0.25,
        -0.1 + Math.cos(angle) * 5.4,
      );
      a.camera.lookAt(0, 0.25, -0.1);
      a.render();
    }, angle);
  }
  // Expose matched camera through test API (same projection, only orbit changes).
  const captures = [];
  for (const [name, pose] of Object.entries(
    await p.evaluate(() => freakshowLive.presets),
  )) {
    await freeze(pose, 0);
    await p.waitForTimeout(180);
    await p.click("#hide");
    await p
      .locator("#stage")
      .screenshot({ path: dir + "/expression-" + captures.length + ".png" });
    await p.click("#reveal");
    captures.push(name);
  }
  await freeze({ gazeX: 0.5, gazeY: 0.25 }, 0);
  await p.waitForTimeout(150);
  await p.click("#hide");
  await p.locator("#stage").screenshot({ path: dir + "/eyes-small.png" });
  await p.click("#reveal");
  const small = await p.evaluate(
    () => ({ pupil: freakshowLive.eyeDetails.uniforms.uPupil.value, iris: freakshowLive.eyeDetails.uniforms.uIris.value }),
  );
  await freeze({ gazeX: 0.5, gazeY: 0.25 }, 1);
  await p.waitForTimeout(150);
  await p.click("#hide");
  await p.locator("#stage").screenshot({ path: dir + "/eyes-large.png" });
  await p.click("#reveal");
  const large = await p.evaluate(() => ({
    iris: freakshowLive.eyeDetails.uniforms.uIris.value,
    pupil: freakshowLive.eyeDetails.uniforms.uPupil.value,
  }));
  assert.equal(large.pupil, small.pupil);
  assert.ok(large.iris > small.iris * 1.39);
  assert.ok(large.pupil < large.iris * 0.77);

  for (const [label, angle, gaze, pulse, blink] of [
    ["left", -0.6, -0.5, 0, 0],
    ["right", 0.6, 0.5, 1, 0],
    ["blink", 0.6, 0.4, 0.6, 0.3],
  ]) {
    await freeze({ gazeX: gaze, gazeY: 0.2, blink }, pulse);
    await cameraAngle(angle);
    await p.waitForTimeout(200);
    await p.click("#hide");
    await p
      .locator("#stage")
      .screenshot({ path: dir + "/eyes-" + label + ".png" });
    await p.click("#reveal");
  }
  await cameraAngle(0);
  await p.click("#hide");
  const stableA = await p.locator("#stage").screenshot();
  await p.waitForTimeout(120);
  const stableB = await p.locator("#stage").screenshot();
  assert.ok(
    stableA.equals(stableB),
    "Static ink contours changed between frames",
  );
  await p.click("#reveal");

  await p.selectOption("#renderMode", "original");
  await p.waitForTimeout(200);
  await p.click("#hide");
  await p.locator("#stage").screenshot({ path: dir + "/original-3d.png" });
  await p.click("#reveal");
  assert.ok(
    await p.evaluate(() =>
      freakshowLive.ink.records.every((r) => !r.outline.visible),
    ),
  );
  await p.selectOption("#renderMode", "ink");
  const alias = await p.evaluate(() =>
    freakshowLive.ink.records.every(
      (r) =>
        r.outline.geometry.attributes.position ===
        r.mesh.geometry.attributes.position,
    ),
  );
  assert.ok(alias);
  // Restore real timing; long running musical pulses stay independent of emotion.
  await p.reload();
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  await p.selectOption("#pulseSource", "bpm");
  await p.fill("#bpm", "140");
  await p.locator("#bpm").dispatchEvent("change");
  const pulseSamples = [];
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(200);
    pulseSamples.push(
      await p.evaluate(() => ({
        amount: freakshowLive.eyeDetails.dilation,
        name: freakshowLive.controller.currentExpression,
      })),
    );
  }
  assert.ok(pulseSamples.some((s) => s.amount > 0.3));
  assert.ok(pulseSamples.some((s) => s.amount < 0.1));
  assert.ok(
    new Set(pulseSamples.map((s) => s.name)).size >= 2,
    "Phrase transition did not occur while eye pulses ran",
  );
  await p.click("#testPulse");
  await p.click("#fullscreen");
  assert.ok(await p.evaluate(() => !!document.fullscreenElement));
  await p.evaluate(() => document.exitFullscreen());
  const popup = await Promise.all([
    p.waitForEvent("popup"),
    p.click("#projector"),
  ]).then(([x]) => x);
  await popup.bringToFront();
  await popup.waitForFunction(() => window.freakshowLive?.ready, null, {
    polling: 100,
    timeout: 180000,
  });
  await popup.waitForFunction(() => freakshowLive.ink.mode === "ink", null, {
    polling: 100,
  });
  await p.selectOption("#renderMode", "original");
  await popup.waitForFunction(
    () => freakshowLive.ink.mode === "original",
    null,
    { timeout: 20000, polling: 100 },
  );
  await p.selectOption("#renderMode", "ink");
  await popup.waitForFunction(() => freakshowLive.ink.mode === "ink", null, {
    timeout: 20000,
    polling: 100,
  });
  await popup.close();
  await p.click("#reset");
  const exact = await p.evaluate(() =>
    Array.from(
      freakshowLive.character.face.geometry.attributes.position.array,
    ).every((v, i) => v === freakshowLive.rig.rest[i]),
  );
  assert.ok(exact);
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/checks.json",
    JSON.stringify(
      { geometry, captures, small, large, pulseSamples, alias, exact, errors },
      null,
      2,
    ),
  );
  console.log(
    "Ink shaders, all expressions, dilation, shared geometry outlines, original toggle, BPM pulses, projector and fullscreen passed",
  );
  await context.close();
} finally {
  await b.close();
}
