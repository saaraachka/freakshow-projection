import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base =
    process.env.SHOW_BASE || "http://localhost:5195/freakshow-projection/",
  wk = !!process.env.SHOW_WEBKIT;
const dir =
  process.env.SHOW_EVIDENCE ||
  "artifacts/beat-review-" + (wk ? "webkit" : "chromium");
await mkdir(dir, { recursive: true });
const browser = await (wk ? webkit : chromium).launch({
  executablePath: wk ? "/tmp/freakshow-webkit-run" : "/usr/bin/chromium",
  ...(base.startsWith("https:")
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
  ...(!wk ? { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] } : {}),
});
try {
  const p = await browser.newPage({ viewport: { width: 1100, height: 780 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  await p.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const c = new AudioContext(),
          o = c.createOscillator(),
          g = c.createGain(),
          d = c.createMediaStreamDestination();
        o.frequency.value = 75;
        g.gain.value = 0;
        o.connect(g).connect(d);
        o.start();
        for (let i = 0; i < 60; i++) {
          const t = c.currentTime + 0.4 + (i * 60) / 135;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.5, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        }
        await c.resume();
        window.audioTestContext = c;
        return d.stream;
      },
    }),
  );
  await p.goto(base + "public/live-show/index.html?beat-review");
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  console.log("BPM stage ready");
  const initial = await p.evaluate(() => {
    const c = freakshowLive.controller;
    return {
      bpm: c.beatClock.bpm,
      phrase: c.phraseBeats,
      transition: c.transitionBeats,
      automatic: c.automatic,
      mode: c.mode,
      hats: document.querySelector("#hats").checked,
    };
  });
  assert.deepEqual(initial, {
    bpm: 135,
    phrase: 2,
    transition: 1,
    automatic: true,
    mode: "beat",
    hats: false,
  });
  for (const bpm of [120, 130, 135, 140]) {
    await p.fill("#bpm", String(bpm));
    await p.locator("#bpm").dispatchEvent("change");
    assert.equal(
      await p.evaluate(() => freakshowLive.controller.beatClock.bpm),
      bpm,
    );
  }
  await p.fill("#bpm", "135");
  await p.locator("#bpm").dispatchEvent("change");
  await p.click("#resync");
  await p.click("#rehearsal");
  const performanceSamples = [];
  for (let i = 0; i < 18; i++) {
    await p.waitForTimeout(250);
    performanceSamples.push(
      await p.evaluate(() => {
        const c = freakshowLive.controller;
        return {
          name: c.currentExpression,
          beat: c.beatClock.at(performance.now() / 1000),
          events: c.events.length,
        };
      }),
    );
  }
  assert.ok(new Set(performanceSamples.map((s) => s.name)).size >= 2);
  assert.ok(new Set(performanceSamples.map((s) => s.name)).size <= 4);
  assert.ok(performanceSamples.at(-1).events >= 5);
  await p.screenshot({ path: dir + "/rehearsal.png" });
  await p.click("#rehearsal");
  console.log(
    "Phrase rehearsal stable",
    performanceSamples.map((s) => s.name),
  );
  await p.locator("summary").filter({ hasText: "Sequence options" }).click();
  assert.ok(await p.locator('#behavior option[value="legacy"]').isDisabled());
  await p.click('[data-preset="Angry"]');
  assert.equal(await p.isChecked("#automatic"), false);
  await p.click('[data-gesture="snare"]');
  assert.equal(
    await p.evaluate(() => freakshowLive.controller.currentExpression),
    "Angry",
  );
  const geometry = await p.evaluate(async () => {
    const a = freakshowLive,
      c = a.controller,
      g = a.character.face.geometry,
      P = a.rig.rest,
      T = g.index.array,
      rows = [];
    const { ACCENTS } = await import("./musical-performance.js?release=beat-4");
    const entries = Object.entries(a.presets);
    const poses = [
      ...entries,
      ...entries.flatMap(([name, q], i) =>
        entries
          .slice(i + 1)
          .map(([other, r]) => [
            name + " / " + other + " midpoint",
            Object.fromEntries(
              Object.keys({ ...q, ...r }).map((k) => [
                k,
                ((q[k] || 0) + (r[k] || 0)) * 0.5,
              ]),
            ),
          ]),
      ),
    ];
    for (const [name, pose] of poses)
      for (const kind of Object.keys(ACCENTS)) {
        c.reset();
        c.energy = 1;
        c.accentIntensity = 1;
        c.preset(pose, 0, 0.1);
        c.trigger(kind, 1, 1, { manual: true });
        const q = c.sample(1.06, false).pose;
        a.rig.set(q);
        const Q = g.attributes.position.array;
        let reversed = 0,
          invalid = 0,
          minRatio = 1;
        for (const v of Q) if (!Number.isFinite(v)) invalid++;
        for (let k = 0; k < T.length; k += 3) {
          const i = T[k] * 3,
            j = T[k + 1] * 3,
            l = T[k + 2] * 3;
          const cross = (A) => {
            const u = [A[j] - A[i], A[j + 1] - A[i + 1], A[j + 2] - A[i + 2]],
              v = [A[l] - A[i], A[l + 1] - A[i + 1], A[l + 2] - A[i + 2]];
            return [
              u[1] * v[2] - u[2] * v[1],
              u[2] * v[0] - u[0] * v[2],
              u[0] * v[1] - u[1] * v[0],
            ];
          };
          const u = cross(P),
            v = cross(Q),
            r =
              u.reduce((s, x, n) => s + x * v[n], 0) /
              (u.reduce((s, x) => s + x * x, 0) || 1);
          if (r <= 0) reversed++;
          minRatio = Math.min(minRatio, r);
        }
        rows.push({ name, kind, reversed, invalid, minRatio, q });
      }
    c.reset();
    return rows;
  });
  assert.ok(
    geometry.every((r) => !r.reversed && !r.invalid),
    JSON.stringify(geometry.filter((r) => r.reversed || r.invalid)),
  );
  for (const [i, row] of geometry
    .filter((r) => r.kind === "snare" && !r.name.includes("midpoint"))
    .entries()) {
    await p.evaluate((q) => {
      const c = freakshowLive.controller;
      c.reset();
      c.base = { ...c.zero(), ...q };
      document.querySelector("#idle").checked = false;
    }, row.q);
    await p.waitForTimeout(200);
    await p.click("#hide");
    await p.locator("#stage").screenshot({ path: dir + `/pose-${i}.png` });
    await p.click("#reveal");
  }
  await p.click("#reset");
  const rest = await p.evaluate(() =>
    Array.from(
      freakshowLive.character.face.geometry.attributes.position.array,
    ).every((v, i) => v === freakshowLive.rig.rest[i]),
  );
  assert.ok(rest);
  await p.click("#reactive");
  await p.click("#autoSync");
  await p.click("#connect");
  await p.waitForFunction(() => freakshowLive.input.maxLevel > 0.01, null, {
    timeout: 30000,
  });
  await p.waitForTimeout(6500);
  const audio = await p.evaluate(() => ({
    events: freakshowLive.controller.events.slice(-12),
    tracked: freakshowLive.controller.tracker.events.length,
    confidence: freakshowLive.controller.tracker.confidence,
    revision: freakshowLive.controller.beatClock.revision,
  }));
  assert.ok(audio.tracked >= 6);
  await p.click("#disconnect");
  await p.click("#connect");
  await p.waitForFunction(() => freakshowLive.input.maxLevel > 0.01, null, {
    timeout: 30000,
  });
  await p.click("#disconnect");
  await p.click("#fullscreen");
  assert.ok(await p.evaluate(() => !!document.fullscreenElement));
  await p.evaluate(() => document.exitFullscreen());
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/checks.json",
    JSON.stringify(
      {
        initial,
        performanceSamples,
        geometry,
        audio,
        rest,
        fullscreen: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Beat performance, comparison mode, preset/transition accent geometry combinations, audio/reconnect and fullscreen passed",
  );
} finally {
  await browser.close();
}
