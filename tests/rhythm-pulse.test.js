import test from "node:test";
import assert from "node:assert/strict";
import { EyePulse } from "../public/live-show/eye-pulse.js";
import { RhythmPulse } from "../public/live-show/rhythm-pulse.js";
test("whole-head scale hits exact selected peaks and rests at 1 across 120–140 BPM without drift", () => {
  for (const bpm of [120, 130, 135, 140])
    for (const intensity of [0, 0.02, 0.04, 0.06]) {
      const eye = new EyePulse(),
        p = new RhythmPulse(eye);
      for (let i = 0; i < 256; i++) {
        const t = (i * 60) / bpm;
        assert.ok(p.trigger(t, 0.7));
        assert.equal(p.scale(t + 0.05, intensity), 1 + intensity);
        assert.equal(p.scale(t + 0.34, intensity), 1);
        assert.ok(Math.abs(eye.sample(t + 0.05) - 0.56) < 1e-9);
      }
    }
});
test("kick and clock on the same beat trigger one synchronized impact", () => {
  const e = new EyePulse(),
    p = new RhythmPulse(e);
  assert.ok(p.trigger(0));
  assert.equal(p.trigger(0.04), false);
  assert.equal(p.events, 1);
  assert.equal(p.head.state.time, e.state.time);
  assert.equal(p.head.attack, e.attack);
  assert.equal(p.head.release, e.release);
  assert.equal(p.head.release, 0.28);
});
test("overlapping pulse retriggers preserve instantaneous head and eye scales", () => {
  const e = new EyePulse(),
    p = new RhythmPulse(e);
  p.trigger(0);
  const h = p.scale(0.15),
    eye = e.sample(0.15);
  assert.ok(p.trigger(0.15));
  assert.equal(p.scale(0.15), h);
  assert.equal(e.sample(0.15), eye);
  assert.equal(p.scale(0.49), 1);
  p.reset();
  assert.equal(p.scale(0.5), 1);
  assert.equal(e.sample(0.5), 0);
});
