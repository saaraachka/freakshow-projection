import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL,
  port = process.env.FREAKSHOW_TEST_PORT || "5260",
  base = remote || `http://localhost:${port}/freakshow-projection/`,
  folder = "public/3d-character-viewer/review/sculpt-cleanup",
  revision = "angry-fairing-9",
  baseline = "carved-curls-8";
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
  hairline: [[0, 0.05, 1], [0, 1.05, 0.35], 3],
  crown: [[0, 1, 0.08], [0, 1.0, -0.4], 3.2],
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
  await p.goto(base + "public/3d-character-viewer/index.html?sculpt=9", {
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
  for (const name of ["front", "right-profile"]) {
    await camera(p, views[name], "clay");
    await p.evaluate(() => {
      assetViewer.character.hair.visible = false;
      assetViewer.renderer.render(assetViewer.scene, assetViewer.camera);
    });
    await shot(p, `${prefix}-bare-skull-${name}`);
    await p.evaluate(() => {
      assetViewer.character.hair.visible = true;
    });
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
      skin = await import("./implicit-skin.js?sculpt=9"),
      old = await import("./baseline-3b89be9/implicit-skin.js?sculpt=6"),
      hair = await import("./sculpt-hair.js?sculpt=9"),
      cranium = await import("./cranial-refinement.js?sculpt=9"),
      oldCranium = await import(
        "./baseline-3b89be9/cranial-refinement.js?sculpt=6"
      );
    c.root.updateMatrixWorld(true);
    const hairGeometry = c.hair.children[0].geometry;
    const ix = hairGeometry.index.array,
      nv = hairGeometry.attributes.position.count,
      parent = Int32Array.from({ length: nv }, (_, i) => i),
      edges = new Map(),
      find = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
    for (let i = 0; i < ix.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const x = ix[i + k],
          y = ix[i + ((k + 1) % 3)];
        parent[find(x)] = find(y);
        const key = x < y ? x * nv + y : y * nv + x;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    const topology = {
      components: new Set(Array.from(parent, (_, i) => find(i))).size,
      nonManifoldEdges: [...edges.values()].filter((n) => n !== 2).length,
    };

    let crownSamples = 0,
      uncovered = 0;
    const pos = c.face.geometry.attributes.position,
      actualHairField = hair.createHairDefinition().field;
    for (let i = 0; i < pos.count; i++)
      if (pos.getY(i) > 1.22) {
        crownSamples++;
        if (actualHairField(pos.getX(i), pos.getY(i), pos.getZ(i)) > 0.005)
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
    const oldSkin = window.comparisonGeometry;
    const browFits = [-1, 1].map((side) => {
      const points = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i),
          z = pos.getZ(i),
          col = c.face.geometry.attributes.color;
        if (
          x * side > 0.17 &&
          x * side < 0.62 &&
          y > 0.3 &&
          y < 0.8 &&
          z > 0.3 &&
          col.getX(i) < 0.17 &&
          col.getZ(i) < 0.2
        )
          points.push([Math.abs(x), y]);
      }
      const mx = points.reduce((s, p) => s + p[0], 0) / points.length,
        my = points.reduce((s, p) => s + p[1], 0) / points.length;
      return {
        count: points.length,
        slope:
          points.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) /
          points.reduce((s, p) => s + (p[0] - mx) ** 2, 0),
      };
    });
    const bounds = measureCurrent(),
      skullRise = bounds.skinTop - oldSkin.measure.skinTop,
      hairlineRise = bounds.hairline - oldSkin.measure.hairline,
      frontalHairRise = bounds.frontHairLow - oldSkin.measure.frontHairLow,
      sideWidthRatio = bounds.hairWidth / oldSkin.measure.hairWidth,
      sideBulkRatio = bounds.side95 / oldSkin.measure.side95;
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
        "./baseline-3b89be9/sculpt-dentition.js?sculpt=7"
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
      hairTopology: topology,
      strandSweeps: hairGeometry.userData.strandSweeps,
      wireFlyaways: hairGeometry.userData.wireFlyaways,
      discarded: hairGeometry.userData.discardedUnrootedComponents,
      crownSamples,
      uncovered,
      eyes,
      unchangedOtherParts: partSignatures() === window.savedParts,
      skinFairing: c.face.geometry.userData.fairing,
      hairFairing: hairGeometry.userData.fairing,
      browFits,
      skullRise,
      hairlineRise,
      frontalHairRise,
      sideWidthRatio,
      sideBulkRatio,
      rearDepthRatio: bounds.backDepth / oldSkin.measure.backDepth,
      bounds,
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
  await mkdir("artifacts/sculpt-cleanup", { recursive: true });
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
      await p.selectOption("#model-version", "earlier");
      await p.waitForFunction(
        () =>
          assetViewer.modelState.revision === "clown-silhouette-7" &&
          !document.querySelector("#model-version").disabled,
        null,
        { timeout: 90000 },
      );
      await model(p, "approved");
      const before = await p.evaluate(() => assetViewer.modelState);
      assert.equal(before.revision, baseline);
      await p.evaluate(async () => {
        const { hairline } = await import(
          "./baseline-3b89be9/hair-support.js?sculpt=7"
        );
        window.measureCurrent = () => {
          const c = assetViewer.character,
            skin = c.face.geometry.attributes.position,
            hair = c.hair.children[0].geometry.attributes.position;
          let skinTop = -Infinity,
            minX = Infinity,
            maxX = -Infinity,
            backDepth = 0,
            hairTop = -Infinity,
            frontHairLow = Infinity;
          const sides = [];
          for (let i = 0; i < skin.count; i++)
            skinTop = Math.max(skinTop, skin.getY(i));
          for (let i = 0; i < hair.count; i++) {
            const x = hair.getX(i),
              y = hair.getY(i),
              z = hair.getZ(i);
            backDepth = Math.max(backDepth, -z);
            hairTop = Math.max(hairTop, y);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            if (Math.abs(x) < 0.55 && z > 0.35)
              frontHairLow = Math.min(frontHairLow, y);
            if (y > 0.15 && y < 1.2) sides.push(Math.abs(x));
          }
          sides.sort((a, b) => a - b);
          return {
            skinTop,
            backDepth,
            hairTop,
            hairWidth: maxX - minX,
            side95: sides[Math.floor(sides.length * 0.95)],
            frontHairLow,
            hairline: window.currentHairline(0, 0.5),
          };
        };
        window.partSignatures = () => {
          const c = assetViewer.character,
            parts = [];
          const hash = (array) => {
            let h = 2166136261;
            const bytes = new Uint8Array(
              array.buffer,
              array.byteOffset,
              array.byteLength,
            );
            for (const v of bytes) h = Math.imul(h ^ v, 16777619);
            return h;
          };
          c.root.traverse((o) => {
            if (o.isMesh && o !== c.face && !c.hair.children.includes(o))
              parts.push({
                name: o.name,
                position: o.position.toArray(),
                rotation: o.rotation.toArray(),
                scale: o.scale.toArray(),
                attributes: Object.fromEntries(
                  Object.entries(o.geometry.attributes).map(([k, v]) => [
                    k,
                    hash(v.array),
                  ]),
                ),
                indices: hash(o.geometry.index.array),
              });
          });
          return JSON.stringify(parts);
        };
        window.savedParts = partSignatures();
        window.currentHairline = hairline;
        const g = assetViewer.character.face.geometry;
        window.comparisonGeometry = {
          position: g.attributes.position.array.slice(),
          index: g.index.array.slice(),
          normal: g.attributes.normal.array.slice(),
          color: g.attributes.color.array.slice(),
          measure: measureCurrent(),
        };
      });
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
      await p.evaluate(async () => {
        window.currentHairline = (
          await import("./hair-support.js?sculpt=9")
        ).hairline;
      });
      const geo = await geometry(p);
      console.log(
        engine,
        JSON.stringify({
          ...geo,
          roots: { count: geo.roots.length, max: Math.max(...geo.roots) },
        }),
      );
      assert.equal(geo.uncovered, 0);
      assert.ok(geo.crownSamples > 1000);
      assert.ok(geo.finite);
      assert.equal(geo.hairTopology.components, 1);
      assert.equal(geo.hairTopology.nonManifoldEdges, 0);
      assert.equal(geo.strandSweeps, 0);
      assert.equal(geo.wireFlyaways, 0);
      assert.equal(geo.clumps, before.hairClumps);

      assert.ok(geo.skinFairing.maxDisplacement <= 0.00401);
      assert.ok(geo.hairFairing.maxDisplacement <= 0.01801);
      assert.ok(geo.hairFairing.maxDisplacement > 0.001);
      assert.ok(geo.browFits.every((b) => b.count > 20 && b.slope > 0.4));
      assert.ok(Math.abs(geo.browFits[0].slope - geo.browFits[1].slope) < 0.12);
      assert.ok(geo.unchangedOtherParts);
      assert.ok(Math.abs(geo.skullRise) < 0.001);
      assert.equal(geo.hairlineRise, 0);
      assert.ok(geo.frontalHairRise > -0.02);
      assert.ok(geo.sideWidthRatio > 0.985 && geo.sideWidthRatio < 1.015);
      assert.ok(geo.sideBulkRatio > 0.98 && geo.sideBulkRatio < 1.02);
      assert.ok(geo.rearDepthRatio > 0.985 && geo.rearDepthRatio < 1.015);
      assert.ok(
        geo.eyes.every((e) => e.visibleGlobe && e.maxRadiusError < 0.013),
      );
      assert.ok(geo.visibleEnamel > 100);
      assert.equal(geo.outsideCavity, 0);
      assert.ok(geo.crownsUnchanged);
      assert.ok(geo.roots.every((v) => v < -0.015));
      assert.ok(geo.zones.length >= 6);
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
        ? `artifacts/sculpt-cleanup/deployed-${engine}-phone.png`
        : `${folder}/phone-${engine}.png`;
      await phone.screenshot({ path: phonePath, fullPage: true });
      if (!remote) await copyFile(phonePath, "dist/" + phonePath);
      await context.close();
      const frozen = await browser.newPage();
      frozen.on("pageerror", (e) => errors.push("Frozen viewer: " + e.message));
      await frozen.goto(
        base + "public/3d-character-viewer/baseline-3b89be9/index.html",
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
        base + "public/3d-character-viewer/review/index.html?sculpt=9",
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      const imageCount = await gallery.evaluate(async () => {
        const images = [...document.images];
        for (const image of images) image.loading = "eager";
        await Promise.all(images.map((image) => image.decode()));
        return images.length;
      });
      assert.ok(imageCount >= 63);
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
