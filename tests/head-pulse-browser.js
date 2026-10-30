import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const wk = !!process.env.SHOW_WEBKIT,
  base = process.env.SHOW_BASE || "http://localhost:5195/freakshow-projection/",
  dir =
    process.env.SHOW_EVIDENCE ||
    "artifacts/head-pulse-" + (wk ? "webkit" : "chromium");
await mkdir(dir, { recursive: true });
const b = await (wk ? webkit : chromium).launch({
  executablePath: wk ? "/tmp/freakshow-webkit-run" : "/usr/bin/chromium",
  ...(base.startsWith("https:")
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
  ...(!wk ? { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] } : {}),
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await p.goto(base + "public/live-show/index.html?head-review");
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  console.log("Head pulse ready");
  assert.equal(await p.locator("#phraseBeats").count(), 0);
  assert.equal(await p.locator("#transitionBeats").count(), 0);
  assert.equal(await p.locator("#headPulseIntensity").inputValue(), ".04");
  const initial = await p.evaluate(() => {
    const a = freakshowLive;
    a.controller.phraseBeats = 16;
    a.controller.transitionBeats = 2;
    return {
      duration: a.controller.phraseBeats,
      transition: a.controller.transitionBeats,
      mode: a.ink.mode,
    };
  });
  assert.deepEqual(initial, { duration: 2, transition: 1, mode: "ink" });
  await p.selectOption("#pulseSource", "bpm");
  const tempos = [];
  for (const bpm of [120, 130, 135, 140]) {
    await p.fill("#bpm", String(bpm));
    await p.locator("#bpm").dispatchEvent("change");
    await p.click("#resync");
    const samples = [];
    for (let i = 0; i < 28; i++) {
      await p.waitForTimeout(65);
      samples.push(
        await p.evaluate(() => {
          const a = freakshowLive;
          return {
            scale: a.character.root.scale.toArray(),
            dilation: a.eyeDetails.dilation,
            expression: a.controller.currentExpression,
            beat: a.controller.beatClock.at(performance.now() / 1000),
            headTime: a.rhythm.head.state?.time,
            eyeTime: a.eyePulse.state?.time,
          };
        }),
      );
    }
    assert.ok(samples.some((s) => s.scale[0] > 1.02));
    assert.ok(samples.some((s) => s.scale[0] === 1));
    assert.ok(new Set(samples.map((s) => s.expression)).size >= 2);
    for (const s of samples) {
      assert.equal(s.scale[0], s.scale[1]);
      assert.equal(s.scale[1], s.scale[2]);
      assert.ok(s.scale[0] >= 1 && s.scale[0] <= 1.04000001);
      assert.equal(s.headTime, s.eyeTime);
      assert.ok(Math.abs((s.scale[0] - 1) / 0.04 - s.dilation / 0.8) < 1e-5);
    }
    tempos.push({ bpm, samples });
  }
  // Exact peaks and rest are inspected using a frozen shared envelope time. This
  // preserves the real renderer/root hierarchy and avoids screenshot latency.
  await p.click("#reset");
  const controls = await p.evaluate(() => {
    const a = freakshowLive;
    return {
      geometries: a.ink.records.every(
        (r) => r.mesh.geometry === r.outline.geometry,
      ),
      rest: Array.from(
        a.character.face.geometry.attributes.position.array,
      ).every((v, i) => v === a.rig.rest[i]),
    };
  });
  assert.ok(controls.geometries && controls.rest);
  await p.selectOption("#headPulseIntensity", ".04");
  await p.check("#pulseEnabled");
  await p.evaluate(() => {
    const a = freakshowLive;
    a.rhythm.head.sample = () => 1;
    a.eyePulse.sample = () => 0.8;
    document.querySelector("#idle").checked = false;
  });
  await p.waitForTimeout(150);
  await p.click("#hide");
  await p.locator("#stage").screenshot({ path: dir + "/peak.png" });
  await p.click("#reveal");
  assert.equal(
    await p.evaluate(() => freakshowLive.character.root.scale.x),
    1.04,
  );
  await p.evaluate(() => {
    freakshowLive.rhythm.head.sample = () => 0;
    freakshowLive.eyePulse.sample = () => 0;
  });
  await p.waitForTimeout(150);
  await p.click("#hide");
  await p.locator("#stage").screenshot({ path: dir + "/rest.png" });
  await p.click("#reveal");
  assert.equal(await p.evaluate(() => freakshowLive.character.root.scale.x), 1);
  for (const [value, expected] of [
    ["0", 1],
    [".02", 1.02],
    [".06", 1.06],
  ]) {
    await p.selectOption("#headPulseIntensity", value);
    await p.evaluate(() => (freakshowLive.rhythm.head.sample = () => 1));
    await p.waitForTimeout(100);
    assert.equal(
      await p.evaluate(() => freakshowLive.character.root.scale.x),
      expected,
    );
  }
  await p.click("#fullscreen");
  assert.ok(await p.evaluate(() => !!document.fullscreenElement));
  await p.evaluate(() => document.exitFullscreen());
  await p.click("#reset");
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/checks.json",
    JSON.stringify(
      { initial, tempos, controls, fullscreen: true, errors },
      null,
      2,
    ),
  );
  console.log(
    "Locked 2/1 beat timing, uniform 1.00–1.04 scaling, shared eye/head peaks at four tempos, all intensity settings and fullscreen passed",
  );
} finally {
  await b.close();
}
