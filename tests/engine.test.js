import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzePCM } from "../src/analysis.js";
import {
  simulate,
  Engine,
  envelope,
  evaluateAnnotations,
  STEP,
} from "../src/engine.js";
import { synthesize } from "./helpers.js";
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/accents.json", import.meta.url)),
);
const features = analyzePCM(synthesize(fixture));
const frames = simulate(features),
  events = frames.flatMap((f) => f.events);
test("saved song annotations match the actual PCM analysis", () => {
  const results = evaluateAnnotations(events, fixture.annotations);
  assert.equal(results.length, 4);
  assert.deepEqual(
    results.filter((r) => !r.pass),
    [],
  );
});
test("replaying, rebuilding and seeking select identical states", () => {
  const second = simulate(features);
  assert.deepEqual(second, frames);
  for (const index of [31, 93, 100, 180, 239])
    assert.deepEqual(second[index], frames[index]);
  assert.equal(frames.length, 240);
});
test("sustained sound cannot continually retrigger the same expression", () => {
  const e = new Engine();
  const frames = Array.from({ length: 600 }, (_, i) =>
    e.step({ bass: 0.8, mid: 0.8, high: 0 }, i * STEP),
  );
  assert.equal(
    frames.flatMap((f) => f.events).filter((e) => e.kind === "eye").length,
    1,
  );
  assert.equal(
    frames.flatMap((f) => f.events).filter((e) => e.kind === "mouth").length,
    1,
  );
  assert.equal(frames.at(-1).eyeAccent, 0);
});
test("all envelopes open and return to rest; dramatic presets change expression", () => {
  for (const mode of ["smooth", "snap", "spring"]) {
    assert.equal(envelope(-1, 0.52, mode), 0);
    assert.ok(envelope(0.1, 0.52, mode) > 0);
    assert.equal(envelope(0.6, 0.52, mode), 0);
  }
  const extreme = simulate(features, { exaggeration: "extreme" }),
    subtle = simulate(features, { exaggeration: "subtle" });
  assert.ok(extreme[34].eyeAccent > subtle[34].eyeAccent);
});
test("regression reports missed, duplicate and ignored events as failures", () => {
  const actual = [{ time: 1, kind: "eye" }];
  const results = evaluateAnnotations(actual, [
    { time: 1, kind: "eye" },
    { time: 1, kind: "eye" },
    { time: 1, kind: "ignore" },
    { time: 2, kind: "mouth" },
  ]);
  assert.deepEqual(
    results.map((r) => r.pass),
    [true, false, false, false],
  );
});
test("nearest event is matched first", () => {
  const results = evaluateAnnotations(
    [
      { time: 0.9, kind: "eye" },
      { time: 1.01, kind: "eye" },
    ],
    [{ time: 1, kind: "eye" }],
  );
  assert.equal(results[0].actual, 1.01);
});
test("silence stays silent and resetting clears adaptive history", () => {
  const e = new Engine();
  e.step({ bass: 1, mid: 1, high: 1 }, 0);
  e.reset();
  const quiet = e.step({ bass: 0, mid: 0, high: 0 }, 0);
  assert.equal(quiet.events.length, 0);
  assert.equal(quiet.bassDrive, 0);
});
