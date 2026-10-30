import test from "node:test";
import assert from "node:assert/strict";
import {
  AudioTimeline,
  BeatClock,
  TempoTracker,
} from "../public/live-show/beat.js";
import { MusicalPerformance } from "../public/live-show/musical-performance.js";
const presets = {
  "Default sinister grin": {},
  Angry: { browAnger: 0.8 },
  "Unhappy / creepy frown": { smileToFrown: 1 },
  "Manic laughter": { jawOpen: 6 },
  Neutral: { browRelax: 0.65 },
  Surprised: { jawOpen: 6, eyeOpen: 0.8 },
};
const keys = [
  "jawOpen",
  "smileToFrown",
  "browAnger",
  "browRelax",
  "eyeOpen",
  "squint",
  "blink",
  "cheekRaise",
  "browRaise",
  "browLeft",
  "cornerLeft",
  "upperLipRaise",
  "gazeX",
  "gazeY",
];
const zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
const make = () =>
  new MusicalPerformance({ zero, presets, constrain: (q) => q }, 0);
test("120/130/135/140 BPM retain exact phrase and bar phase without timer drift", () => {
  for (const bpm of [120, 130, 135, 140]) {
    const c = new BeatClock(bpm);
    for (let b = 0; b < 10000; b += 0.5)
      assert.ok(Math.abs(c.at((b * 60) / bpm) - b) < 1e-8);
    assert.equal(c.read((8 * 60) / bpm, 8).phrase, 1);
  }
});
test("manual tempo, half/double and tap preserve phase; resync and nudges are explicit", () => {
  const c = new BeatClock(135);
  const before = c.at(2);
  c.setBpm(120, 2);
  assert.equal(c.at(2), before);
  c.setBpm(240, 2);
  assert.equal(c.at(2), before);
  c.resync(3);
  assert.equal(c.at(3), 0);
  c.nudge(0.02, 3);
  assert.ok(c.at(3) > 0);
  for (const bpm of [120, 130, 135, 140]) {
    const x = new BeatClock();
    for (let i = 0; i < 8; i++) x.tap((i * 60) / bpm);
    assert.ok(Math.abs(x.bpm - bpm) < 0.01);
  }
});
test("audio timeline remains monotonic across suspend, disconnect and reconnect", () => {
  const t = new AudioTimeline(),
    a = { state: "running", currentTime: 0 };
  assert.equal(t.now(null, 1), 1);
  assert.equal(t.now(a, 2), 2);
  a.currentTime = 1;
  assert.equal(t.now(a, 2.9), 3);
  a.state = "suspended";
  assert.equal(t.now(a, 3.1), 3.1);
  const b = { state: "running", currentTime: 0 };
  assert.equal(t.now(b, 4), 4);
  b.currentTime = 2;
  assert.equal(t.now(b, 6), 6);
});
test("Auto Sync locks regular percussion at tested tempos without clock jumps and holds through silence", () => {
  for (const bpm of [120, 130, 135, 140]) {
    const clock = new BeatClock(),
      tracker = new TempoTracker();
    let last = 0,
      next = 0,
      maxStep = 0;
    for (let t = 0; t < 28; t += 0.025) {
      if (t >= next) {
        tracker.observe(
          [
            {
              kind: Math.round(next / (60 / bpm)) % 2 ? "snare" : "kick",
              time: next,
            },
          ],
          t,
        );
        next += 60 / bpm;
      }
      tracker.update(clock, t);
      const b = clock.at(t);
      maxStep = Math.max(maxStep, b - last);
      assert.ok(b >= last - 1e-8);
      last = b;
    }
    assert.ok(tracker.locked);
    assert.ok(Math.abs(clock.bpm - bpm) < 1, `${bpm}: ${clock.bpm}`);
    assert.ok(maxStep < 0.08);
    const held = clock.bpm;
    for (let t = 28; t < 38; t += 0.1) tracker.update(clock, t);
    assert.equal(clock.bpm, held);
    assert.ok(tracker.confidence < 0.2);
  }
});
test("irregular onsets cannot repeatedly resync or choose new emotions; low confidence holds manual tempo", () => {
  const c = make();
  c.start(0);
  c.autoSync = true;
  for (let i = 0; i < 80; i++) {
    const t = i * 0.071;
    c.listen([{ kind: "clap", time: t }], t, 0.08);
    c.trigger("clap", t, 1);
    c.sample(t, false);
  }
  assert.ok(c.currentExpression === "Angry");
  assert.equal(c.beatClock.revision, 1);
});
test("main expressions change only every eight beats with 1.5-beat smooth transitions", () => {
  const c = make();
  c.start(0);
  const sec = 60 / 135;
  assert.equal(c.currentExpression, "Default sinister grin");
  for (let i = 0; i < 80; i++) {
    const b = i / 10;
    c.trigger("snare", b * sec, 1, { manual: true });
    c.sample(b * sec, false);
    assert.equal(c.currentExpression, "Default sinister grin");
  }
  c.sample(8 * sec, false);
  assert.equal(c.currentExpression, "Angry");
  assert.equal(c.baseAt(8 * sec).browAnger, 0);
  assert.ok(c.baseAt(8.75 * sec).browAnger > 0.35);
  assert.equal(c.baseAt(9.5 * sec).browAnger, 0.8);
  c.sample(16 * sec, false);
  assert.equal(c.currentExpression, "Unhappy / creepy frown");
  c.sample(24 * sec, false);
  assert.equal(c.currentExpression, "Manic laughter");
});
test("rapid accents are bounded, never replace emotions, and release back to the held pose", () => {
  const c = make();
  c.preset(presets.Angry, 0, 0.1);
  c.energy = 1;
  for (let i = 0; i < 400; i++) {
    const t = 0.2 + i * 0.012;
    c.trigger(["kick", "snare", "clap", "melody"][i % 4], t, 1, {
      manual: true,
    });
    const q = c.sample(t, false).pose;
    assert.equal(c.currentExpression, "Angry");
    assert.ok(q.jawOpen <= 0.9);
    assert.ok(c.voices.length <= 5);
  }
  assert.deepEqual(c.sample(7, false).pose, { ...zero(), ...presets.Angry });
  c.reset();
  assert.deepEqual(c.sample(8, false).pose, zero());
});
test("optional and random order preserve scheduled boundaries and avoid immediate repetition", () => {
  const c = make();
  c.optionalSurprised = true;
  c.optionalNeutral = true;
  c.random = true;
  c.start(0);
  let name = c.currentExpression;
  for (let phrase = 1; phrase < 40; phrase++) {
    c.sample((phrase * 8 * 60) / 135, false);
    assert.notEqual(c.currentExpression, name);
    name = c.currentExpression;
  }
});
test("old hit-triggered behavior remains available separately", () => {
  const c = make();
  c.setMode("legacy", 0);
  c.trigger("snare", 1, 1, { manual: true });
  assert.equal(c.sample(1.08, false).pose.jawOpen, 6);
  c.setMode("beat", 2);
  assert.equal(c.automatic, true);
});

test("syncopated breakbeats add accents without adding emotional switches", () => {
  const c = make();
  c.start(0);
  const history = [];
  let prior = c.currentExpression;
  for (let step = 0; step < 128; step++) {
    const b = step / 4,
      t = (b * 60) / 135;
    const kinds = {
      0: "kick",
      4: "snare",
      7: "kick",
      10: "kick",
      12: "snare",
      15: "clap",
    };
    if (kinds[step % 16]) c.trigger(kinds[step % 16], t, 1, { manual: true });
    c.sample(t, false);
    if (c.currentExpression !== prior) {
      history.push(b);
      prior = c.currentExpression;
    }
  }
  assert.deepEqual(history, [8, 16, 24]);
});
