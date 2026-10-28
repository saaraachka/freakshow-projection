import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL;
const base = remote || "http://localhost:5201/freakshow-projection/";
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
const folder = "public/3d-character-viewer/review/sculpt";
const views = {
  front: [[0, 0, 1], [0, 0, 0], 1],
  "left-three-quarter": [[-0.75, 0.12, 1], [0, 0, 0], 1],
  "right-three-quarter": [[0.75, 0.12, 1], [0, 0, 0], 1],
  "left-profile": [[-1, 0, 0], [0, 0, 0], 1],
  "right-profile": [[1, 0, 0], [0, 0, 0], 1],
  back: [[0, 0, -1], [0, 0, 0], 1],
  top: [[0, 1, 0.04], [0, 0, 0], 1],
  underside: [[0, -1, 0.12], [0, 0, 0], 1],
  eyes: [[0, 0.02, 1], [0, 0.31, 0.36], 0.34],
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
      ({ direction, target, scale }) => {
        const a = assetViewer,
          aim = a.orbit.target;
        aim.set(...target);
        a.camera.position
          .set(...direction)
          .normalize()
          .multiplyScalar(6.4 * scale)
          .add(aim);
        a.orbit.update();
        a.renderer.render(a.scene, a.camera);
      },
      { direction, target, scale },
    );
    await page.waitForTimeout(80);
    if (!remote)
      await page
        .locator("#scene")
        .screenshot({ path: `${folder}/${prefix}${name}.png` });
  }
}
const runs = [];
try {
  if (server) await new Promise((r) => server.stdout.once("data", r));
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
        };
      });
      console.log(engine, "structure", JSON.stringify(structure));
      assert.equal(structure.revision, "sculpt-reconstruction-2");
      assert.equal(structure.staticSculpt, true);
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
        structure.triangles < 360000,
        "Keep below the static sculpt mobile triangle budget",
      );
      assert.ok(structure.hairClumps >= 30 && structure.hairLocks > 200);
      assert.equal(structure.clay, true);
      assert.ok(
        !structure.names.some((n) =>
          /Torus|Tube|Pinna|LipMesh|LidMesh/.test(n),
        ),
      );
      assert.equal(await page.locator("#jaw,#expression").count(), 0);
      await capture(page);
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
      if (
        engine === "chromium" &&
        process.env.FREAKSHOW_SCULPT_BASELINE &&
        !remote
      ) {
        const old = await browser.newPage({
          viewport: { width: 1280, height: 1000 },
        });
        await load(old, process.env.FREAKSHOW_SCULPT_BASELINE);
        await capture(old, "before-");
        await old.close();
      }
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
        galleryImages >= 29,
        "Clay comparison gallery must decode all current/baseline renders",
      );
      await gallery.close();
      assert.deepEqual(errors, []);
      assert.deepEqual(assets, []);
      runs.push({
        engine,
        structure,
        mobile: layout,
        errors,
        assetFailures: assets,
        physicalIPhoneTested: false,
      });
      console.log(
        engine,
        "eight views, five feature close-ups, clay/color, hair visibility, orbit/zoom and iPhone controls passed.",
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
          revision: "sculpt-reconstruction-2",
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
