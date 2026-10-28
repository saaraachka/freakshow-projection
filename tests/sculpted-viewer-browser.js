import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL;
const testPort = process.env.FREAKSHOW_TEST_PORT || "5201";
const base = remote || `http://localhost:${testPort}/freakshow-projection/`;
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: {
        ...process.env,
        PORT: testPort,
        BASE_PATH: "/freakshow-projection/",
      },
      stdio: "pipe",
    });
const folder = "public/3d-character-viewer/review/sculpt";
const views = {
  front: [[0, 0, 1], [0, 0, 0], 1],
  "left-three-quarter": [[-0.75, 0.12, 1], [0, 0, 0], 1],
  "right-three-quarter": [[0.75, 0.12, 1], [0, 0, 0], 1],
  "left-profile": [[-1, 0, 0], [0, 0, 0], 1],
  "right-profile": [[1, 0, 0], [0, 0, 0], 1],
  "rear-three-quarter": [[0.8, 0.12, -1], [0, 0, 0], 1],
  "left-rear-three-quarter": [[-0.8, 0.12, -1], [0, 0, 0], 1],
  back: [[0, 0, -1], [0, 0, 0], 1],
  "bare-profile": [[1, 0, 0], [0, 0, 0], 1],
  "bare-rear-three-quarter": [[0.8, 0.12, -1], [0, 0, 0], 1],
  "bare-back": [[0, 0, -1], [0, 0, 0], 1],
  top: [[0, 1, 0.04], [0, 0, 0], 1],
  underside: [[0, -1, 0.12], [0, 0, 0], 1],
  eyes: [[0, 0.02, 1], [0, 0.31, 0.36], 0.34],
  "eyes-three-quarter": [[0.65, 0.03, 1], [0, 0.31, 0.26], 0.37],
  "eyes-side": [[1, 0, 0], [0, 0.31, 0.15], 0.37],
  "mouth-three-quarter": [[0.7, 0, 1], [0, -0.49, 0.3], 0.4],
  "mouth-side": [[1, 0, 0], [0, -0.49, 0.3], 0.4],
  "mouth-left-corner": [[-0.3, 0, 1], [-0.5, -0.3, 0.15], 0.22],
  "mouth-right-corner": [[0.3, 0, 1], [0.5, -0.3, 0.15], 0.22],
  nose: [[0.15, 0.03, 1], [0, -0.015, 0.64], 0.3],
  mouth: [[0, -0.08, 1], [0, -0.49, 0.34], 0.37],
  ear: [[0.5, 0.02, 1], [1, 0.035, -0.1], 0.25],
  hair: [[0.3, 0.16, 1], [0, 0.87, -0.1], 0.65],
};
async function load(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(
    () => window.assetViewer?.modelState.loaded,
    null,
    { timeout: 90000 },
  );
  await page.evaluate(() => (assetViewer.orbit.enableDamping = false));
}
async function capture(page, prefix = "") {
  await page.evaluate(() => {
    const a = assetViewer;
    a.scene.overrideMaterial = new a.character.face.material.constructor({
      color: 0xaaa59d,
      roughness: 0.9,
    });
    a.scene.traverse((o) => {
      if (o.isLight) {
        o.color.setHex(0xffffff);
        if (o.isHemisphereLight) o.groundColor.setHex(0x555555);
      }
    });
    document.querySelector("header").style.visibility = "hidden";
    document.querySelector("#metrics").style.visibility = "hidden";
  });
  for (const [name, [direction, target, scale]] of Object.entries(views)) {
    await page.evaluate(
      ({ direction, target, scale, name }) => {
        const a = assetViewer,
          aim = a.orbit.target;
        a.character.hair.visible = !name.startsWith("bare-");
        aim.set(...target);
        a.camera.position
          .set(...direction)
          .normalize()
          .multiplyScalar(6.4 * scale)
          .add(aim);
        a.orbit.update();
        a.renderer.render(a.scene, a.camera);
      },
      { direction, target, scale, name },
    );
    await page.waitForTimeout(80);
    if (!remote)
      await page
        .locator("#scene")
        .screenshot({ path: `${folder}/${prefix}${name}.png` });
  }
  await page.evaluate(async () => {
    assetViewer.scene.overrideMaterial = null;
    const { applyMouthDiagnostic } = await import(
      new URL(
        location.pathname.includes("baseline-6b838a5")
          ? "../mouth-diagnostic.js?sculpt=4"
          : "./mouth-diagnostic.js?sculpt=4",
        location.href,
      )
    );
    applyMouthDiagnostic(assetViewer.character);
  });
  for (const name of [
    "mouth",
    "mouth-left-corner",
    "mouth-right-corner",
    "mouth-three-quarter",
    "mouth-side",
  ]) {
    const [direction, target, scale] = views[name];
    await page.evaluate(
      ({ direction, target, scale }) => {
        const a = assetViewer;
        a.orbit.target.set(...target);
        a.camera.position
          .set(...direction)
          .normalize()
          .multiplyScalar(6.4 * scale)
          .add(a.orbit.target);
        a.orbit.update();
        a.renderer.render(a.scene, a.camera);
      },
      { direction, target, scale },
    );
    if (!remote)
      await page
        .locator("#scene")
        .screenshot({ path: `${folder}/${prefix}diagnostic-${name}.png` });
  }
  await page.evaluate(async () => {
    const { restoreMouthMaterials } = await import(
      new URL(
        location.pathname.includes("baseline-6b838a5")
          ? "../mouth-diagnostic.js?sculpt=4"
          : "./mouth-diagnostic.js?sculpt=4",
        location.href,
      )
    );
    restoreMouthMaterials(assetViewer.character);
    assetViewer.character.hair.visible = true;
    assetViewer.setClay(true);
  });
}
const runs = [];
if (!remote) {
  const { sourceHash } = await import("../scripts/bake-character-sculpt.js");
  const manifest = JSON.parse(
    await readFile(
      "public/3d-character-viewer/generated/manifest.json",
      "utf8",
    ),
  );
  assert.equal(
    manifest.sourceHash,
    await sourceHash(),
    "Baked geometry must match current procedural source",
  );
}
try {
  if (server)
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error("Test server exited before listening: " + code)),
      );
    });
  await mkdir(folder, { recursive: true });
  await mkdir("artifacts/sculpted-viewer", { recursive: true });
  for (const engine of [
    "chromium",
    ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
  ]) {
    // WebKit uses the system CA store. Chromium's isolated test profile may not
    // trust a cloud interception CA; never disable certificate verification.
    if (
      remote?.startsWith("https:") &&
      engine === "chromium" &&
      process.env.FREAKSHOW_REMOTE_WEBKIT_ONLY
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
        remote?.startsWith("https:") && process.env.HTTPS_PROXY
          ? { server: process.env.HTTPS_PROXY }
          : undefined,
    });
    try {
      const page = await browser.newPage({
          viewport: { width: 1280, height: 1000 },
        }),
        errors = [],
        assets = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.location().url.endsWith("favicon.ico"))
          errors.push(m.text());
      });
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          assets.push(r.url());
      });
      await load(page, base + "public/3d-character-viewer/index.html");
      const structure = await page.evaluate(() => {
        const a = assetViewer,
          g = a.character.face.geometry,
          p = g.attributes.position,
          ix = g.index.array;
        const parent = Int32Array.from({ length: p.count }, (_, i) => i),
          find = (i) => {
            while (parent[i] !== i) {
              parent[i] = parent[parent[i]];
              i = parent[i];
            }
            return i;
          };
        const edges = new Map();
        for (let i = 0; i < ix.length; i += 3)
          for (let k = 0; k < 3; k++) {
            const u = ix[i + k],
              v = ix[i + ((k + 1) % 3)];
            parent[find(u)] = find(v);
            const key = u < v ? `${u}:${v}` : `${v}:${u}`;
            edges.set(key, (edges.get(key) || 0) + 1);
          }
        const components = new Map();
        for (let i = 0; i < p.count; i++) {
          const k = find(i);
          components.set(k, (components.get(k) || 0) + 1);
        }
        let finite = true,
          attributesMatch = true;
        const names = [];
        a.model.traverse((o) => {
          if (o.isMesh) {
            names.push(o.name);
            for (const v of Object.values(o.geometry.attributes)) {
              finite &&= Array.from(v.array).every(Number.isFinite);
              attributesMatch &&=
                v.count === o.geometry.attributes.position.count;
            }
          }
        });
        // The geometry itself must contain asymmetry, not just a camera offset.
        let leftY = 0,
          rightY = 0,
          leftN = 0,
          rightN = 0;
        for (let i = 0; i < p.count; i++)
          if (p.getY(i) > 0.15 && p.getY(i) < 0.5 && p.getZ(i) > 0.3) {
            if (p.getX(i) < 0) {
              leftY += p.getY(i);
              leftN++;
            } else {
              rightY += p.getY(i);
              rightN++;
            }
          }
        return {
          revision: a.modelState.revision,
          staticSculpt: a.modelState.staticSculpt,
          cacheHash: a.modelState.cacheHash,
          hairCacheHash: a.modelState.hairCacheHash,
          components: [...components.values()].sort((a, b) => b - a),
          nonManifoldEdges: [...edges.values()].filter((n) => n !== 2).length,
          finite,
          attributesMatch,
          names,
          faceVertices: p.count,
          triangles: a.renderer.info.render.triangles,
          generationMs: a.modelState.generationMs,
          teeth: a.modelState.teeth,
          dentalClasses: [
            ...new Set(a.modelState.dentalClasses.map((d) => d.kind)),
          ],
          hairClumps: a.modelState.hairClumps,
          hairLocks: a.modelState.hairLocks,
          asymmetry: Math.abs(leftY / leftN - rightY / rightN),
          clay: !!a.scene.overrideMaterial,
          posteriorExtent: -g.boundingBox.min.z,
          eyeAspect: a.character.eyes.map(
            (e) =>
              Math.max(e.scale.x, e.scale.y, e.scale.z) /
              Math.min(e.scale.x, e.scale.y, e.scale.z),
          ),
        };
      });
      console.log(engine, "structure", JSON.stringify(structure));
      assert.equal(structure.revision, "precision-correction-4");
      assert.equal(structure.staticSculpt, true);
      assert.ok(
        structure.cacheHash?.length === 64 &&
          structure.cacheHash === structure.hairCacheHash,
        "Use the matching reproducible geometry cache",
      );
      assert.equal(
        structure.components.length,
        1,
        "Skin must be a single connected surface, including ears",
      );
      assert.equal(
        structure.nonManifoldEdges,
        0,
        "Skin must be closed and manifold",
      );
      assert.ok(structure.finite && structure.attributesMatch);
      assert.equal(structure.teeth, 28);
      assert.equal(structure.dentalClasses.length, 4);
      assert.ok(structure.asymmetry > 0.0001);
      assert.ok(
        structure.triangles < 400000,
        "Keep below the static sculpt mobile triangle budget",
      );
      assert.ok(structure.hairClumps === 23 && structure.hairLocks < 160);
      assert.equal(structure.clay, true);
      assert.deepEqual(structure.eyeAspect, [1, 1], "Globes must be spherical");
      assert.ok(
        !structure.names.some((n) =>
          /Torus|Tube|Pinna|LipMesh|LidMesh/.test(n),
        ),
      );
      assert.equal(await page.locator("#jaw,#expression").count(), 0);
      await page.locator('[data-view="rear-three-quarter"]').click();
      assert.ok(
        await page.evaluate(() => assetViewer.camera.position.z < 0),
        "Rear shortcut must show the rear",
      );
      const geometryChecks = await page.evaluate(async () => {
        const THREE = await import("three");
        const skin = await import("./implicit-skin.js?sculpt=4");
        const { scalpHairField } = await import("./sculpt-hair.js?sculpt=4");
        const c = assetViewer.character;
        c.root.updateMatrixWorld(true);
        let crownSamples = 0,
          uncoveredCrown = 0;
        const p = c.face.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          if (p.getY(i) > 0.83) {
            crownSamples++;
            if (scalpHairField(p.getX(i), p.getY(i), p.getZ(i)) > 0.005)
              uncoveredCrown++;
          }
        const toothChecks = [];
        for (const tooth of c.teeth) {
          const p = tooth.geometry.attributes.position,
            ix = tooth.geometry.index.array;
          let exposed = 0,
            samples = 0,
            bodyOutsideCavity = 0;
          const test = (v) => {
            const body = v.y < -0.025;
            v.applyMatrix4(tooth.matrixWorld);
            samples++;
            if (body && skin.oralCavityField(v.x, v.y, v.z) > 0.002)
              bodyOutsideCavity++;
            if (
              skin.anatomyField(v.x, v.y, v.z) > 0.002 &&
              skin.oralCavityField(v.x, v.y, v.z) > 0.002
            )
              exposed++;
          };
          for (let i = 0; i < p.count; i++)
            test(new THREE.Vector3().fromBufferAttribute(p, i));
          for (let i = 0; i < ix.length; i += 3) {
            const v = new THREE.Vector3();
            for (let k = 0; k < 3; k++)
              v.addScaledVector(
                new THREE.Vector3().fromBufferAttribute(p, ix[i + k]),
                1 / 3,
              );
            test(v);
          }
          toothChecks.push({
            name: tooth.name,
            samples,
            exposed,
            bodyOutsideCavity,
          });
        }
        const eyes = c.eyes.map((e) => {
          const p = e.geometry.attributes.position;
          let min = Infinity,
            max = 0;
          for (let i = 0; i < p.count; i++) {
            const r = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
            min = Math.min(min, r);
            max = Math.max(max, r);
          }
          return {
            minRadius: min,
            maxRadius: max,
            clipping: e.material.clippingPlanes,
            nominal: e.userData.nominalRadius,
          };
        });
        const hg = c.hair.children[0].geometry,
          n = hg.userData.coreVertices,
          hi = hg.index.array;
        const parent = Int32Array.from({ length: n }, (_, i) => i),
          find = (i) => {
            while (parent[i] !== i) {
              parent[i] = parent[parent[i]];
              i = parent[i];
            }
            return i;
          },
          edges = new Map();
        for (let i = 0; i < hg.userData.coreIndices; i += 3)
          for (let k = 0; k < 3; k++) {
            const a = hi[i + k],
              b = hi[i + ((k + 1) % 3)];
            parent[find(a)] = find(b);
            const key = a < b ? a * n + b : b * n + a;
            edges.set(key, (edges.get(key) || 0) + 1);
          }
        const hairCore = {
          components: new Set(Array.from(parent, (_, i) => find(i))).size,
          nonManifoldEdges: [...edges.values()].filter((n) => n !== 2).length,
          embeddedFlyaways: hg.userData.flyawayRoots.every(
            (p) => scalpHairField(...p) < -0.02,
          ),
        };
        const ray = new THREE.Raycaster(),
          hits = [];
        for (const eye of c.eyes)
          for (const offset of [-0.09, 0, 0.09]) {
            ray.set(
              new THREE.Vector3(eye.position.x + offset, eye.position.y, 2),
              new THREE.Vector3(0, 0, -1),
            );
            const first = ray.intersectObjects([c.face, ...c.eyes], false)[0];
            hits.push(first?.object === eye);
          }
        return {
          crownSamples,
          hairCore,
          uncoveredCrown,
          toothChecks,
          eyes,
          visibleEyeRays: hits,
        };
      });
      assert.equal(
        geometryChecks.uncoveredCrown,
        0,
        "No crown samples may project outside the solid hair foundation",
      );
      assert.ok(geometryChecks.crownSamples > 1000);
      assert.deepEqual(geometryChecks.hairCore, {
        components: 1,
        nonManifoldEdges: 0,
        embeddedFlyaways: true,
      });
      assert.ok(
        geometryChecks.toothChecks.every(
          (t) => t.exposed === 0 && t.bodyOutsideCavity === 0,
        ),
        "Enamel must not escape the face, and crown bodies must stay in the oral cavity",
      );
      assert.ok(
        geometryChecks.eyes.every(
          (e) =>
            e.minRadius > 0.2049 && e.maxRadius < 0.218 && e.clipping === null,
        ),
      );
      assert.ok(
        geometryChecks.visibleEyeRays.every(Boolean),
        "Both globes must be visible across the aperture",
      );
      console.log(engine, "precision geometry", JSON.stringify(geometryChecks));
      if (engine === "chromium" && !remote) await capture(page);
      await page.locator("#diagnostic").check();
      assert.equal(
        await page.evaluate(() => assetViewer.scene.overrideMaterial === null),
        true,
      );
      assert.equal(await page.locator("#diagnostic-key").isVisible(), true);
      await page.locator("#diagnostic").uncheck();
      await page.locator("#clay").check();
      // Controls change the actual rendered scene and work independently of capture.
      await page.locator("#clay").uncheck();
      assert.equal(
        await page.evaluate(() => assetViewer.scene.overrideMaterial === null),
        true,
      );
      await page.locator('[data-view="front"]').click();
      await page.waitForTimeout(120);
      if (!remote)
        await page
          .locator("#scene")
          .screenshot({ path: `${folder}/color.png` });
      await page.locator("#clay").check();
      await page.locator("#hair").uncheck();
      assert.equal(
        await page.evaluate(() => assetViewer.character.hair.visible),
        false,
      );
      if (!remote)
        await page
          .locator("#scene")
          .screenshot({ path: `${folder}/bare-skin.png` });
      await page.locator("#hair").check();
      const canvas = page.locator("#scene");
      await canvas.scrollIntoViewIfNeeded();
      const rect = await canvas.boundingBox(),
        before = await page.evaluate(() =>
          assetViewer.camera.position.toArray(),
        );
      await page.mouse.move(
        rect.x + rect.width * 0.55,
        rect.y + rect.height * 0.5,
      );
      await page.mouse.down();
      await page.mouse.move(
        rect.x + rect.width * 0.7,
        rect.y + rect.height * 0.56,
        { steps: 10 },
      );
      await page.mouse.up();
      await page.waitForTimeout(200);
      assert.notDeepEqual(
        await page.evaluate(() => assetViewer.camera.position.toArray()),
        before,
        "Orbit drag changes the view",
      );
      const distance = await page.evaluate(() =>
        assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
      );
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(200);
      assert.ok(
        (await page.evaluate(() =>
          assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
        )) < distance,
        "Wheel zoom changes distance",
      );
      const compareCamera = await page.evaluate(() => ({
        position: assetViewer.camera.position.toArray(),
        target: assetViewer.orbit.target.toArray(),
      }));
      await page.selectOption("#model-version", "approved");
      await page.waitForFunction(
        () =>
          assetViewer.modelState.revision === "anatomical-refinement-3" &&
          document.querySelector("#scene").dataset.renderedRevision ===
            "anatomical-refinement-3" &&
          !document.querySelector("#model-version").disabled,
        null,
        { timeout: 90000 },
      );
      assert.deepEqual(
        await page.evaluate(() => ({
          position: assetViewer.camera.position.toArray(),
          target: assetViewer.orbit.target.toArray(),
        })),
        compareCamera,
        "Comparison must keep the viewing angle and zoom",
      );
      await page.selectOption("#model-version", "refined");
      await page.waitForFunction(
        () =>
          assetViewer.modelState.revision === "precision-correction-4" &&
          document.querySelector("#scene").dataset.renderedRevision ===
            "precision-correction-4" &&
          !document.querySelector("#model-version").disabled,
      );
      const old = await browser.newPage({
        viewport: { width: 1280, height: 1000 },
      });
      await load(
        old,
        base + "public/3d-character-viewer/baseline-6b838a5/index.html",
      );
      const signature = () => {
        const a = assetViewer,
          g = a.character.face.geometry,
          p = g.attributes.position;
        const crowns = a.character.teeth.map((t) => {
          let hash = 2166136261;
          for (const v of t.geometry.attributes.position.array) {
            hash = Math.imul(hash ^ Math.round(v * 1e7), 16777619);
          }
          return {
            name: t.name,
            hash,
          };
        });
        const cheeks = [-1, 1].map((s) => {
          let z = -Infinity;
          for (let i = 0; i < p.count; i++)
            if (
              s * p.getX(i) > 0.55 &&
              s * p.getX(i) < 0.72 &&
              p.getY(i) > -0.1 &&
              p.getY(i) < 0.03
            )
              z = Math.max(z, p.getZ(i));
          return z;
        });
        return {
          revision: a.modelState.revision,
          depth: -g.boundingBox.min.z,
          crowns,
          cheeks,
        };
      };
      const approved = await old.evaluate(signature),
        refined = await page.evaluate(signature);
      assert.equal(approved.revision, "anatomical-refinement-3");
      assert.deepEqual(
        refined.crowns,
        approved.crowns,
        "Preserved crown geometry must remain unchanged; arch positioning is corrected",
      );
      assert.ok(
        Math.abs(refined.depth - approved.depth) < 0.001,
        "Approved cranial depth must be unchanged",
      );
      assert.ok(
        refined.cheeks.every((z, i) => Math.abs(z - approved.cheeks[i]) < 0.02),
        "Approved cheek projection must remain stable",
      );
      if (engine === "chromium" && !remote) await capture(old, "before-");
      await old.close();
      const phone = await browser.newContext({ ...devices["iPhone 13"] });
      const mobile = await phone.newPage();
      await load(mobile, base + "public/3d-character-viewer/index.html");
      await mobile.selectOption("#quality", "1");
      const layout = await mobile.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        dpr: assetViewer.renderer.getPixelRatio(),
        triangles: assetViewer.renderer.info.render.triangles,
        webgl2:
          assetViewer.renderer.getContext() instanceof WebGL2RenderingContext,
      }));
      assert.ok(layout.fits && layout.webgl2);
      await mobile.locator('[data-view="left-side"]').tap();
      await mobile.locator("#clay").uncheck();
      await mobile.locator("#reset").tap();
      await mobile.locator("#scene").scrollIntoViewIfNeeded();
      await mobile.waitForTimeout(200);
      if (engine === "webkit") {
        await mobile.selectOption("#model-version", "approved");
        await mobile.waitForFunction(
          () =>
            assetViewer.modelState.revision === "anatomical-refinement-3" &&
            document.querySelector("#scene").dataset.renderedRevision ===
              "anatomical-refinement-3" &&
            !document.querySelector("#model-version").disabled,
          null,
          { timeout: 90000 },
        );
        await mobile.selectOption("#model-version", "refined");
        await mobile.waitForFunction(
          () =>
            assetViewer.modelState.revision === "precision-correction-4" &&
            document.querySelector("#scene").dataset.renderedRevision ===
              "precision-correction-4",
        );
      }
      await mobile.waitForFunction(
        () =>
          document.querySelector("#scene").dataset.renderedRevision ===
          assetViewer.modelState.revision,
      );
      await mobile.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await mobile.waitForTimeout(150);
      assert.ok(
        await mobile.evaluate(
          () =>
            assetViewer.modelState.revision === "precision-correction-4" &&
            assetViewer.renderer.info.render.triangles > 300000,
        ),
        "Phone must render the refined geometry after switching back",
      );
      await mobile.screenshot({
        path: remote
          ? `artifacts/sculpted-viewer/deployed-${engine}-phone.png`
          : `${folder}/phone-${engine}.png`,
        fullPage: true,
      });
      const gallery = await browser.newPage();
      await gallery.goto(
        base + "public/3d-character-viewer/review/index.html",
        { waitUntil: "domcontentloaded", timeout: 90000 },
      );
      const galleryImages = await gallery.evaluate(async () => {
        const images = [...document.images];
        for (const img of images) img.loading = "eager";
        await Promise.all(images.map((img) => img.decode()));
        return images.length;
      });
      assert.ok(
        galleryImages >= 39,
        "Clay comparison gallery must decode all current/baseline renders",
      );
      await gallery.close();
      assert.deepEqual(errors, []);
      assert.deepEqual(assets, []);
      runs.push({
        engine,
        structure,
        geometryChecks,
        comparison: {
          approvedDepth: approved.depth,
          refinedDepth: refined.depth,
          approvedCheeks: approved.cheeks,
          refinedCheeks: refined.cheeks,
          dentitionUnchanged: true,
        },
        mobile: layout,
        errors,
        assetFailures: assets,
        physicalIPhoneTested: false,
      });
      console.log(
        engine,
        "Matched approved/refined views, bare skull, preserved dental crowns, spherical eyes, clay/color, orbit/zoom and iPhone controls passed.",
      );
      await phone.close();
    } finally {
      await browser.close();
    }
  }
  if (!remote)
    await writeFile(
      `${folder}/checks.json`,
      JSON.stringify(
        {
          revision: "precision-correction-4",
          runs,
          physicalIPhoneTested: false,
        },
        null,
        2,
      ) + "\n",
    );
} finally {
  server?.kill();
}
