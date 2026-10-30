import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const base =
  process.env.SHOW_BASE || "http://localhost:5195/freakshow-projection/";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--use-file-for-fake-audio-capture=" +
      path.resolve("tests/fixtures/live-show.wav"),
  ],
});
try {
  const c = await b.newContext({ viewport: { width: 1000, height: 700 } }),
    p = await c.newPage();
  await p.goto(base);
  await p.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.active,
    null,
    { timeout: 60000 },
  );
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  await c.setOffline(true);
  await p.goto(
    new URL("public/live-show/index.html?offline-review", base).href,
  );
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  await p.click("#reset");
  await p.click("#connect");
  await p.waitForFunction(() => !!freakshowLive.input.clockNode, null, {
    timeout: 20000,
  });
  await p.waitForFunction(() => freakshowLive.input.maxLevel > 0.01);
  await p.click("#hide");
  await p.screenshot({ path: "artifacts/live-show/offline.png" });
  const result = await p.evaluate(() => ({
    offline: !navigator.onLine,
    audioWorklet: !!freakshowLive.input.clockNode,
    vertices: freakshowLive.rig.rest.length / 3,
    worker: navigator.serviceWorker.controller.scriptURL,
  }));
  assert.equal(result.vertices, 82720);
  assert.ok(result.offline);
  await writeFile(
    "artifacts/live-show/offline.json",
    JSON.stringify(result, null, 2),
  );
  console.log("Offline Candidate A load passed", JSON.stringify(result));
  await c.close();
} finally {
  await b.close();
}
