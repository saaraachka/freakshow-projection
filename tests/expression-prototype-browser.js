// Control/continuity smoke test for the UNAPPROVED local prototype.
// This is deliberately not a visual acceptance or deployment gate.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:5173/public/3d-character-viewer/index.html");
  await p.waitForFunction(() => window.assetViewer?.modelState.loaded, null, {
    timeout: 180000,
  });
  assert.equal(
    await p.evaluate(() => assetViewer.modelState.revision),
    "angry-fairing-9",
  );
  await p.goto(
    "http://localhost:5173/public/3d-character-viewer/expression-lab/index.html?expressions=10",
  );
  await p.waitForFunction(() => window.assetViewer?.modelState.loaded, null, {
    timeout: 180000,
  });
  const checks = await p.evaluate(() => {
    const c = assetViewer.character,
      g = c.face.geometry,
      original = g.attributes.position.array.slice(),
      hair = c.hair.children[0].geometry.attributes.position.array.slice();
    const samples = [];
    for (const [anger, surprise] of [
      [0, 0],
      [0.25, 0],
      [0.5, 0],
      [0.75, 0],
      [1, 0],
      [0, 0.25],
      [0, 0.5],
      [0, 0.75],
      [0, 1],
      [0.5, 0.5],
    ]) {
      assetViewer.setExpression({ anger, surprise }, { immediate: true });
      samples.push({
        weights: c.expressions.state,
        influences: c.face.morphTargetInfluences.slice(),
        finite: g.morphAttributes.position.every((a) =>
          a.array.every(Number.isFinite),
        ),
      });
    }
    return {
      revision: c.state.revision,
      targets: g.morphAttributes.position.length,
      sharedVertexCount: g.morphAttributes.position.every(
        (a) => a.count === g.attributes.position.count,
      ),
      sourceUnchanged: g.attributes.position.array.every(
        (v, i) => v === original[i],
      ),
      hairUnchanged:
        c.hair.children[0].geometry.attributes.position.array.every(
          (v, i) => v === hair[i],
        ),
      samples,
      demo: [0, 6, 12, 18, 24].map((t) => c.expressions.sampleDemo(t)),
    };
  });
  assert.equal(checks.targets, 2);
  assert.ok(
    checks.sharedVertexCount && checks.sourceUnchanged && checks.hairUnchanged,
  );
  assert.ok(checks.samples.every((s) => s.finite));
  assert.deepEqual(
    checks.demo.map((s) => [s.neutral, s.anger, s.surprise]),
    [
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
  );
  await p.evaluate(() =>
    assetViewer.setExpression({ anger: 1, surprise: 0 }, { immediate: true }),
  );
  await p.click('[data-expression="neutral"]');
  await p.waitForTimeout(100);
  const easing = await p.evaluate(
    () => assetViewer.character.expressions.state,
  );
  assert.ok(easing.anger > 0 && easing.anger < 1);
  await p.click("#expression-demo");
  assert.equal(
    await p.evaluate(() => assetViewer.character.expressions.state.demo),
    true,
  );
  await p.click("#expression-stop");
  assert.equal(
    await p.evaluate(() => assetViewer.character.expressions.state.demo),
    false,
  );
  await p.goto(
    "http://localhost:5173/public/3d-character-viewer/review/expression-work-in-progress.html",
  );
  assert.match(
    await p.locator("h1").innerText(),
    /Continuous facial deformation/,
  );
  await p.evaluate(() =>
    Promise.all(
      [...document.images].map((i) => {
        i.loading = "eager";
        return i.decode();
      }),
    ),
  );
  assert.deepEqual(errors, []);
  const report = {
    ...checks,
    consoleErrors: errors,

    visualReviewRequired: true,
  };
  await writeFile(
    "artifacts/expressions/prototype-checks.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "Prototype controls/continuity smoke checks passed. Visual acceptance is recorded separately in the work-in-progress review.",
  );
} finally {
  await browser.close();
}
