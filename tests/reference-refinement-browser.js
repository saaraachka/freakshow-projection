import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL,
  port = process.env.FREAKSHOW_TEST_PORT || "5260",
  base = remote || `http://localhost:${port}/freakshow-projection/`,
  folder = "public/3d-character-viewer/review/reference-refinement",
  revision = "reference-refinement-6",
  baseline = "cranial-groom-5";
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: { ...process.env, PORT: port, BASE_PATH: "/freakshow-projection/" },
      stdio: "pipe",
    });
const views = {
  front: [[0, 0, 1], [0, 0, 0], 6.4],
  "left-three-quarter": [[-0.75, 0.12, 1], [0, 0, 0], 6.4],
  "right-three-quarter": [[0.75, 0.12, 1], [0, 0, 0], 6.4],
  "left-profile": [[-1, 0, 0], [0, 0, 0], 6.4],
  "right-profile": [[1, 0, 0], [0, 0, 0], 6.4],
  back: [[0, 0, -1], [0, 0, 0], 6.4],
  top: [[0, 1, 0.04], [0, 0, 0], 6.4],
  underside: [[0, -1, 0.12], [0, 0, 0], 6.4],
  hairline: [[0, 0.05, 1], [0, 0.8, 0.35], 3],
  crown: [[0, 1, 0.08], [0, 0.75, -0.4], 3.2],
  "back-hair": [[0.25, 0.1, -1], [0, 0.35, -1.1], 3.2],
  eyes: [[0, 0, 1], [0, 0.3, 0.2], 2.15],
  "eyes-three-quarter": [[0.6, 0.02, 1], [0, 0.3, 0.2], 2.2],
  "eyes-profile": [[1, 0, 0.1], [0.39, 0.3, 0.2], 1.7],
  ear: [[0.5, 0, 1], [0.99, 0.05, -0.1], 1.6],
  nose: [[0.2, 0.03, 1], [0, -0.03, 0.64], 1.9],
  lips: [[0, -0.08, 1], [0, -0.48, 0.3], 2.4],
  "mouth-three-quarter": [[0.65, 0, 1], [0, -0.48, 0.3], 2.5],
  "left-corner": [[-0.3, 0, 1], [-0.5, -0.3, 0.15], 1.5],
  "right-corner": [[0.3, 0, 1], [0.5, -0.3, 0.15], 1.5],
};
async function load(p) {
  await p.goto(base + "public/3d-character-viewer/index.html?sculpt=6", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await p.waitForFunction(() => window.assetViewer?.modelState.loaded, null, {
    timeout: 90000,
  });
  await p.evaluate(() => (assetViewer.orbit.enableDamping = false));
}
async function model(p, version) {
  await p.selectOption("#model-version", version);
  await p.waitForFunction(
    (r) =>
      assetViewer.modelState.revision === r &&
      document.querySelector("#scene").dataset.renderedRevision === r &&
      !document.querySelector("#model-version").disabled,
    version === "refined" ? revision : baseline,
    { timeout: 90000 },
  );
}
async function camera(p, v, mode) {
  await p.evaluate(
    ({ v, mode }) => {
      const a = assetViewer;
      mode === "silhouette"
        ? a.setSilhouette(true)
        : mode === "diagnostic"
          ? a.setDiagnostic(true)
          : a.setClay(true);
      a.orbit.minDistance = 0.5;
      a.orbit.target.set(...v[1]);
      a.camera.position
        .set(...v[0])
        .normalize()
        .multiplyScalar(v[2])
        .add(a.orbit.target);
      a.orbit.update();
      a.renderer.render(a.scene, a.camera);
    },
    { v, mode },
  );
  await p.waitForTimeout(90);
}
async function shot(p, name) {
  await p.locator("#scene").screenshot({ path: `${folder}/${name}.png` });
  await copyFile(`${folder}/${name}.png`, `dist/${folder}/${name}.png`);
}
async function matrix(p, prefix) {
  await p.evaluate(() => {
    document.querySelector("header").style.visibility = "hidden";
    document.querySelector("#metrics").style.visibility = "hidden";
  });
  for (const [name, v] of Object.entries(views)) {
    await camera(p, v, "clay");
    await shot(p, `${prefix}-${name}`);
  }
  for (const name of [
    "front",
    "right-three-quarter",
    "right-profile",
    "back",
    "top",
  ]) {
    await camera(p, views[name], "silhouette");
    await shot(p, `${prefix}-silhouette-${name}`);
  }
  for (const name of [
    "lips",
    "left-corner",
    "right-corner",
    "mouth-three-quarter",
  ]) {
    await camera(p, views[name], "diagnostic");
    await shot(p, `${prefix}-diagnostic-${name}`);
  }
  await p.evaluate(() => {
    assetViewer.setDiagnostic(false);
    assetViewer.setClay(true);
    document.querySelector("header").style.visibility = "";
    document.querySelector("#metrics").style.visibility = "";
  });
}
async function geometry(p) {
  return p.evaluate(async () => {
    const a = assetViewer,
      c = a.character,
      T = await import("../character-3d/vendor/three.module.js"),
      skin = await import("./implicit-skin.js?sculpt=6"),
      old = await import("./baseline-7e5a8e3/implicit-skin.js?sculpt=4"),
      hair = await import("./sculpt-hair.js?sculpt=6"),
      cranium = await import("./cranial-refinement.js?sculpt=6"),
      oldCranium = await import(
        "./baseline-7e5a8e3/cranial-refinement.js?sculpt=5"
      );
    c.root.updateMatrixWorld(true);
    const hairGeometry = c.hair.children[0].geometry;
    let crownSamples = 0,
      uncovered = 0;
    const pos = c.face.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++)
      if (pos.getY(i) > 0.83) {
        crownSamples++;
        if (hair.scalpHairField(pos.getX(i), pos.getY(i), pos.getZ(i)) > 0.005)
          uncovered++;
      }
    const eyes = c.eyes.map((g) => {
      let maxError = 0;
      for (let i = 0; i < g.geometry.attributes.position.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(
          g.geometry.attributes.position,
          i,
        );
        maxError = Math.max(maxError, Math.abs(v.length() - 0.205));
      }
      const center = g.position.clone();
      const ray = new T.Raycaster(
        center.clone().add(new T.Vector3(0.11, 0, 2)),
        new T.Vector3(0, 0, -1),
      );
      const hits = ray.intersectObjects([c.face, g]);
      return {
        name: g.name,
        vertices: g.geometry.attributes.position.count,
        maxRadiusError: maxError,
        visibleGlobe: hits[0]?.object === g,
      };
    });
    let cranialError = 0;
    for (let y = 0.6; y < 1.2; y += 0.1)
      for (let z = -1.3; z < 0; z += 0.1)
        cranialError = Math.max(
          cranialError,
          cranium
            .cranialPoint(0.2, y, z)
            .distanceTo(oldCranium.cranialPoint(0.2, y, z)),
        );
    // Regressions for visible cheek-piercing teeth. Root sections may be buried
    // in gingiva; evaluate exposed first-hit enamel from five viewing directions.
    let visibleEnamel = 0,
      outsideCavity = 0,
      worstCavity = -Infinity;
    const examples = [];
    for (const dir of [
      [0, 0, 1],
      [-0.65, 0, 1],
      [0.65, 0, 1],
      [-1, 0, 0.3],
      [1, 0, 0.3],
    ]) {
      const outward = new T.Vector3(...dir).normalize();
      for (let x = -0.65; x <= 0.65; x += 0.044)
        for (let y = -0.7; y <= -0.17; y += 0.044) {
          const target = new T.Vector3(x, y, 0.2),
            ray = new T.Raycaster(
              target.clone().addScaledVector(outward, 3),
              outward.clone().negate(),
            ),
            hit = ray.intersectObjects([c.face, ...c.teeth])[0];
          if (hit && c.teeth.includes(hit.object)) {
            visibleEnamel++;
            const f = skin.oralCavityField(...hit.point.toArray());
            worstCavity = Math.max(worstCavity, f);
            if (f > 0.015) {
              outsideCavity++;
              if (examples.length < 5)
                examples.push({
                  tooth: hit.object.name,
                  point: hit.point.toArray(),
                  distance: f,
                });
            }
          }
        }
    }
    const meshFinite = [];
    c.root.traverse((o) => {
      if (o.isMesh)
        meshFinite.push(
          [
            ...o.geometry.attributes.position.array,
            ...o.geometry.attributes.normal.array,
          ].every(Number.isFinite),
        );
    });
    // Dental crowns keep their identities and dimensions; only jaw placement changes.
    const previous = await import(
        "./baseline-7e5a8e3/sculpt-dentition.js?sculpt=4"
      ),
      oldTeeth = previous.createDentition().teeth;
    const crownsUnchanged = c.teeth.every(
      (t, i) =>
        t.name === oldTeeth[i].name &&
        t.geometry.attributes.position.array.every(
          (v, k) => v === oldTeeth[i].geometry.attributes.position.array[k],
        ),
    );
    return {
      crownSamples,
      uncovered,
      eyes,
      cranialError,
      visibleEnamel,
      outsideCavity,
      worstCavity,
      examples,
      crownsUnchanged,
      finite: meshFinite.every(Boolean),
      clumps: hairGeometry.userData.records.length,
      zones: hairGeometry.userData.growthZones,
      roots: hairGeometry.userData.embeddedRoots,
      triangles: a.renderer.info.render.triangles,
      skinVertices: pos.count,
      cacheHash: a.modelState.cacheHash,
      hairCacheHash: a.modelState.hairCacheHash,
    };
  });
}
const runs = [];
try {
  if (server)
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (c) => reject(new Error("Server exited " + c)));
    });
  await mkdir(folder, { recursive: true });
  await mkdir("dist/" + folder, { recursive: true });
  await mkdir("artifacts/reference-refinement", { recursive: true });
  if (!remote) {
    const { sourceHash } = await import("../scripts/bake-character-sculpt.js");
    assert.equal(
      JSON.parse(
        await readFile("public/3d-character-viewer/generated/manifest.json"),
      ).sourceHash,
      await sourceHash(),
    );
  }
  for (const engine of [
    "chromium",
    ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
  ]) {
    if (
      remote &&
      process.env.FREAKSHOW_REMOTE_WEBKIT_ONLY &&
      engine === "chromium"
    )
      continue;
    const browser = await (engine === "webkit" ? webkit : chromium).launch({
      executablePath:
        engine === "webkit"
          ? process.env.FREAKSHOW_WEBKIT_EXECUTABLE
          : "/usr/bin/chromium",
      args:
        engine === "chromium"
          ? ["--no-sandbox", "--enable-unsafe-swiftshader"]
          : [],
      proxy:
        remote && process.env.HTTPS_PROXY
          ? { server: process.env.HTTPS_PROXY }
          : undefined,
    });
    try {
      const p = await browser.newPage({
          viewport: { width: 1280, height: 1000 },
        }),
        errors = [],
        failed = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.location().url.endsWith("favicon.ico")
        )
          errors.push(message.text());
      });
      p.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          failed.push(r.url());
      });
      await load(p);
      await model(p, "approved");
      const before = await p.evaluate(() => assetViewer.modelState);
      assert.equal(before.revision, baseline);
      if (!remote && engine === "chromium") await matrix(p, "before");
      const cam = await p.evaluate(() => [
        assetViewer.camera.position.toArray(),
        assetViewer.orbit.target.toArray(),
      ]);
      await model(p, "refined");
      assert.deepEqual(
        await p.evaluate(() => [
          assetViewer.camera.position.toArray(),
          assetViewer.orbit.target.toArray(),
        ]),
        cam,
      );
      const state = await p.evaluate(() => assetViewer.modelState);
      assert.equal(state.revision, revision);
      assert.equal(state.cacheHash, state.hairCacheHash);
      if (!remote && engine === "chromium") await matrix(p, "after");
      const geo = await geometry(p);
      console.log(engine, JSON.stringify(geo));
      assert.equal(geo.uncovered, 0);
      assert.ok(geo.crownSamples > 1000);
      assert.ok(geo.finite);
      assert.equal(geo.cranialError, 0);
      assert.ok(
        geo.eyes.every((e) => e.visibleGlobe && e.maxRadiusError < 0.013),
      );
      assert.ok(geo.visibleEnamel > 100);
      assert.equal(geo.outsideCavity, 0);
      assert.ok(geo.crownsUnchanged);
      assert.ok(geo.roots.every((v) => v < -0.015));
      assert.equal(geo.zones.length, 6);
      assert.ok(geo.triangles < 420000);
      await p.locator('[data-view="front"]').click();
      const box = await p.locator("#scene").boundingBox(),
        position = await p.evaluate(() =>
          assetViewer.camera.position.toArray(),
        );
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.55, {
        steps: 8,
      });
      await p.mouse.up();
      await p.waitForTimeout(150);
      assert.notDeepEqual(
        await p.evaluate(() => assetViewer.camera.position.toArray()),
        position,
      );
      const dist = await p.evaluate(() =>
        assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
      );
      await p.mouse.wheel(0, -180);
      await p.waitForTimeout(150);
      assert.ok(
        (await p.evaluate(() =>
          assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
        )) < dist,
      );
      const context = await browser.newContext({ ...devices["iPhone 13"] }),
        phone = await context.newPage();
      await load(phone);
      await phone.selectOption("#quality", "1");
      await phone.locator("#silhouette").check();
      await model(phone, "approved");
      await model(phone, "refined");
      await phone.locator("#clay").check();
      assert.equal(await phone.locator("#silhouette").isChecked(), false);
      await phone.locator("#clay").uncheck();
      await phone.locator("#reset").tap();
      await phone.waitForTimeout(150);
      const mobile = await phone.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        rendered: document.querySelector("#scene").dataset.renderedRevision,
        dpr: assetViewer.renderer.getPixelRatio(),
      }));
      assert.ok(mobile.fits);
      assert.equal(mobile.rendered, revision);
      const phonePath = remote
        ? `artifacts/reference-refinement/deployed-${engine}-phone.png`
        : `${folder}/phone-${engine}.png`;
      await phone.screenshot({ path: phonePath, fullPage: true });
      if (!remote) await copyFile(phonePath, "dist/" + phonePath);
      await context.close();
      const frozen = await browser.newPage();
      frozen.on("pageerror", (e) => errors.push("Frozen viewer: " + e.message));
      await frozen.goto(
        base + "public/3d-character-viewer/baseline-7e5a8e3/index.html",
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      await frozen.waitForFunction(
        () => window.assetViewer?.modelState.loaded,
        null,
        { timeout: 90000 },
      );
      assert.equal(
        await frozen.evaluate(() => assetViewer.modelState.revision),
        baseline,
      );
      await frozen.close();
      const gallery = await browser.newPage();
      await gallery.goto(
        base + "public/3d-character-viewer/review/index.html?sculpt=6",
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      const imageCount = await gallery.evaluate(async () => {
        const images = [...document.images];
        for (const image of images) image.loading = "eager";
        await Promise.all(images.map((image) => image.decode()));
        return images.length;
      });
      assert.ok(imageCount >= 59);
      await gallery.close();
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
      runs.push({
        engine,
        baseline,
        revision,
        geometry: geo,
        mobile,
        consoleErrors: errors,
        failedAssets: failed,
        physicalIPhoneTested: false,
      });
      console.log(
        engine,
        "Matched clay, silhouette, anatomy, orbit/zoom, baseline switching and phone viewport checks passed.",
      );
    } finally {
      await browser.close();
    }
  }
  if (!remote)
    await writeFile(
      `${folder}/checks.json`,
      JSON.stringify({ revision, runs, physicalIPhoneTested: false }, null, 2) +
        "\n",
    );
} finally {
  server?.kill();
}
