import test from "node:test";
import assert from "node:assert/strict";
import { OnsetDetector, spectralFeatures } from "../public/live-show/onsets.js";
import {
  FacialPerformance,
  GESTURES,
} from "../public/live-show/performance.js";
const f = (key, energy = 0.1, tonality = 0.05) =>
  Object.fromEntries(
    ["low", "mid", "presence", "high"].map((k) => [
      k,
      {
        energy: k === key ? energy : 0,
        flux: k === key ? energy : 0,
        tonality: k === key ? tonality : 0,
      },
    ]),
  );
test("onsets classify distinct bands, silence and sustained sounds do not jitter", () => {
  for (const [k, band, t] of [
    ["kick", "low", 0.6],
    ["melody", "mid", 0.6],
    ["snare", "mid", 0.03],
    ["clap", "presence", 0.03],
    ["hat", "high", 0.03],
  ]) {
    const d = new OnsetDetector();
    assert.equal(d.process(f(band, 0.1, t), 0)[0]?.kind, k);
    for (let i = 1; i < 180; i++) {
      const frame = f(band, 0.1, t);
      frame[band].flux = 0;
      assert.equal(d.process(frame, i / 60).length, 0);
    }
  }
  assert.deepEqual(new OnsetDetector().process(f("low", 0), 0), []);
});
test("sensitivity affects quiet attacks; repeated tonal notes remain discrete", () => {
  assert.equal(
    new OnsetDetector().process(f("mid", 0.004, 0.6), 0, 0.5).length,
    0,
  );
  assert.equal(
    new OnsetDetector().process(f("mid", 0.004, 0.6), 0, 2)[0].kind,
    "melody",
  );
  const d = new OnsetDetector(),
    events = [];
  for (let i = 0; i < 90; i++) {
    const onset = [6, 24, 42].includes(i),
      q = f("mid", onset ? 0.12 : 0, 0.6);
    events.push(...d.process(q, i / 60));
  }
  assert.equal(events.filter((e) => e.kind === "melody").length, 3);
});
test("spectrum features measure rate-correct bass and tonal energy", () => {
  const a = new Float32Array(1024);
  a[Math.round((100 * 2048) / 48000)] = 0.1;
  const q = spectralFeatures(a, null, 48000, 2048);
  assert.ok(q.low.energy > 0.09);
  assert.equal(q.high.energy, 0);
  assert.equal(q.low.tonality, 1);
});
const keys = [
  "jawOpen",
  "eyeOpen",
  "browAnger",
  "browRaise",
  "innerRaise",
  "cornerLeft",
  "cornerRight",
  "cheekRaise",
  "browLeft",
  "browRight",
  "squint",
  "browRelax",
  "upperLipRaise",
  "gazeX",
  "gazeY",
];
const zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
const make = () =>
  new FacialPerformance({ zero, constrain: (q) => q, presets: {} });
test("overlapping rapid gestures are bounded, distinct and return exactly to grin", () => {
  const c = make();
  for (let i = 0; i < 200; i++)
    c.trigger(Object.keys(GESTURES)[i % 5], i * 0.015);
  assert.ok(c.voices.length <= 24);
  for (let t = 3; t < 4; t += 0.01) {
    const { pose } = c.sample(t, false);
    assert.ok(pose.jawOpen <= 4.2);
    for (const v of Object.values(pose)) assert.ok(Number.isFinite(v));
  }
  assert.deepEqual(c.sample(5, false).pose, zero());
  const a = make(),
    b = make();
  a.trigger("kick", 0);
  b.trigger("clap", 0);
  assert.notDeepEqual(a.sample(0.04, false).pose, b.sample(0.04, false).pose);
});
test("transitions are interruptible and melodic reattack includes separation", () => {
  const c = make();
  c.preset({ jawOpen: 4 }, 0, 1);
  const before = c.baseAt(0.5);
  c.preset({ jawOpen: 1 }, 0.5, 0.5);
  assert.deepEqual(c.baseAt(0.5), before);
  assert.equal(c.baseAt(1).jawOpen, 1);
  c.reset();
  c.trigger("melody", 0);
  const peak = c.sample(0.08, false).pose.jawOpen;
  c.trigger("melody", 0.15);
  assert.ok(c.sample(0.18, false).pose.jawOpen < peak * 0.3);
  assert.ok(c.sample(0.26, false).pose.jawOpen > peak * 0.8);
});
test("bass-dominant transients do not turn weak harmonic leakage into melody", () => {
  const q = f("low", 0.2, 0.6);
  q.mid = { energy: 0.01, flux: 0.01, tonality: 0.6 };
  assert.deepEqual(
    new OnsetDetector().process(q, 0).map((e) => e.kind),
    ["kick"],
  );
});
test("interrupting an audible gesture starts a preset from its current facial state", () => {
  const c = make();
  c.trigger("snare", 0);
  const q = c.sample(0.045, false).pose;
  c.preset({ jawOpen: 1 }, 0.045, 0.5);
  assert.deepEqual(c.baseAt(0.045), q);
  assert.equal(c.baseAt(0.545).jawOpen, 1);
});
