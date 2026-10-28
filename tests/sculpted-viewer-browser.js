import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL,
  base = remote || "http://localhost:5201/freakshow-projection/";
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: {
        ...process.env,
        PORT: "5201",
        BASE_PATH: "/freakshow-projection/",
      },
      stdio: "pipe",
    });
const runs = [];
try {
  if (server) await new Promise((r) => server.stdout.once("data", r));
  await mkdir("public/3d-character-viewer/review", { recursive: true });
  await mkdir("artifacts/sculpted-viewer", { recursive: true });
  for (const engine of [
    "chromium",
    ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
  ]) {
    const browser = await (engine === "webkit" ? webkit : chromium).launch({
      executablePath:
        engine === "webkit"
          ? process.env.FREAKSHOW_WEBKIT_EXECUTABLE
          : "/usr/bin/chromium",
      proxy:
        remote && process.env.HTTPS_PROXY
          ? { server: process.env.HTTPS_PROXY }
          : undefined,
      args:
        engine === "chromium"
          ? ["--no-sandbox", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      });
      const errors = [],
        bad = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.location().url.endsWith("favicon.ico"))
          errors.push(m.text());
      });
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
          bad.push(r.url());
      });
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(base + "public/3d-character-viewer/index.html");
      await page.waitForFunction(() => window.assetViewer?.modelState.loaded);
      await page.evaluate(() => (assetViewer.orbit.enableDamping = false));
      assert.equal(
        await page.evaluate(() => assetViewer.modelState.source),
        "procedural-code",
      );
      assert.equal(await page.evaluate(() => assetViewer.modelState.teeth), 24);
      assert.ok(
        await page.evaluate(
          () => assetViewer.renderer.info.render.triangles > 20000,
        ),
      );
      assert.equal(
        requests.some((u) =>
          /clown-head|\.png|\.svg|approved-character|GLTFLoader|\/renderer.js/.test(
            u,
          ),
        ),
        false,
      );
      const structure = await page.evaluate(() => {
        const model = assetViewer.character,
          geometry = model.face.geometry,
          p = geometry.attributes.position,
          n = geometry.attributes.normal,
          parents = Array.from({ length: p.count }, (_, i) => i);
        const find = (i) => {
          while (parents[i] !== i) {
            parents[i] = parents[parents[i]];
            i = parents[i];
          }
          return i;
        };
        const index = geometry.index.array;
        for (let i = 0; i < index.length; i += 3) {
          const a = find(index[i]);
          parents[find(index[i + 1])] = a;
          parents[find(index[i + 2])] = a;
        }
        const components = new Set(parents.map((_, i) => find(i))).size,
          meshNames = [];
        let finite = true,
          attributesMatch = true;
        model.root.traverse((o) => {
          if (!o.isMesh) return;
          meshNames.push(o.name);
          for (const key of ["position", "normal", "color"]) {
            const a = o.geometry.attributes[key];
            if (a) {
              attributesMatch &&=
                a.count === o.geometry.attributes.position.count;
              for (const v of a.array) if (!Number.isFinite(v)) finite = false;
            }
          }
        });
        let min = Infinity,
          max = -Infinity;
        for (let i = 0; i < p.count; i++) {
          const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
          min = Math.min(min, length);
          max = Math.max(max, length);
        }
        geometry.computeBoundingBox();
        const box = geometry.boundingBox,
          v = model.state.hairVariation;
        return {
          components,
          finite,
          attributesMatch,
          normalRange: [min, max],
          skinBounds: box,
          meshNames,
          faceVertices: p.count,
          generationMs: model.state.generationMs,
          revision: model.state.revision,
          hairStrands: v.length,
          curlRadiusRange: [
            Math.min(...v.map((s) => s.radius)),
            Math.max(...v.map((s) => s.radius)),
          ],
          thicknessRange: [
            Math.min(...v.map((s) => s.thickness)),
            Math.max(...v.map((s) => s.thickness)),
          ],
          openStrands: v.every((s) => s.endpointDistance > 0.03),
          bothDirections: new Set(v.map((s) => s.direction)).size === 2,
          eyeFront: Math.max(
            ...model.eyes.map((e) => {
              e.geometry.computeBoundingBox();
              return e.position.z + e.geometry.boundingBox.max.z;
            }),
          ),
        };
      });
      assert.equal(structure.revision, "anatomy-refinement-1");
      console.log(engine + " structure " + JSON.stringify(structure));
      assert.equal(
        structure.components,
        1,
        "the skull, lips, sockets, cheeks and chin must be one connected skin",
      );
      assert.ok(structure.finite && structure.attributesMatch);
      assert.ok(
        structure.normalRange[0] > 0.98 && structure.normalRange[1] < 1.02,
      );
      assert.ok(
        structure.hairStrands > 500 &&
          structure.openStrands &&
          structure.bothDirections,
      );
      assert.ok(structure.thicknessRange[1] > structure.thicknessRange[0] * 3);
      assert.equal(
        structure.meshNames.some((n) =>
          /ContinuousLipLoop|SculptedEyelid|^Neck$|^Chin$/.test(n),
        ),
        false,
      );
      assert.ok(structure.eyeFront < 0.66, "globes sit behind the orbital rim");
      assert.ok(
        structure.skinBounds.max.z < 1 && structure.skinBounds.min.y > -1.3,
        "reduced profile and no neck/chin nub",
      );
      const originals = await page.evaluate(() =>
        assetViewer.character.teeth.map((t) =>
          Array.from(t.geometry.attributes.position.array),
        ),
      );
      for (const view of [
        "front",
        "three-quarter",
        "side",
        "back",
        "underside",
      ]) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForTimeout(250);
        if (engine === "chromium" && !remote)
          await page.locator("#stage").screenshot({
            path: `public/3d-character-viewer/review/${view}.png`,
          });
      }
      await page.locator("#jaw").fill("0.8");
      await page.locator('[data-view="three-quarter"]').click();
      await page.waitForTimeout(250);
      if (engine === "chromium" && !remote)
        await page.locator("#stage").screenshot({
          path: "public/3d-character-viewer/review/jaw-open.png",
        });
      assert.deepEqual(
        await page.evaluate(() =>
          assetViewer.character.teeth.map((t) =>
            Array.from(t.geometry.attributes.position.array),
          ),
        ),
        originals,
      );
      assert.ok(
        await page.evaluate(() => assetViewer.character.lower.rotation.x > 0.3),
      );
      await page.locator("#jaw").fill("0");
      await page.locator("#expression").selectOption("smirk");
      await page.locator("#reset").click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `artifacts/sculpted-viewer/${engine}-${remote ? "published" : "generated"}-mobile.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
      console.log(
        `${engine}: visible procedural head; front/three-quarter/side/back/underside views; 24 rigid teeth under shared jaw rotation; no illustration or external model requests; mobile layout passes.`,
      );
      const desktopCanvas = page.locator("#scene");
      await desktopCanvas.scrollIntoViewIfNeeded();
      const desktopBox = await desktopCanvas.boundingBox();
      await page.mouse.move(
        desktopBox.x + desktopBox.width * 0.5,
        desktopBox.y + desktopBox.height * 0.5,
      );
      const zoomBefore = await page.evaluate(() =>
        assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
      );
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(200);
      assert.ok(
        (await page.evaluate(() =>
          assetViewer.camera.position.distanceTo(assetViewer.orbit.target),
        )) < zoomBefore,
        "desktop wheel zoom remains available",
      );
      const phone = await browser.newPage({ ...devices["iPhone 13"] });
      const phoneErrors = [];
      phone.on("pageerror", (e) => phoneErrors.push(e.message));
      await phone.goto(base + "public/3d-character-viewer/index.html");
      await phone.waitForFunction(() => window.assetViewer?.modelState.loaded);
      await phone.locator("#quality").selectOption("1");
      await phone.waitForTimeout(200);
      const mobile = await phone.evaluate(() => {
        const a = assetViewer,
          c = document.createElement("canvas");
        a.renderer.render(a.scene, a.camera);
        c.width = 64;
        c.height = 64;
        c.getContext("2d").drawImage(a.renderer.domElement, 0, 0, 64, 64);
        const data = c.getContext("2d").getImageData(0, 0, 64, 64).data;
        let min = 255,
          max = 0;
        for (let i = 0; i < data.length; i += 4) {
          min = Math.min(min, data[i]);
          max = Math.max(max, data[i]);
        }
        return {
          fits: document.documentElement.scrollWidth <= innerWidth,
          dpr: a.renderer.getPixelRatio(),
          webgl2: a.renderer.capabilities.isWebGL2,
          range: max - min,
          generationMs: a.character.state.generationMs,
          triangles: a.renderer.info.render.triangles,
        };
      });
      assert.ok(mobile.fits && mobile.webgl2 && mobile.range > 60);
      assert.equal(mobile.dpr, 1);
      await phone.locator("#jaw").fill("0.65");
      await phone.locator('[data-view="side"]').click();
      await phone.waitForTimeout(200);
      assert.ok(
        await phone.evaluate(
          () => assetViewer.character.lower.rotation.x > 0.25,
        ),
      );
      await phone.locator("#jaw").fill("0");
      await phone.locator('[data-view="front"]').click();
      const orbitBefore = await phone.evaluate(() =>
        assetViewer.camera.position.toArray(),
      );
      const canvas = phone.locator("#scene");
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      await phone.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await phone.mouse.down();
      await phone.mouse.move(
        box.x + box.width * 0.7,
        box.y + box.height * 0.5,
        { steps: 8 },
      );
      await phone.mouse.up();
      await phone.waitForTimeout(200);
      assert.notDeepEqual(
        await phone.evaluate(() => assetViewer.camera.position.toArray()),
        orbitBefore,
        "orbit drag changes the camera in the mobile viewport",
      );
      await phone.locator("#reset").tap();
      await phone.waitForTimeout(200);
      await phone.screenshot({
        path: `artifacts/sculpted-viewer/${engine}-iphone-refined.png`,
        fullPage: true,
      });
      if (!remote && engine === "webkit")
        await phone.screenshot({
          path: "public/3d-character-viewer/review/iphone-webkit.png",
          fullPage: true,
        });
      assert.deepEqual(phoneErrors, []);
      await phone.close();
      runs.push({
        engine,
        structure,
        mobile,
        errors,
        assetFailures: bad,
        physicalIPhoneTested: false,
      });
    } finally {
      await browser.close();
    }
  }
  if (!remote)
    await writeFile(
      "public/3d-character-viewer/review/checks.json",
      JSON.stringify(
        { revision: "anatomy-refinement-1", runs, physicalIPhoneTested: false },
        null,
        2,
      ),
    );
} finally {
  server?.kill();
}
