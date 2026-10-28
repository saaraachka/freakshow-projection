import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
// Synthetic tetrahedron verifies GLB/morph plumbing only. Never a character or a shipped fallback.
function fixture() {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0, 0, 0, 1]),
    delta = new Float32Array(12);
  delta[0] = -0.2;
  const indices = new Uint16Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]);
  const bytes = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(delta.buffer),
    Buffer.from(indices.buffer),
  ]);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "SyntheticTestFixture" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 2,
            targets: [{ POSITION: 1 }, { POSITION: 1 }],
          },
        ],
        weights: [0, 0],
        extras: { targetNames: ["evilGrin", "jawOpen"] },
      },
    ],
    buffers: [{ byteLength: bytes.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48 },
      { buffer: 0, byteOffset: 48, byteLength: 48 },
      { buffer: 0, byteOffset: 96, byteLength: 24 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [-1, -1, 0],
        max: [1, 1, 1],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [-0.2, 0, 0],
        max: [0, 0, 0],
      },
      { bufferView: 2, componentType: 5123, count: 12, type: "SCALAR" },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]);
  const header = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + text.length + bytes.length, 8);
  jh.writeUInt32LE(text.length);
  jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bytes.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, text, bh, bytes]);
}
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
try {
  if (server) await new Promise((r) => server.stdout.once("data", r));
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
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const errors = [],
        bad = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) bad.push(r.url());
      });
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(base + "public/3d-character-viewer/index.html");
      await page.waitForFunction(() => window.assetViewer);
      assert.equal(
        await page.evaluate(() => assetViewer.modelState.loaded),
        false,
      );
      assert.equal(
        await page.evaluate(() => assetViewer.renderer.info.render.triangles),
        0,
      );
      assert.equal(await page.locator("#jaw").isDisabled(), true);
      await page.screenshot({
        path: `artifacts/sculpted-viewer/${engine}-empty.png`,
        fullPage: true,
      });
      assert.equal(
        requests.some((u) =>
          /clown-head|\.png|\.svg|approved-character|\/renderer.js/.test(u),
        ),
        false,
      );
      await page
        .locator("#asset")
        .setInputFiles({
          name: "TEST-ONLY-tetrahedron.glb",
          mimeType: "model/gltf-binary",
          buffer: fixture(),
        });
      await page.waitForFunction(
        () => document.querySelector("#scene").dataset.modelLoaded === "true",
      );
      assert.equal(await page.locator("#expression").inputValue(), "evilGrin");
      assert.equal(await page.locator("#jaw").isDisabled(), false);
      await page.locator("#jaw").fill("0.7");
      assert.equal(
        await page.evaluate(
          () => assetViewer.model.children[0].morphTargetInfluences[1],
        ),
        0.7,
      );
      for (const view of ["front", "side", "back", "underside"]) {
        await page.locator(`[data-view="${view}"]`).click();
        const p = await page.evaluate(() =>
          assetViewer.camera.position.toArray(),
        );
        assert.ok(p.every(Number.isFinite));
      }
      await page.locator("#reset").click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
      console.log(
        `${engine}: empty state truthful; zero character primitives; no illustrated assets; GLB load, real morph targets, jaw control, full camera views and mobile layout pass. Synthetic fixture is not character proof.`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server?.kill();
}
