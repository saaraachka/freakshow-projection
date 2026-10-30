import { chromium, webkit } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { localIntersections } from "./skin-local-intersections.js";
const fixture = new Float32Array([
    -1, 0, 0, 1, 0, 0, 0, 1, 0, 0, -0.5, -1, 0, -0.5, 1, 0, 0.8, 0,
  ]),
  fi = new Uint32Array([0, 1, 2, 3, 4, 5]),
  fw = new Float32Array(6).fill(1);
assert.equal(localIntersections(fixture, fi, fw).intersections, 1);
const apart = fixture.slice();
for (let i = 3; i < 6; i++) apart[i * 3 + 2] += 3;
assert.equal(localIntersections(apart, fi, fw).intersections, 0);
const flat = new Float32Array([
  -1, 0, 0, 1, 0, 0, 0, 1, 0, -0.2, 0.1, 0, 0.8, 0.1, 0, 0.2, 0.8, 0,
]);
assert.equal(localIntersections(flat, fi, fw).intersections, 1);
const dir = process.env.RIG_EVIDENCE || "artifacts/candidate-a-seal";
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
  const oldPage = await browser.newPage({
    viewport: { width: 1250, height: 1050 },
  });
  const shelfSource = await readFile(
    "development-history/candidate-a-shelf-local-source/rig.js.txt",
    "utf8",
  );
  await oldPage.route("**/rig.js?release=inner-seal-1", (r) =>
    r.fulfill({ body: shelfSource, contentType: "text/javascript" }),
  );
  await oldPage.goto("http://localhost:5192/public/candidate-a-rig/index.html");
  await oldPage.waitForFunction(() => window.candidateARig, null, {
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
  const sealChecks = await page.evaluate(async () => {
    const { localIntersections } = await import(
      "/tests/skin-local-intersections.js"
    );
    const T = await import("/public/character-3d/vendor/three.module.js"),
      a = candidateARig,
      faces = a.character.face.geometry,
      ray = new T.Raycaster(),
      camera = new T.PerspectiveCamera(37, 950 / 650, 0.01, 100);
    camera.position.set(0, 0.28, 5.3);
    camera.lookAt(0, 0.28, -0.1);
    camera.updateMatrixWorld(true);
    const states = [
      ["Neutral", a.presets.Neutral],
      ["Angry", a.presets.Angry],
      ["Frown", a.presets["Unhappy / creepy frown"]],
      ["grin", {}],
      ["Manic", a.presets["Manic laughter"]],
    ];
    for (const t of [0.25, 0.5, 0.75])
      states.push([
        "grin-frown " + t,
        Object.fromEntries(
          Object.entries(a.presets["Unhappy / creepy frown"]).map(([k, v]) => [
            k,
            v * t,
          ]),
        ),
      ]);
    states.push([
      "open frown",
      { ...a.presets["Unhappy / creepy frown"], jawOpen: 6 },
    ]);
    const rows = [];
    for (const [name, q] of states) {
      a.pose(q);
      a.character.root.updateMatrixWorld(true);
      const self = localIntersections(
        faces.attributes.position.array,
        faces.index.array,
        a.rig.coverage.weights,
      );
      let secondaryHits = 0;
      if (!q.jawOpen) {
        for (let y = 504; y <= 511; y++)
          for (let x = 437; x <= 491; x += 3) {
            ray.setFromCamera(
              new T.Vector2((x / 950) * 2 - 1, 1 - (y / 650) * 2),
              camera,
            );
            const hit = ray.intersectObjects(
              [a.character.face, ...a.character.teeth],
              false,
            )[0];
            if (hit && hit.object.name.startsWith("Lower_")) secondaryHits++;
          }
      }
      let intendedDentalHits = 0;
      for (let y = 460; y <= 540; y += 5)
        for (let x = 425; x <= 525; x += 10) {
          ray.setFromCamera(
            new T.Vector2((x / 950) * 2 - 1, 1 - (y / 650) * 2),
            camera,
          );
          const hit = ray.intersectObjects(
            [a.character.face, ...a.character.teeth],
            false,
          )[0];
          if (hit && /^(Upper_|Lower_)/.test(hit.object.name))
            intendedDentalHits++;
        }
      rows.push({
        name,
        self,
        secondaryHits,
        intendedDentalHits,
        coverage: a.rig.coverage.last,
      });
    }
    a.pose({});
    return { metadata: a.rig.coverage.metadata, rows };
  });
  await writeFile(
    `${dir}/seal-checks.json`,
    JSON.stringify(sealChecks, null, 2),
  );
  console.log("Seal checks", JSON.stringify(sealChecks));
  for (const row of sealChecks.rows) {
    assert.equal(row.self.intersections, 0, row.name + " self intersection");
    assert.equal(row.secondaryHits, 0, row.name + " secondary dental exposure");
  }
  for (const name of ["grin", "Manic", "open frown"])
    assert.ok(
      sealChecks.rows.find((r) => r.name === name).intendedDentalHits > 0,
      name + " teeth obstructed",
    );
  const profiles = {};
  for (const name of [
    "Default sinister grin",
    "Neutral",
    "Angry",
    "Unhappy / creepy frown",
  ]) {
    profiles[name] = {};
    for (const [label, target] of [
      ["before", oldPage],
      ["after", page],
    ]) {
      await target.evaluate(
        (n) => candidateARig.pose(candidateARig.presets[n]),
        name,
      );
      profiles[name][label] = await target.evaluate(() => {
        const a = candidateARig,
          P = a.rig.rest,
          Q = a.character.face.geometry.attributes.position.array;
        const nearest = (x, y, z) => {
          let best = 0,
            d = Infinity;
          for (let i = 0; i < P.length; i += 3) {
            const r =
              (P[i] - x) ** 2 + (P[i + 1] - y) ** 2 + (P[i + 2] - z) ** 2;
            if (r < d) {
              d = r;
              best = i;
            }
          }
          return best;
        };
        const lip = nearest(0, -0.65, 0.556),
          fold = nearest(0, -0.8, 0.425),
          chin = nearest(0, -0.97, 0.474);
        const cornerIndices = [-1, 1].map((s) =>
          nearest(
            s * 0.633,
            -0.49 + 0.23 * ((s * 0.633) / 0.65) ** 2 + 0.035 * s * 0.633,
            0.35,
          ),
        );
        return {
          corners: cornerIndices.map((k) => Array.from(Q.subarray(k, k + 3))),
          lowerLip: Array.from(Q.subarray(lip, lip + 3)),
          fold: Array.from(Q.subarray(fold, fold + 3)),
          chin: Array.from(Q.subarray(chin, chin + 3)),
          lipChinDepthStep: Q[lip + 2] - Q[chin + 2],
        };
      });
      for (const view of ["front", "three", "side"]) {
        await target.evaluate((v) => candidateARig.setView(v), view);
        await target.locator("#prototype").screenshot({
          path: `${dir}/${label}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${view}.png`,
        });
      }
    }
    if (name !== "Default sinister grin") {
      if (profiles[name].before.corners)
        assert.deepEqual(
          profiles[name].after.corners,
          profiles[name].before.corners,
          name + " commissures moved",
        );
      assert.ok(
        profiles[name].after.chin[2] <= profiles[name].before.chin[2] + 1e-7,
        name + " chin enlarged",
      );
    }
    assert.deepEqual(
      profiles[name].after.lowerLip,
      profiles[name].before.lowerLip,
      name + " outer crest changed",
    );
    assert.deepEqual(
      profiles[name].after.chin,
      profiles[name].before.chin,
      name + " chin changed",
    );
  }
  for (const name of ["Surprised", "Manic laughter"]) {
    await page.evaluate(
      (n) => candidateARig.pose(candidateARig.presets[n]),
      name,
    );
    for (const view of ["front", "three"]) {
      await page.evaluate((v) => candidateARig.setView(v), view);
      await page.locator("#prototype").screenshot({
        path: `${dir}/after-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${view}.png`,
      });
    }
  }
  await page.evaluate(() => {
    candidateARig.pose({});
    candidateARig.setView("front");
  });
  await oldPage.evaluate(() => {
    candidateARig.pose({});
    candidateARig.setView("front");
  });
  const grinEqual = (await page.locator("#prototype").screenshot()).equals(
    await oldPage.locator("#prototype").screenshot(),
  );
  assert.equal(grinEqual, true, "Approved grin changed");
  await writeFile(
    `${dir}/profile-comparison.json`,
    JSON.stringify({ grinPixelsExact: grinEqual, profiles }, null, 2),
  );
  for (const [label, target] of [
    ["before", oldPage],
    ["after", page],
  ]) {
    await target.locator("#clay").uncheck();
    await target.evaluate(async () => {
      const T = await import("/public/character-3d/vendor/three.module.js");
      candidateARig.pose(candidateARig.presets.Neutral);
      candidateARig.setView("front");
      candidateARig.character.root.traverse((o) => {
        if (!o.isMesh) return;
        let color = 0x999999;
        if (o.name.startsWith("Lower_")) color = 0xff6600;
        else if (o.name.startsWith("LowerScalloped")) color = 0x00aaff;
        else if (o.name.startsWith("Upper_")) color = 0xffff00;
        o.material = new T.MeshStandardMaterial({ color, roughness: 0.9 });
      });
      candidateARig.render();
    });
    await target
      .locator("#prototype")
      .screenshot({ path: `${dir}/${label}-diagnostic.png` });
    await target.locator("#clay").check();
  }
  await oldPage.close();
  const blendPairs = [
    ["Default sinister grin", "Unhappy / creepy frown"],
    ["Neutral", "Angry"],
    ["Angry", "Surprised"],
  ];
  for (let i = 0; i < blendPairs.length; i++) {
    await page.evaluate(([a, b]) => {
      const r = candidateARig,
        p = r.presets;
      r.pose(
        Object.fromEntries(
          Object.keys(r.controls).map((k) => [
            k,
            ((p[a][k] || 0) + (p[b][k] || 0)) / 2,
          ]),
        ),
      );
    }, blendPairs[i]);
    for (const view of ["front", "three"]) {
      await page.evaluate((v) => candidateARig.setView(v), view);
      await page
        .locator("#prototype")
        .screenshot({ path: `${dir}/blend-${i}-${view}.png` });
    }
  }
  for (const mood of [0, 0.25, 0.5, 0.75, 1]) {
    await page.evaluate(
      (t) => candidateARig.pose({ smileToFrown: t, jawOpen: 3 }),
      mood,
    );
    await page.evaluate(() => candidateARig.setView("front"));
    await page
      .locator("#prototype")
      .screenshot({ path: `${dir}/open-mood-${mood}.png` });
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
