import test from "node:test";
import assert from "node:assert/strict";
import { OnsetDetector, spectralFeatures } from "../public/live-show/onsets.js";
import {
  FacialPerformance,
  GESTURES,
  Rehearsal,
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
  new FacialPerformance({
    zero,
    constrain: (q) => q,
    presets: {
      Angry: { browAnger: 0.8 },
      Surprised: { jawOpen: 6, eyeOpen: 0.8 },
      "Unhappy / creepy frown": { cheekRaise: -0.25 },
      "Manic laughter": { jawOpen: 6, cheekRaise: 0.65 },
      Neutral: { browRelax: 0.65 },
    },
  });
test("overlapping rapid gestures are bounded, distinct and return exactly to grin", () => {
  const c = make();
  for (let i = 0; i < 200; i++)
    c.trigger(Object.keys(GESTURES)[i % 5], i * 0.015);
  assert.ok(c.voices.length <= 24);
  for (let t = 3; t < 4; t += 0.01) {
    const { pose } = c.sample(t, false);
    assert.ok(pose.jawOpen <= 6);
    for (const v of Object.values(pose)) assert.ok(Number.isFinite(v));
  }
  assert.deepEqual(c.sample(5, false).pose, zero());
  const a = make(),
    b = make();
  a.trigger("kick", 0);
  b.trigger("clap", 0);
  assert.notDeepEqual(a.sample(0.04, false).pose, b.sample(0.04, false).pose);
});
test("transitions redirect smoothly without resetting through grin", () => {
  const c = make();
  c.preset({ jawOpen: 4 }, 0, 1);
  const before = c.baseAt(0.5);
  c.preset({ jawOpen: 1 }, 0.5, 0.5);
  assert.deepEqual(c.baseAt(0.5), before);
  assert.equal(c.baseAt(1).jawOpen, 1);
  c.reset();
  c.trigger("melody", 0);
  const beforeInterrupt = c.sample(0.08, false).pose;
  c.trigger("snare", 0.08);
  assert.deepEqual(c.sample(0.08, false).pose, beforeInterrupt);
  assert.equal(c.voices.length, 1);
  assert.equal(c.sample(0.15, false).pose.eyeOpen, 0.8);
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

test("default mappings reach distinct preset peaks then exact grin", () => {
  const c = make();
  for (const kind of ["kick", "snare", "clap", "melody"]) {
    c.reset();
    c.trigger(kind, 0);
    assert.deepEqual(c.sample(0.08, false).pose, {
      ...zero(),
      ...c.presets[GESTURES[kind].expression],
    });
    assert.deepEqual(c.sample(1, false).pose, zero());
  }
});
test("editable mapping, intensity, envelope and cooldown are independent", () => {
  const c = make();
  c.configure("kick", { expression: "Neutral", intensity: 0.5, cooldown: 0.4 });
  c.setEnvelope({ attack: 0.06, hold: 0.1, release: 0.2 });
  assert.ok(c.trigger("kick", 0));
  assert.equal(c.sample(0.08, false).pose.browRelax, 0.325);
  assert.equal(c.trigger("kick", 0.2), false);
  assert.ok(c.trigger("kick", 0.2, 1, { manual: true }));
  assert.deepEqual(c.sample(1, false).pose, zero());
});
test("one dominant classification for a broadband transient; hysteresis rearms after decay", () => {
  const d = new OnsetDetector(),
    q = f("low", 0.2);
  q.mid = { energy: 0.1, flux: 0.1, tonality: 0.02 };
  q.presence = { energy: 0.1, flux: 0.1, tonality: 0.02 };
  assert.equal(d.process(q, 0).length, 1);
  assert.equal(d.process(q, 0.02).length, 0);
  d.process(f("low", 0), 0.2);
  assert.equal(d.process(q, 0.3).length, 1);
});
test("rehearsal gives a 4/4 backbeat, melody and bounded stress events without backlog", () => {
  const r = new Rehearsal();
  r.start("beat", 0);
  assert.deepEqual(
    Array.from(
      { length: 8 },
      (_, i) => r.advance(i * 0.25, { hats: false, claps: false })[0]?.kind,
    ),
    [
      "kick",
      undefined,
      "snare",
      undefined,
      "kick",
      undefined,
      "snare",
      undefined,
    ],
  );
  r.start("melody", 0);
  assert.equal(r.advance(0)[0].kind, "melody");
  r.start("stress", 0);
  assert.equal(r.advance(10).length, 1);
  assert.equal(r.advance(10).length, 0);
  r.stop();
  assert.deepEqual(r.advance(11), []);
});
