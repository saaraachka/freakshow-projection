import { chromium, webkit, devices } from "playwright";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { auditSurface } from "./expression-geometry-audit.js";
const base =
    process.env.FREAKSHOW_EXPRESSION_URL ||
    "http://localhost:5173/public/3d-character-viewer/expression-lab/",
  folder = "public/3d-character-viewer/review/expressions-wip";
await mkdir(folder, { recursive: true });
await mkdir("artifacts/expressions/video", { recursive: true });
const views = { front: [0, 0, 1], three: [0.75, 0.12, 1], side: [1, 0, 0] };
const poses = {
  neutral: [0, 0],
  neutral_angry_50: [0.5, 0],
  angry: [1, 0],
  neutral_surprised_50: [0, 0.5],
  surprised: [0, 1],
  mixed: [0.5, 0.5],
};
const runs = [];
for (const engine of [
  "chromium",
  ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
]) {
  const browser = await (engine === "chromium" ? chromium : webkit).launch({
    executablePath:
      engine === "chromium"
        ? "/usr/bin/chromium"
        : process.env.FREAKSHOW_WEBKIT_EXECUTABLE,
    args:
      engine === "chromium"
        ? ["--no-sandbox", "--enable-unsafe-swiftshader"]
        : [],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        ...(engine === "chromium"
          ? {
              recordVideo: {
                dir: "artifacts/expressions/video",
                size: { width: 1280, height: 1000 },
              },
            }
          : {}),
      }),
      p = await context.newPage(),
      errors = [],
      failed = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" && !m.location().url.endsWith("favicon.ico"))
        errors.push(m.text());
    });
    p.on("response", (r) => {
      if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
        failed.push(r.url());
    });
    await p.goto(base + "index.html?architecture=11");
    await p.waitForFunction(() => window.assetViewer?.modelState.loaded, null, {
      timeout: 180000,
    });
    assert.equal(
      await p.evaluate(() => assetViewer.modelState.revision),
      "perioral-flow-11",
    );
    const preserved = await p.evaluate(async () => {
      const a = assetViewer,
        current = a.character,
        g = current.face.geometry;
      const source = {
        p: g.attributes.position.array.slice(),
        n: g.attributes.normal.array.slice(),
        c: g.attributes.color.array.slice(),
        i: g.index.array.slice(),
        h: current.hair.children[0].geometry.attributes.position.array.slice(),
        teeth: current.teeth.map((t) =>
          t.geometry.attributes.position.array.slice(),
        ),
      };
      await a.setModel("approved");
      const old = a.character,
        b = old.face.geometry;
      const same = (x, y) =>
        x.length === y.length && x.every((v, i) => v === y[i]);
      const result = {
        position: same(source.p, b.attributes.position.array),
        normal: same(source.n, b.attributes.normal.array),
        color: same(source.c, b.attributes.color.array),
        topology: same(source.i, b.index.array),
        hair: same(
          source.h,
          old.hair.children[0].geometry.attributes.position.array,
        ),
        teeth: source.teeth.every((v, i) =>
          same(v, old.teeth[i].geometry.attributes.position.array),
        ),
      };
      await a.setModel("refined");
      return result;
    });
    assert.ok(Object.values(preserved).every(Boolean));
    const raw = await p.evaluate(() => {
      const c = assetViewer.character,
        g = c.face.geometry;
      return {
        position: Array.from(g.attributes.position.array),
        targets: g.morphAttributes.position.map((a) => Array.from(a.array)),
        index: Array.from(g.index.array),
        eyes: c.eyes.map((e) => e.position.toArray()),
        reports: g.userData.perioralFlow,
        rims: g.userData.mouthRims,
        hash: g.userData.expressionCacheHash,
      };
    });
    const audit = [];
    if (engine === "chromium") {
      const samples = { angry: [0, 0], neutral: [1, 0], surprised: [0, 1] };
      for (const u of [0.25, 0.5, 0.75]) {
        samples["neutral_angry_" + u] = [1 - u, 0];
        samples["neutral_surprised_" + u] = [1 - u, u];
        samples["angry_surprised_" + u] = [0, u];
      }
      for (const [name, w] of Object.entries(samples)) {
        const positions = Float32Array.from(
            raw.position,
            (v, i) =>
              v +
              w[0] * (raw.targets[0][i] - v) +
              w[1] * (raw.targets[1][i] - v),
          ),
          result = auditSurface(positions, raw.index);
        audit.push({ name, ...result });
        console.log(engine, name, JSON.stringify(result));
        assert.equal(result.openOrNonManifoldEdges, 0);
        assert.equal(result.degenerateMouthTriangles, 0);
        assert.equal(result.mouthIntersections, 0);
        const upper = auditSurface(positions, raw.index, {
          minY: 0.09,
          maxY: 0.85,
          minZ: 0.05,
          maxX: 0.81,
        });
        assert.equal(
          upper.mouthIntersections,
          0,
          `Upper-face self-intersection at ${name}`,
        );
        audit.at(-1).upperFaceSelfIntersections = upper.mouthIntersections;
        let penetration = 0;
        for (const eye of raw.eyes)
          for (let i = 0; i < positions.length; i += 3) {
            const dx = positions[i] - eye[0],
              dy = positions[i + 1] - eye[1],
              dz = positions[i + 2] - eye[2],
              r = dx * dx + dy * dy;
            if (r >= 0.205 ** 2 || dz < 0.04) continue;
            const z =
              Math.sqrt(0.205 ** 2 - r) +
              0.012 * Math.exp(-1 * (Math.sqrt(r) / 0.085) ** 4);
            penetration = Math.max(penetration, z - dz);
          }
        audit.at(-1).maxEyePenetration = penetration;
        assert.ok(
          penetration <= 0.002,
          `Eye clearance at ${name}: ${penetration}`,
        );
      }
    }
    const set = async (w) => {
      await p.evaluate((w) => {
        assetViewer.setExpression(
          { anger: w[0], surprise: w[1] },
          { immediate: true },
        );
        assetViewer.renderer.render(assetViewer.scene, assetViewer.camera);
      }, w);
    };
    const camera = async (dir) => {
      await p.evaluate((dir) => {
        const a = assetViewer;
        a.orbit.enableDamping = false;
        a.orbit.target.set(0, 0, 0);
        a.camera.position
          .set(...dir)
          .normalize()
          .multiplyScalar(6.4);
        a.orbit.minDistance = 0.5;
        a.orbit.update();
        a.setClay(true);
        a.renderer.render(a.scene, a.camera);
      }, dir);
      await p.waitForTimeout(100);
    };
    if (engine === "chromium") {
      await p.evaluate(() => {
        document.querySelector("header").style.visibility = "hidden";
        document.querySelector("#metrics").style.visibility = "hidden";
      });
      for (const [name, w] of Object.entries(poses)) {
        await set(w);
        for (const [view, dir] of Object.entries(views)) {
          await camera(dir);
          await p
            .locator("#scene")
            .screenshot({ path: `${folder}/${name}-${view}.png` });
        }
      }
      for (const u of [0.25, 0.75]) {
        await set([0, u]);
        await camera(views.front);
        await p
          .locator("#scene")
          .screenshot({
            path: `${folder}/neutral_surprised_${Math.round(u * 100)}-front.png`,
          });
      }
      await set([0, 1]);
      await camera(views.three);
      await p.evaluate(() => assetViewer.setInfluence(true));
      await p
        .locator("#scene")
        .screenshot({ path: `${folder}/tissue-influence.png` });
      await p.evaluate(() => assetViewer.setInfluence(false));
    }
    // Verify smooth preset interruption, continuous reversal and no demo lead-in jump.
    await set([0, 1]);
    await p.click('[data-expression="neutral"]');
    await p.waitForTimeout(100);
    const eased = await p.evaluate(
      () => assetViewer.character.expressions.state,
    );
    assert.ok(eased.surprise > 0 && eased.surprise < 1);
    const demo = await p.evaluate(() => {
      const e = assetViewer.character.expressions;
      e.set({ anger: 1, surprise: 0 }, { immediate: true });
      const before = { ...e.state };
      const now = performance.now();
      e.playPrimary(now);
      e.update(0, now);
      const start = { ...e.state };
      e.stop();
      return {
        before,
        start,
        full: [0, 6, 12, 18, 24].map((t) => e.sampleDemo(t)),
        primary: [0, 6, 12].map((t) => e.samplePrimary(t)),
      };
    });
    assert.equal(demo.start.anger, demo.before.anger);
    assert.deepEqual(
      demo.full.map((s) => [s.neutral, s.anger, s.surprise]),
      [
        [1, 0, 0],
        [0, 1, 0],
        [1, 0, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
    );
    assert.deepEqual(
      demo.primary.map((s) => [s.neutral, s.anger, s.surprise]),
      [
        [1, 0, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
    );
    const dental = [];
    for (const [name, w] of Object.entries(poses)) {
      await set(w);
      dental.push(
        await p.evaluate(
          async ({ name, w }) => {
            const T = await import("../../character-3d/vendor/three.module.js"),
              c = assetViewer.character,
              g = c.face.geometry,
              n = 1 - w[0] - w[1],
              s = w[1],
              a = w[0];
            c.root.updateMatrixWorld(true);
            const p = g.attributes.position.array,
              p0 = g.morphAttributes.position[0].array,
              p1 = g.morphAttributes.position[1].array,
              data = Float32Array.from(
                p,
                (v, i) => v + n * (p0[i] - v) + s * (p1[i] - v),
              ),
              ix = [];
            for (let i = 0; i < g.index.count; i += 3) {
              const ids = [
                g.index.array[i],
                g.index.array[i + 1],
                g.index.array[i + 2],
              ];
              if (
                ids.some(
                  (j) =>
                    data[j * 3 + 1] < -0.1 &&
                    data[j * 3 + 1] > -1.3 &&
                    data[j * 3 + 2] > -0.35,
                )
              )
                ix.push(...ids);
            }
            const skin = new T.BufferGeometry();
            skin.setAttribute("position", new T.BufferAttribute(data, 3));
            skin.setIndex(ix);
            skin.computeBoundingSphere();
            const mesh = new T.Mesh(skin, c.face.material);
            const rims = g.userData.mouthRims,
              points = [];
            for (let j = 0; j < rims[0].length; j++)
              points.push(a * rims[0][j] + n * rims[1][j] + s * rims[2][j]);
            const count = points.length / 3,
              center = new T.Vector3();
            for (let j = 0; j < count; j++)
              center.add(new T.Vector3().fromArray(points, j * 3));
            center.divideScalar(count);
            center.z =
              Math.max(
                ...Array.from({ length: count }, (_, i) => points[i * 3 + 2]),
              ) + 0.025;
            points.push(...center.toArray());
            const diskIx = [];
            for (let j = 0; j < count; j++)
              diskIx.push(count, j, (j + 1) % count);
            const diskG = new T.BufferGeometry();
            diskG.setAttribute(
              "position",
              new T.Float32BufferAttribute(points, 3),
            );
            diskG.setIndex(diskIx);
            const disk = new T.Mesh(
              diskG,
              new T.MeshBasicMaterial({ side: T.DoubleSide }),
            );
            disk.updateMatrixWorld(true);
            mesh.updateMatrixWorld(true);
            let visible = 0,
              outside = 0;
            const examples = [];
            for (const dir of [
              [0, 0, 1],
              [-0.65, 0, 1],
              [0.65, 0, 1],
            ]) {
              const outward = new T.Vector3(...dir).normalize();
              for (let x = -0.64; x <= 0.64; x += 0.085)
                for (let y = -0.82; y <= -0.2; y += 0.065) {
                  const ray = new T.Raycaster(
                      new T.Vector3(x, y, 0.2).addScaledVector(outward, 3),
                      outward.clone().negate(),
                    ),
                    hit = ray.intersectObjects([mesh, ...c.teeth])[0];
                  if (hit && c.teeth.includes(hit.object)) {
                    visible++;
                    const aperture = ray.intersectObject(disk)[0];
                    if (!aperture || aperture.distance > hit.distance + 0.025) {
                      outside++;
                      if (examples.length < 5)
                        examples.push({
                          tooth: hit.object.name,
                          point: hit.point.toArray(),
                        });
                    }
                  }
                }
            }
            skin.dispose();
            diskG.dispose();
            disk.material.dispose();
            return { name, visible, outside, examples };
          },
          { name, w },
        ),
      );
      console.log(engine, "enamel", JSON.stringify(dental.at(-1)));
    }
    const approvedProbeMisses = dental.find((d) => d.name === "angry").outside;
    assert.ok(
      dental.every((d) => d.outside <= approvedProbeMisses),
      "New visible enamel escapes the aperture more often than the unchanged approved baseline",
    );
    assert.equal(dental.find((d) => d.name === "neutral").outside, 0);
    assert.equal(dental.find((d) => d.name === "surprised").outside, 0);
    const phoneContext = await browser.newContext({
        ...devices["iPhone 13"],
        deviceScaleFactor: 1,
      }),
      phone = await phoneContext.newPage();
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.goto(base + "index.html?architecture=11");
    await phone.waitForFunction(
      () => window.assetViewer?.modelState.loaded,
      null,
      { timeout: 180000 },
    );
    await phone.click('[data-expression="surprised"]');
    await phone.waitForTimeout(1500);
    assert.ok(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await phone.screenshot({
      path: `${folder}/phone-${engine}.png`,
      fullPage: true,
    });
    await phoneContext.close();
    if (engine === "chromium") {
      await camera(views.front);
      await set([0, 0]);
      await p.click("#expression-primary");
      await p.waitForTimeout(14000);
      assert.equal(
        await p.evaluate(() => assetViewer.character.expressions.state.demo),
        false,
      );
      const endpoint = await p.evaluate(
        () => assetViewer.character.expressions.state,
      );
      assert.ok(endpoint.neutral > 0.999);
      await p.click("#expression-demo");
      await p.waitForTimeout(26000);
      assert.equal(
        await p.evaluate(() => assetViewer.character.expressions.state.demo),
        false,
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    const video = p.video();
    await context.close();
    if (video && engine === "chromium")
      await copyFile(
        await video.path(),
        "artifacts/expressions/review-session.webm",
      );
    runs.push({
      engine,
      preserved,
      audit,
      dental,
      errors,
      failed,
      hash: raw.hash,
    });
  } finally {
    await browser.close();
  }
}
await writeFile(
  folder + "/checks.json",
  JSON.stringify(
    { runs, physicalIPhoneTested: false, visualReviewRequired: true },
    null,
    2,
  ) + "\n",
);
console.log(
  "Architecture checks finished. Visual review remains the release gate.",
);
