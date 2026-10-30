import { chromium, webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = process.env.RIG_EVIDENCE || "artifacts/candidate-a-release";
await mkdir(dir, { recursive: true });
const live = process.env.RIG_URL;
const browser = process.env.RIG_WEBKIT
  ? await webkit.launch({
      executablePath: "/tmp/freakshow-webkit-run",
      ...(live ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    })
  : await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    });
try {
  const page = await browser.newPage({
      viewport: { width: 1250, height: 1050 },
    }),
    errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      failedRequests.push({ url: r.url(), status: r.status() });
  });
  await page.goto(
    live || "http://localhost:5192/public/candidate-a-rig/index.html",
  );
  await page.waitForFunction(() => window.candidateARig, null, {
    timeout: 180000,
  });
  const geometry = await page.evaluate(() => {
    const a = candidateARig,
      g = a.character.face.geometry,
      P = a.rig.rest,
      N = a.rig.restNormals,
      T = g.index.array,
      teeth = a.character.teeth.map((t) => ({
        name: t.name,
        p: t.position.toArray(),
        q: t.quaternion.toArray(),
      })),
      failures = [];
    let count = 0,
      minRatio = 1;
    const same = (a, b) =>
        a.length === b.length && a.every((v, i) => v === b[i]),
      restExact =
        same(P, g.attributes.position.array) &&
        same(N, g.attributes.normal.array),
      topology = Array.from(T);
    function inspect(name, q) {
      a.pose(q);
      count++;
      const Q = g.attributes.position.array;
      let invalid = 0,
        reversed = 0,
        min = 1;
      for (const v of Q) if (!Number.isFinite(v)) invalid++;
      for (let t = 0; t < T.length; t += 3) {
        const i = T[t] * 3,
          j = T[t + 1] * 3,
          k = T[t + 2] * 3,
          cross = (A) => {
            const ux = A[j] - A[i],
              uy = A[j + 1] - A[i + 1],
              uz = A[j + 2] - A[i + 2],
              vx = A[k] - A[i],
              vy = A[k + 1] - A[i + 1],
              vz = A[k + 2] - A[i + 2];
            return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          };
        const r = cross(P),
          s = cross(Q),
          ratio =
            (r[0] * s[0] + r[1] * s[1] + r[2] * s[2]) /
            (r[0] ** 2 + r[1] ** 2 + r[2] ** 2);
        min = Math.min(min, ratio);
        if (ratio <= 0) reversed++;
      }
      minRatio = Math.min(minRatio, min);
      if (invalid || reversed) failures.push({ name, invalid, reversed, min });
    }
    const presets = Object.entries(a.presets);
    for (const [n, q] of presets) inspect(n, q);
    for (let i = 0; i < presets.length; i++)
      for (let j = i + 1; j < presets.length; j++)
        for (const t of [0.25, 0.5, 0.75])
          inspect(
            `${presets[i][0]} / ${presets[j][0]} ${t}`,
            Object.fromEntries(
              Object.keys(a.controls).map((k) => [
                k,
                (presets[i][1][k] || 0) * (1 - t) + (presets[j][1][k] || 0) * t,
              ]),
            ),
          );
    for (const [n, q] of Object.entries(a.gestures))
      for (const t of [0.25, 0.5, 1])
        inspect(
          n + " " + t,
          Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v * t])),
        );
    for (const [k, c] of Object.entries(a.controls)) {
      inspect(k + " maximum", { [k]: c[2] });
      if (c[1] < 0) inspect(k + " minimum", { [k]: c[1] });
    }
    // Deterministic broad-range combinations exercise the shared-tissue budgets.
    let seed = 47;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 48; i++)
      inspect(
        "bounded combination " + i,
        Object.fromEntries(
          Object.entries(a.controls).map(([k, c]) => [
            k,
            c[1] + random() * (c[2] - c[1]),
          ]),
        ),
      );
    a.pose({});
    return {
      restExact,
      returned:
        same(P, g.attributes.position.array) &&
        same(N, g.attributes.normal.array),
      topologyUnchanged: same(topology, T),
      teethRestored:
        JSON.stringify(teeth) ===
        JSON.stringify(
          a.character.teeth.map((t) => ({
            name: t.name,
            p: t.position.toArray(),
            q: t.quaternion.toArray(),
          })),
        ),
      sampleCount: count,
      minSignedAreaRatio: minRatio,
      failures,
    };
  });
  await writeFile(`${dir}/geometry.json`, JSON.stringify(geometry, null, 2));
  console.log("Geometry", JSON.stringify(geometry));
  for (const name of await page.evaluate(() =>
    Object.keys(candidateARig.presets),
  )) {
    await page.evaluate(
      (n) => candidateARig.pose(candidateARig.presets[n]),
      name,
    );
    for (const view of ["front", "three", "side"]) {
      await page.evaluate((v) => candidateARig.setView(v), view);
      await page
        .locator("#prototype")
        .screenshot({
          path: `${dir}/${name.replaceAll(" ", "-").toLowerCase()}-${view}.png`,
        });
    }
  }
  await page.evaluate(() => {
    candidateARig.pose({});
    candidateARig.setView("front");
  });
  const before = await page.locator("#prototype").screenshot();
  const interruption = await page.evaluate(async () => {
    const a = candidateARig,
      wait = (t) => new Promise((r) => setTimeout(r, t));
    a.transition(a.presets.Angry, 0.4);
    await wait(120);
    const old = a.current;
    a.transition(a.presets.Surprised, 0.4);
    const continuous = JSON.stringify(old) === JSON.stringify(a.current);
    await wait(850);
    return { continuous, targetReached: !a.transitioning };
  });
  for (const name of ["kick", "snare", "clap", "hat"]) {
    await page.click(`[data-gesture="${name}"]`);
    await page.waitForFunction(() => !candidateARig.transitioning, null, {
      timeout: 10000,
    });
    assert.ok(
      await page.evaluate(() =>
        Object.values(candidateARig.current).every((v) => v === 0),
      ),
      name + " did not return to rest",
    );
  }
  await page.keyboard.press("1");
  await page.waitForFunction(() => !candidateARig.transitioning, null, {
    timeout: 10000,
  });
  await page.click("#cycle");
  await page.waitForTimeout(3500);
  const cycleRuns = await page.evaluate(
    () =>
      candidateARig.sequence === "slow" &&
      Object.values(candidateARig.current).some((v) => v !== 0),
  );
  await page.click("#rapid");
  await page.waitForTimeout(1800);
  const rapidRuns = await page.evaluate(
    () => candidateARig.sequence === "rapid",
  );
  await page.click("#rehearsal");
  await page.waitForTimeout(2200);
  const rehearsalRuns = await page.evaluate(
    () => candidateARig.sequence === "percussion",
  );
  await page.click("#rest");
  await page.waitForTimeout(100);
  const after = await page.locator("#prototype").screenshot();
  const performanceSample = await page.evaluate(() => {
    const s = candidateARig.frameCosts.slice().sort((a, b) => a - b);
    return {
      samples: s.length,
      medianMs: s[Math.floor(s.length * 0.5)],
      p95Ms: s[Math.floor(s.length * 0.95)],
      note: "Cloud software renderer; not an iPhone hardware benchmark.",
    };
  });
  const interaction = {
    ...interruption,
    cycleRuns,
    rapidRuns,
    rehearsalRuns,
    resetPixelsIdentical: before.equals(after),
    experimentalDisabled: await page
      .locator("#experimental button:disabled")
      .count(),
    performanceSample,
    errors,
    failedRequests,
  };
  await writeFile(
    `${dir}/interaction.json`,
    JSON.stringify(interaction, null, 2),
  );
  console.log("Interactions", JSON.stringify(interaction));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true });
  await page.click('[data-preset="Angry"]');
  await page.waitForTimeout(1100);
  assert.ok(await page.evaluate(() => candidateARig.current.browAnger > 0.5));
  assert.equal(geometry.restExact, true);
  assert.equal(geometry.returned, true);
  assert.equal(geometry.topologyUnchanged, true);
  assert.equal(geometry.teethRestored, true);
  assert.deepEqual(geometry.failures, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  for (const k of [
    "continuous",
    "targetReached",
    "cycleRuns",
    "rapidRuns",
    "rehearsalRuns",
    "resetPixelsIdentical",
  ])
    assert.equal(interaction[k], true, k);
  assert.equal(interaction.experimentalDisabled, 3);
} finally {
  await browser.close();
}
