import { webkit, devices } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const base = process.env.FREAKSHOW_EXPRESSION_URL;
if (!base)
  throw Error(
    "Set FREAKSHOW_EXPRESSION_URL to the deployed expression-lab directory URL",
  );
const manifest = JSON.parse(
  await readFile(
    "public/3d-character-viewer/expression-lab/expression-generated/manifest.json",
  ),
);
const browser = await webkit.launch({
  executablePath: process.env.FREAKSHOW_WEBKIT_EXECUTABLE,
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY }
    : undefined,
});
await mkdir("artifacts/expressions", { recursive: true });
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } }),
    errors = [],
    failed = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
      failed.push(r.url());
  });
  await p.goto(base + "index.html?architecture=11");
  await p.waitForFunction(() => window.assetViewer?.modelState.loaded, null, {
    timeout: 90000,
  });
  const state = await p.evaluate(() => ({
    revision: assetViewer.modelState.revision,
    hash: assetViewer.modelState.expressionCacheHash,
  }));
  assert.equal(state.revision, "perioral-flow-11");
  assert.equal(state.hash, manifest.sourceHash);
  for (const [name, w] of Object.entries({
    neutral: [0, 0],
    angry: [1, 0],
    surprised: [0, 1],
    mixed: [0.5, 0.5],
  })) {
    await p.evaluate((w) => {
      assetViewer.setExpression(
        { anger: w[0], surprise: w[1] },
        { immediate: true },
      );
      assetViewer.setClay(true);
    }, w);
    await p.waitForTimeout(100);
    await p
      .locator("#scene")
      .screenshot({ path: `artifacts/expressions/deployed-${name}.png` });
  }
  await p.selectOption("#model-version", "approved");
  await p.waitForFunction(
    () => assetViewer.modelState.revision === "angry-fairing-9",
  );
  await p.selectOption("#model-version", "refined");
  await p.waitForFunction(
    () => assetViewer.modelState.revision === "perioral-flow-11",
  );
  await p.click("#expression-primary");
  await p.waitForTimeout(7000);
  const mid = await p.evaluate(
    () => assetViewer.character.expressions.state.surprise,
  );
  assert.ok(mid > 0.8);
  await p
    .locator("#scene")
    .screenshot({ path: "artifacts/expressions/deployed-primary-mid.png" });
  await p.waitForTimeout(6800);
  assert.ok(
    await p.evaluate(
      () => assetViewer.character.expressions.state.neutral > 0.999,
    ),
  );
  const gallery = await browser.newPage();
  await gallery.goto(
    new URL("../review/expression-work-in-progress.html", base).href,
  );
  const images = await gallery.evaluate(async () => {
    for (const i of document.images) i.loading = "eager";
    await Promise.all([...document.images].map((i) => i.decode()));
    return document.images.length;
  });
  assert.ok(images >= 24);
  await gallery.locator("video").evaluate((v) => v.load());
  await gallery.waitForFunction(
    () => document.querySelector("video").readyState >= 1,
    null,
    { timeout: 30000 },
  );
  const phone = await browser.newPage({
    ...devices["iPhone 13"],
    deviceScaleFactor: 1,
  });
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base + "index.html?architecture=11");
  await phone.waitForFunction(
    () => window.assetViewer?.modelState.loaded,
    null,
    { timeout: 90000 },
  );
  await phone.click('[data-expression="surprised"]');
  await phone.waitForTimeout(1800);
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await phone.screenshot({
    path: "artifacts/expressions/deployed-phone.png",
    fullPage: true,
  });
  const approved = await browser.newPage();
  await approved.goto(new URL("../index.html", base).href);
  await approved.waitForFunction(
    () => window.assetViewer?.modelState.loaded,
    null,
    { timeout: 90000 },
  );
  assert.equal(
    await approved.evaluate(() => assetViewer.modelState.revision),
    "angry-fairing-9",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await writeFile(
    "artifacts/expressions/deployed-checks.json",
    JSON.stringify(
      {
        state,
        images,
        errors,
        failed,
        primaryDemo: true,
        approvedDefaultUnchanged: true,
        physicalIPhoneTested: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Deployed HTTPS expression viewer, primary rehearsal, comparison, review images/video, phone layout and approved default passed.",
  );
} finally {
  await browser.close();
}
