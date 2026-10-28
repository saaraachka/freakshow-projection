import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const remote = process.env.FREAKSHOW_BASE_URL;
const base = remote || "http://localhost:5199/freakshow-projection/";
const server = remote
  ? null
  : spawn(process.execPath, ["scripts/serve.js", "dist"], {
      env: {
        ...process.env,
        PORT: "5199",
        BASE_PATH: "/freakshow-projection/",
      },
      stdio: "pipe",
    });
try {
  if (server)
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
    });
  await mkdir("artifacts/deployment", { recursive: true });
  for (const name of [
    "chromium",
    ...(process.env.FREAKSHOW_WEBKIT_EXECUTABLE ? ["webkit"] : []),
  ]) {
    const browser = await (name === "webkit" ? webkit : chromium).launch({
      executablePath:
        name === "webkit"
          ? process.env.FREAKSHOW_WEBKIT_EXECUTABLE
          : "/usr/bin/chromium",
      proxy:
        remote && process.env.HTTPS_PROXY
          ? { server: process.env.HTTPS_PROXY }
          : undefined,
      args:
        name === "chromium"
          ? ["--no-sandbox", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        errors = [],
        responses = [],
        failed = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) =>
        responses.push({
          url: r.url(),
          status: r.status(),
          type: r.headers()["content-type"],
        }),
      );
      page.on("requestfailed", (r) =>
        failed.push({ url: r.url(), failure: r.failure() }),
      );
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator('[data-mode="studio"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector("#preview").dataset.characterRenderer ===
          "approved-mesh",
      );
      const visual = await page.evaluate(() => ({
        background: getComputedStyle(document.documentElement).backgroundColor,
        font: getComputedStyle(document.body).fontFamily,
        base: document.baseURI,
        canvas: { ...document.querySelector("#preview").dataset },
        width: document.querySelector("#preview").width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(visual.background, "rgb(18, 17, 20)");
      assert.match(visual.font, /Arial/);
      assert.equal(visual.overflow, false);
      assert.ok(visual.width > 390);
      assert.equal(new URL(visual.base).pathname, "/freakshow-projection/");
      assert.equal(visual.canvas.meshTriangles, "26400");
      for (const r of responses) {
        assert.ok(r.status < 400, JSON.stringify(r));
        if (new URL(r.url).pathname.endsWith(".css"))
          assert.match(r.type, /text\/css/);
        if (new URL(r.url).pathname.endsWith(".js"))
          assert.match(r.type, /(java|ecma)script/);
      }
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      // Reproduce the old worker defect without loading the expensive development WebGL model.
      const study = new URL("public/character-3d/index.html", base).href;
      const navigation = await page.evaluate(
        (url) =>
          new Promise((resolve, reject) => {
            const frame = document.createElement("iframe");
            frame.style.display = "none";
            frame.onload = () => {
              resolve({
                title: frame.contentDocument.title,
                css: [
                  ...frame.contentDocument.querySelectorAll(
                    'link[rel="stylesheet"]',
                  ),
                ].map((x) => x.href),
              });
              frame.remove();
            };
            frame.onerror = reject;
            frame.src = url;
            document.body.append(frame);
          }),
        study,
      );
      assert.match(navigation.title, /3D anatomy study/);
      assert.equal(navigation.css.length, 0);
      // A cached HTML error must not be served as a stylesheet.
      await page.evaluate(async () => {
        const key = (await caches.keys()).find((k) =>
          k.startsWith("freakshow-v7"),
        );
        const cache = await caches.open(key);
        await cache.put(
          new URL("styles.css", document.baseURI),
          new Response("<html>stale error</html>", {
            headers: { "Content-Type": "text/html" },
          }),
        );
      });
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).backgroundColor,
        ),
        "rgb(18, 17, 20)",
      );
      await page.locator('[data-mode="studio"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector("#preview").dataset.characterRenderer ===
          "approved-mesh",
      );
      await page.screenshot({
        path: `artifacts/deployment/${name}-${remote ? "published" : "subpath"}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (name === "chromium") {
        await context.setOffline(true);
        await page.goto(base + "?offline-check");
        await page.locator('[data-mode="studio"]').click();
        await page.waitForFunction(
          () =>
            document.querySelector("#preview").dataset.characterRenderer ===
            "approved-mesh",
        );
        assert.equal(
          await page.evaluate(
            () => getComputedStyle(document.documentElement).backgroundColor,
          ),
          "rgb(18, 17, 20)",
        );
      }
      assert.deepEqual(errors, []);
      await writeFile(
        `artifacts/deployment/${name}-${remote ? "published" : "subpath"}.json`,
        JSON.stringify(
          {
            base,
            visual,
            errors,
            responses,
            failed,
            study: navigation,
            offline: name === "chromium",
            physicalIPhone: false,
          },
          null,
          2,
        ),
      );
      console.log(
        `${name}: ${base} styled; actual mesh renders; CSS/module MIME valid; development navigation isolated; corrupted cache repaired; offline cache ${name === "chromium" ? "reload verified" : "not exercised: WPE offline navigation limitation"}.`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server?.kill();
}
