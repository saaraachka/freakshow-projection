import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base =
  process.env.SHOW_BASE || "http://localhost:5195/freakshow-projection/";
const useWebkit = !!process.env.SHOW_WEBKIT;
const b = await (useWebkit ? webkit : chromium).launch({
  executablePath: useWebkit ? "/tmp/freakshow-webkit-run" : "/usr/bin/chromium",
  ...(base.startsWith("https:")
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
  ...(!useWebkit
    ? { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] }
    : {}),
});
const dir = "artifacts/file-playback-" + (useWebkit ? "webkit" : "chromium");
await mkdir(dir, { recursive: true });
try {
  const p = await b.newPage({ viewport: { width: 1100, height: 760 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.micRequests = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        window.micRequests++;
        throw Error("File playback must not request microphone");
      },
    });
  });
  await p.goto(base + "public/live-show/index.html?file-review");
  await p.waitForFunction(() => window.freakshowLive?.ready, null, {
    timeout: 180000,
  });
  const observations = [];
  for (const path of [
    "tests/fixtures/live-show.wav",
    "tests/fixtures/live-show.mp3",
  ]) {
    await p.evaluate(()=>freakshowLive.controller.events=[]);
    const picker = p.locator("#audioFile");
    assert.ok(await picker.isVisible());
    assert.ok(await picker.isEnabled());
    const choosing = p.waitForEvent("filechooser");
    await picker.click();
    const chooser = await choosing;
    await chooser.setFiles(path);
    await p.waitForFunction(
      () => !!freakshowLive.input.clockNode && !!freakshowLive.input.media,
      null,
      { timeout: 30000 },
    );
    await p.locator("audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () =>
        freakshowLive.input.maxLevel > 0.01 &&
        freakshowLive.controller.events.length > 0,
      null,
      { timeout: 30000 },
    );
    await p.waitForFunction(
      () => document.querySelector("audio").currentTime > 0.3,
    );
    const result = await p.evaluate(() => ({
      src: document.querySelector("audio").currentSrc,
      time: document.querySelector("audio").currentTime,
      level: freakshowLive.input.maxLevel,
      events: freakshowLive.controller.events.slice(-4),
      micRequests: window.micRequests,
    }));
    assert.equal(result.micRequests, 0);
    assert.ok(result.src.startsWith("blob:"));
    await p.locator("audio").evaluate((el) => el.pause());
    const paused = await p.locator("audio").evaluate((el) => el.currentTime);
    await p.waitForTimeout(250);
    assert.equal(
      await p.locator("audio").evaluate((el) => el.currentTime),
      paused,
    );
    await p.locator("audio").evaluate((el) => {
      el.currentTime = 3;
    });
    await p.waitForFunction(
      () => Math.abs(document.querySelector("audio").currentTime - 3) < 0.15,
    );
    await p.locator("audio").evaluate((el) => el.play());
    await p.waitForFunction(
      () => document.querySelector("audio").currentTime > 3.2,
    );
    observations.push(result);
  }
  await p.screenshot({ path: dir + "/player.png" });
  await p.click("#disconnect");
  assert.equal(await p.evaluate(() => freakshowLive.input.context), null);
  assert.equal(await p.locator("audio").count(), 0);
  await p.click('[data-gesture="snare"]');
  assert.equal(
    await p.evaluate(() => freakshowLive.controller.events.at(-1).expression),
    "Surprised",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/checks.json",
    JSON.stringify({ observations, errors }, null, 2),
  );
  console.log(
    "WAV and MP3 chooser, playback, seek, pause, detection, no mic request, disconnect/manual fallback passed",
  );
} finally {
  await b.close();
}
