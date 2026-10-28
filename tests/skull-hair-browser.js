import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL,
  port = process.env.FREAKSHOW_TEST_PORT || "5255",
  base = remote || `http://localhost:${port}/freakshow-projection/`;
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: { ...process.env, PORT: port, BASE_PATH: "/freakshow-projection/" },
      stdio: "pipe",
    });
const folder = "public/3d-character-viewer/review/skull-hair";
const views = {
  front: [0, 0, 1],
  "three-quarter": [0.75, 0.12, 1],
  profile: [1, 0, 0],
  back: [0, 0, -1],
  top: [0, 1, 0.04],
  "left-three-quarter": [-0.75, 0.12, 1],
  "left-profile": [-1, 0, 0],
};
const revision = "cranial-groom-5",
  baseline = "precision-correction-4";
async function load(p) {
  await p.goto(base + "public/3d-character-viewer/index.html?sculpt=5", {
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
    (rev) =>
      assetViewer.modelState.revision === rev &&
      document.querySelector("#scene").dataset.renderedRevision === rev &&
      !document.querySelector("#model-version").disabled,
    version === "refined" ? revision : baseline,
    { timeout: 90000 },
  );
}
async function signature(p, save = false) {
  return p.evaluate((save) => {
    const a = assetViewer,
      c = a.character,
      g = c.face.geometry;
    const hash = (array) => {
      let h = 2166136261;
      for (const v of array) h = Math.imul(h ^ Math.round(v * 1e7), 16777619);
      return h;
    };
    const meshes = [];
    c.root.traverse((o) => {
      if (o.isMesh && o !== c.face && !c.hair.children.includes(o)) {
        meshes.push({
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
          indices: hash(o.geometry.index?.array || []),
          color: o.material.color?.getHex(),
        });
      }
    });
    if (save)
      window.skullHairBaseline = {
        position: g.attributes.position.array.slice(),
        normal: g.attributes.normal.array.slice(),
        color: g.attributes.color.array.slice(),
        index: g.index.array.slice(),
      };
    let facialDifferences = 0,
      cranialChanges = 0,
      indexDifferences = 0;
    if (!save) {
      const old = window.skullHairBaseline,
        p = g.attributes.position.array,
        n = g.attributes.normal.array,
        cl = g.attributes.color.array;
      for (let i = 0; i < p.length; i += 3) {
        const protectedVertex =
          old.position[i + 1] <= 0.6 || old.position[i + 2] >= 0.12;
        const changed = [0, 1, 2].some((k) => p[i + k] !== old.position[i + k]);
        if (changed) cranialChanges++;
        if (
          protectedVertex &&
          [0, 1, 2].some(
            (k) =>
              p[i + k] !== old.position[i + k] ||
              n[i + k] !== old.normal[i + k] ||
              cl[i + k] !== old.color[i + k],
          )
        )
          facialDifferences++;
      }
      for (let i = 0; i < old.index.length; i++)
        indexDifferences += old.index[i] !== g.index.array[i];
    }
    return {
      meshes,
      facialDifferences,
      cranialChanges,
      indexDifferences,
      skinVertices: g.attributes.position.count,
      triangles: a.renderer.info.render.triangles,
      state: a.modelState,
    };
  }, save);
}
async function topology(p) {
  return p.evaluate(async () => {
    const a = assetViewer,
      c = a.character,
      g = c.hair.children[0].geometry,
      n = g.userData.coreVertices,
      ix = g.index.array,
      parent = Int32Array.from({ length: n }, (_, i) => i),
      find = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      },
      edges = new Map();
    for (let i = 0; i < g.userData.coreIndices; i += 3)
      for (let k = 0; k < 3; k++) {
        const x = ix[i + k],
          y = ix[i + ((k + 1) % 3)];
        parent[find(x)] = find(y);
        const key = x < y ? x * n + y : y * n + x;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    const { scalpHairField } = await import("./sculpt-hair.js?sculpt=5");
    let crownSamples = 0,
      uncovered = 0;
    const p = c.face.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      if (p.getY(i) > 0.83) {
        crownSamples++;
        if (scalpHairField(p.getX(i), p.getY(i), p.getZ(i)) > 0.005)
          uncovered++;
      }
    return {
      components: new Set(Array.from(parent, (_, i) => find(i))).size,
      nonManifoldEdges: [...edges.values()].filter((n) => n !== 2).length,
      crownSamples,
      uncovered,
      embeddedRoots: g.userData.embeddedRoots,
      finite: [
        ...g.attributes.position.array,
        ...g.attributes.normal.array,
      ].every(Number.isFinite),
      hairLocks: a.modelState.hairLocks,
      primaryMasses: a.modelState.primaryMasses,
    };
  });
}
async function shot(p, name) {
  const path = `${folder}/${name}.png`;
  await p.locator("#scene").screenshot({ path });
  await copyFile(path, "dist/" + path);
}
async function matrix(p, prefix) {
  await p.evaluate(() => {
    document.querySelector("header").style.visibility = "hidden";
    document.querySelector("#metrics").style.visibility = "hidden";
  });
  for (const mode of ["clay", "silhouette", "hair-silhouette"])
    for (const [name, dir] of Object.entries(views)) {
      await p.evaluate(
        ({ mode, dir }) => {
          const a = assetViewer;
          for (const o of a.character.root.children) o.visible = true;
          a.character.hair.visible = true;
          if (mode === "clay") a.setClay(true);
          else a.setSilhouette(true);
          if (mode === "hair-silhouette")
            for (const o of a.character.root.children)
              o.visible = o === a.character.hair;
          a.orbit.target.set(0, 0, 0);
          a.camera.position
            .set(...dir)
            .normalize()
            .multiplyScalar(6.4);
          a.orbit.update();
          a.renderer.render(a.scene, a.camera);
        },
        { mode, dir },
      );
      await p.waitForTimeout(70);
      await shot(p, `${prefix}-${mode}-${name}`);
    }
  for (const name of ["front", "profile", "back"]) {
    const dir = views[name];
    await p.evaluate((dir) => {
      const a = assetViewer;
      for (const o of a.character.root.children) o.visible = true;
      a.character.hair.visible = false;
      a.setClay(true);
      a.orbit.target.set(0, 0, 0);
      a.camera.position
        .set(...dir)
        .normalize()
        .multiplyScalar(6.4);
      a.orbit.update();
      a.renderer.render(a.scene, a.camera);
    }, dir);
    await shot(p, `${prefix}-skull-${name}`);
  }
  await p.evaluate(() => {
    for (const o of assetViewer.character.root.children) o.visible = true;
    assetViewer.character.hair.visible = true;
    assetViewer.setClay(true);
    document.querySelector("header").style.visibility = "";
    document.querySelector("#metrics").style.visibility = "";
  });
}
const runs = [];
try {
  if (server)
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error("Server exited " + code)));
    });
  await mkdir(folder, { recursive: true });
  await mkdir("dist/" + folder, { recursive: true });
  await mkdir("artifacts/skull-hair", { recursive: true });
  if (!remote) {
    const { sourceHash } = await import("../scripts/bake-character-sculpt.js");
    const m = JSON.parse(
      await readFile("public/3d-character-viewer/generated/manifest.json"),
    );
    assert.equal(m.sourceHash, await sourceHash());
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
      p.on("console", (m) => {
        if (m.type() === "error" && !m.location().url.endsWith("favicon.ico"))
          errors.push(m.text());
      });
      p.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          failed.push(r.url());
      });
      await load(p);
      await model(p, "approved");
      const before = await signature(p, true);
      assert.equal(before.state.revision, baseline);
      if (engine === "chromium" && !remote) await matrix(p, "before");
      const camera = await p.evaluate(() => ({
        position: assetViewer.camera.position.toArray(),
        target: assetViewer.orbit.target.toArray(),
      }));
      await model(p, "refined");
      assert.deepEqual(
        await p.evaluate(() => ({
          position: assetViewer.camera.position.toArray(),
          target: assetViewer.orbit.target.toArray(),
        })),
        camera,
      );
      const after = await signature(p);
      assert.equal(after.state.revision, revision);
      assert.equal(
        after.facialDifferences,
        0,
        "Every protected skin position, normal and color must be bitwise unchanged",
      );
      assert.equal(after.indexDifferences, 0);
      assert.equal(after.skinVertices, before.skinVertices);
      assert.deepEqual(
        after.meshes,
        before.meshes,
        "Eyes, nose material, teeth and all non-hair meshes/transforms must be unchanged",
      );
      assert.ok(after.cranialChanges > 100);
      assert.ok(
        after.triangles <= before.triangles,
        "Do not increase the mobile triangle budget",
      );
      assert.equal(after.state.cacheHash, after.state.hairCacheHash);
      assert.ok(after.state.cacheHash);
      const geo = await topology(p);
      assert.equal(geo.components, 1);
      assert.equal(geo.nonManifoldEdges, 0);
      assert.equal(geo.uncovered, 0);
      assert.ok(geo.crownSamples > 1000 && geo.finite);
      assert.ok(geo.embeddedRoots.every((d) => d < -0.015));
      assert.ok(geo.hairLocks < before.state.hairLocks / 2);
      console.log(
        engine,
        JSON.stringify({
          triangles: after.triangles,
          facialDifferences: after.facialDifferences,
          cranialChanges: after.cranialChanges,
          geometry: geo,
        }),
      );
      if (engine === "chromium" && !remote) await matrix(p, "after");
      await p.locator("#silhouette").check();
      assert.equal(
        await p.evaluate(
          () => assetViewer.scene.overrideMaterial.isMeshBasicMaterial,
        ),
        true,
      );
      await p.locator("#clay").check();
      assert.equal(await p.locator("#silhouette").isChecked(), false);
      await p.locator('[data-view="front"]').click();
      const box = await p.locator("#scene").boundingBox(),
        pos = await p.evaluate(() => assetViewer.camera.position.toArray());
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.67, box.y + box.height * 0.55, {
        steps: 8,
      });
      await p.mouse.up();
      await p.waitForTimeout(150);
      assert.notDeepEqual(
        await p.evaluate(() => assetViewer.camera.position.toArray()),
        pos,
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
      const phone = await browser.newContext({ ...devices["iPhone 13"] }),
        mobile = await phone.newPage();
      await load(mobile);
      await mobile.selectOption("#quality", "1");
      await mobile.locator('[data-view="back"]').tap();
      await mobile.locator("#silhouette").check();
      await model(mobile, "approved");
      await model(mobile, "refined");
      await mobile.locator("#clay").check();
      await mobile.locator("#clay").uncheck();
      await mobile.locator("#reset").tap();
      await mobile.waitForTimeout(200);
      const layout = await mobile.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        revision: assetViewer.modelState.revision,
        rendered: document.querySelector("#scene").dataset.renderedRevision,
        dpr: assetViewer.renderer.getPixelRatio(),
      }));
      assert.ok(layout.fits);
      assert.equal(layout.rendered, revision);
      assert.equal(layout.dpr, 1);
      const phonePath = remote
        ? `artifacts/skull-hair/deployed-${engine}-phone.png`
        : `${folder}/phone-${engine}.png`;
      await mobile.screenshot({ path: phonePath, fullPage: true });
      if (!remote) await copyFile(phonePath, "dist/" + phonePath);
      const gallery = await browser.newPage();
      await gallery.goto(
        base + "public/3d-character-viewer/review/index.html?sculpt=5",
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      const images = await gallery.evaluate(async () => {
        const list = [...document.images];
        for (const i of list) i.loading = "eager";
        await Promise.all(list.map((i) => i.decode()));
        return list.length;
      });
      assert.ok(images >= 48);
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
      runs.push({
        engine,
        revision,
        baseline,
        facialDifferences: 0,
        nonHairMeshesUnchanged: true,
        skinTopologyUnchanged: true,
        cranialChanges: after.cranialChanges,
        beforeTriangles: before.triangles,
        afterTriangles: after.triangles,
        geometry: geo,
        mobile: layout,
        images,
        consoleErrors: errors,
        failedAssets: failed,
        physicalIPhoneTested: false,
      });
      console.log(
        engine,
        "Matched clay, silhouette, hair-only silhouette, frozen anatomy, orbit/zoom and phone checks passed.",
      );
      await phone.close();
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
