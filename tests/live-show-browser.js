import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const base = process.env.SHOW_BASE || "http://localhost:5194/",
  dir = process.env.SHOW_EVIDENCE || "artifacts/live-show";
await mkdir(dir, { recursive: true });
const useWebkit = !!process.env.SHOW_WEBKIT;
const b = useWebkit
  ? await webkit.launch({
      executablePath: "/tmp/freakshow-webkit-run",
      ...(base.startsWith("https:")
        ? { proxy: { server: process.env.HTTPS_PROXY } }
        : {}),
    })
  : await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--enable-unsafe-swiftshader",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--use-file-for-fake-audio-capture=" +
          path.resolve("tests/fixtures/live-show.wav"),
      ],
    });
try {
  const context = await b.newContext({
      viewport: { width: 1100, height: 760 },
    }),
    p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("page error", e.message);
  });
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  if (useWebkit)
    await p.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const C = window.AudioContext || window.webkitAudioContext,
            c = new C(),
            d = c.createMediaStreamDestination(),
            o = c.createOscillator(),
            g = c.createGain();
          o.frequency.value = 75;
          o.connect(g).connect(d);
          o.start();
          for (let i = 0; i < 20; i++) {
            const t = c.currentTime + 0.5 + i * 0.4;
            g.gain.setValueAtTime(0, t - 0.01);
            g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          }
          await c.resume();
          window.syntheticInputContext = c;
          return d.stream;
        },
      });
    });
  await p.goto(new URL("public/live-show/index.html", base).href);
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  console.log("3D ready");
  await p.click("#reset");
  const rest = await p.evaluate(() => {
    const a = freakshowLive,
      P = a.character.face.geometry.attributes.position.array;
    return {
      vertices: P.length / 3,
      exact: Array.from(P).every((v, i) => v === a.rig.rest[i]),
    };
  });
  assert.equal(rest.vertices, 82720);
  assert.ok(rest.exact);
  await p.screenshot({ path: dir + "/ready.png" });
  await p.click("#hide");
  assert.equal(await p.locator("#controls").isVisible(), false);
  await p.screenshot({ path: dir + "/projection-grin.png" });
  await p.click("#reveal");
  for (const [kind] of Object.entries(
    (await import("../public/live-show/performance.js")).GESTURES,
  )) {
    await p.click(`[data-gesture="${kind}"]`);
    assert.ok(
      await p.evaluate(
        (k) => freakshowLive.controller.events.some((e) => e.kind === k),
        kind,
      ),
    );
  }
  console.log("manual checks complete");
  await p.click("#reactive");
  await p.click("#idle");
  await p.evaluate(() => (freakshowLive.controller.events = []));
  await p.click("#connect");
  await p.waitForFunction(
    () => window.freakshowLive.input.context?.state === "running",
    null,
    { timeout: 20000 },
  );
  await p.waitForTimeout(7700);
  const audio = await p.evaluate(() => ({
    events: freakshowLive.controller.events,
    deviceOptions: document.querySelector("#device").options.length,
    clock: !!freakshowLive.input.clockNode,
    level: document.querySelector("#level").value,
    maxLevel: freakshowLive.input.maxLevel,
    context: freakshowLive.input.context.state,
    detected: freakshowLive.input.detector.last,
  }));
  console.log("audio", JSON.stringify(audio));
  assert.ok(audio.deviceOptions >= 1);
  assert.equal(audio.context, "running");
  assert.ok(audio.maxLevel > 0.01, "Input level never rose");
  assert.ok(audio.clock || useWebkit);
  assert.ok(
    audio.events.some((e) => e.kind === "kick"),
    "No bass reaction",
  );
  if (!useWebkit) {
    for (const k of ["kick", "snare", "clap", "melody"])
      assert.ok(
        audio.events.some((e) => e.kind === k),
        "No " + k + " event from captured PCM",
      );
    assert.ok(audio.detected.hat > -100);
  }
  await p.screenshot({ path: dir + "/audio-live.png" });
  const popup = await Promise.all([
    p.waitForEvent("popup"),
    p.click("#projector"),
  ]).then(([x]) => x);
  await popup.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  await p.click('[data-preset="Angry"]');
  await popup.waitForFunction(
    () =>
      freakshowLive.pose.browAnger > 0.5 &&
      freakshowLive.pose.smileToFrown > 0.6,
    null,
    { timeout: 20000 },
  );
  await p.click("#reset");
  await popup.waitForFunction(
    () => Object.values(freakshowLive.pose).every((v) => v === 0),
    null,
    { timeout: 20000 },
  );
  await popup.waitForTimeout(600);
  await popup.screenshot({ path: dir + "/projector.png" });
  await popup.click("#reveal");
  await popup.click("#fullscreen");
  const fullscreen = await popup.evaluate(() => !!document.fullscreenElement);
  if (!useWebkit) assert.ok(fullscreen);
  if (fullscreen) await popup.evaluate(() => document.exitFullscreen());
  await popup.close();
  await p.bringToFront();
  await p.click("#disconnect");
  assert.equal(await p.evaluate(() => freakshowLive.input.stream), null);
  await p.click("#reset");
  const rapid = await p.evaluate(() => {
    const a = freakshowLive,
      t = performance.now() / 1000;
    for (let i = 0; i < 160; i++)
      a.controller.trigger(
        ["kick", "snare", "clap", "melody"][i % 4],
        t + i * 0.001,
        1,
      );
    const q = a.controller.sample(t + 0.17, false).pose;
    a.rig.set(q);
    let invalid = 0;
    for (const v of a.character.face.geometry.attributes.position.array)
      if (!Number.isFinite(v)) invalid++;
    return { q, invalid, voices: a.controller.voices.length };
  });
  assert.equal(rapid.invalid, 0);
  assert.ok(rapid.voices <= 24);
  assert.ok(rapid.q.jawOpen <= 6);
  await p.click("#reset");
  const exact = await p.evaluate(() => {
    const a = freakshowLive;
    return Array.from(
      a.character.face.geometry.attributes.position.array,
    ).every((v, i) => v === a.rig.rest[i]);
  });
  assert.ok(exact);
  // Deterministic matched visual/geometry batch uses real protected rig at peaks.
  const review = await p.evaluate(async () => {
    const { GESTURES } = await import("./performance.js?release=show-1");
    const a = freakshowLive,
      rows = [];
    for (const [k, g] of Object.entries(GESTURES)) {
      a.controller.reset();
      a.controller.trigger(k, 0);
      const q = a.controller.sample(g.attack + g.hold * 0.5, false).pose;
      rows.push({ name: k, q });
    }
    return [
      ...rows,
      ...Object.entries(a.presets).map(([name, q]) => ({ name, q })),
    ];
  });
  for (let i = 0; i < review.length; i++) {
    await p.evaluate(({ q }) => {
      const a = freakshowLive;
      a.controller.reset();
      a.controller.base = { ...a.controller.zero(), ...q };
      document.querySelector("#idle").checked = false;
    }, review[i]);
    await p.waitForTimeout(100);
    await p.click("#hide");
    await p.locator("#stage").screenshot({ path: `${dir}/pose-${i}.png` });
    await p.click("#reveal");
  }
  await p.click("#demo");
  await p.waitForTimeout(1200);
  assert.ok(await p.evaluate(() => freakshowLive.demo));
  await p.click("#reset");
  // Real rejection path: no input device required for manual gestures/rendering.
  await p.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Test denial", "NotAllowedError");
      },
    }),
  );
  await p.click("#connect");
  await p.waitForFunction(
    () => document.querySelector("#status").dataset.state === "error",
  );
  await p.click('[data-gesture="snare"]');
  assert.ok(
    await p.evaluate(
      () => freakshowLive.controller.events.at(-1).kind === "snare",
    ),
  );
  await p.screenshot({ path: dir + "/denied-manual.png" });
  // Main application integration and mode-leave cleanup.
  const root = await context.newPage();
  await root.goto(new URL("?mode=live", base).href);
  const frame = root.frameLocator("#candidate-live-show iframe");
  await frame
    .locator("#load")
    .filter({ hasText: "Candidate A ready" })
    .waitFor({ timeout: 180000 });
  assert.ok(
    await root
      .locator("body")
      .evaluate((e) => e.classList.contains("candidate-live")),
  );
  if (!useWebkit) {
    await frame.locator("#connect").click();
    await root
      .frames()
      .find((f) => f.url().includes("public/live-show/index.html"))
      .waitForFunction(
        () => window.freakshowLive?.input.context?.state === "running",
        null,
        { timeout: 20000 },
      );
  }
  await root.click('[data-mode="studio"]');
  if (!useWebkit)
    await root
      .frames()
      .find((f) => f.url().includes("public/live-show/index.html"))
      .waitForFunction(() => window.freakshowLive?.input.stream === null);
  assert.ok(await root.locator("#candidate-live-show").isHidden());
  await root.click('[data-mode="song"]');
  assert.ok(await root.locator("#audioFile").isVisible());
  await root.close();
  const geometryChecks = await p.evaluate(
    (rows) => {
      const a = freakshowLive,
        g = a.character.face.geometry,
        P = a.rig.rest,
        T = g.index.array,
        result = [];
      for (const row of rows) {
        a.rig.set(row.q);
        const Q = g.attributes.position.array;
        let reversed = 0,
          invalid = 0,
          minAreaRatio = 1;
        for (const v of Q) if (!Number.isFinite(v)) invalid++;
        for (let k = 0; k < T.length; k += 3) {
          const i = T[k] * 3,
            j = T[k + 1] * 3,
            l = T[k + 2] * 3;
          const cross = (A) => {
            const ux = A[j] - A[i],
              uy = A[j + 1] - A[i + 1],
              uz = A[j + 2] - A[i + 2],
              vx = A[l] - A[i],
              vy = A[l + 1] - A[i + 1],
              vz = A[l + 2] - A[i + 2];
            return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          };
          const u = cross(P),
            v = cross(Q),
            ratio =
              u.reduce((s, x, i) => s + x * v[i], 0) /
              (u.reduce((s, x) => s + x * x, 0) || 1);
          if (ratio <= 0) reversed++;
          minAreaRatio = Math.min(minAreaRatio, ratio);
        }
        result.push({ name: row.name, reversed, invalid, minAreaRatio });
      }
      a.rig.set({});
      return result;
    },
    [...review, { name: "rapid overlap", q: rapid.q }],
  );
  assert.ok(
    geometryChecks.every((c) => !c.reversed && !c.invalid),
    JSON.stringify(geometryChecks),
  );
  await writeFile(
    dir + "/checks.json",
    JSON.stringify(
      {
        browser: useWebkit
          ? "WebKit synthetic stream + rejection"
          : "Chromium captured WAV via real getUserMedia",
        rest,
        audio,
        fullscreen,
        rapid,
        geometryChecks,
        exact,
        review: review.map((r) => r.name),
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Live Show consolidated review passed");
  await context.close();
} finally {
  await b.close();
}
