import test from "node:test";
import assert from "node:assert/strict";
import { EyePulse } from "../public/live-show/eye-pulse.js";
test("eye attack/release are smooth, bounded and return to small resting pupils", () => {
  const p = new EyePulse();
  p.trigger(0, 1);
  assert.equal(p.sample(0), 0);
  assert.ok(Math.abs(p.sample(0.05) - 0.8) < 1e-9);
  assert.ok(p.sample(0.18) > 0.3);
  assert.equal(p.sample(0.4), 0);
  for (let t = 0; t < 1; t += 0.001)
    assert.ok(p.sample(t) >= -1e-10 && p.sample(t) <= 1);
});
test("retrigger begins from the current dilation rather than snapping to rest", () => {
  const p = new EyePulse();
  p.trigger(0);
  const before = p.sample(0.12);
  p.trigger(0.12, 0.5);
  assert.equal(p.sample(0.12), before);
  assert.ok(p.sample(0.14) >= before);
  p.reset();
  assert.equal(p.sample(0.14), 0);
});
test("kick strength and pulse intensity control the same independent envelope", () => {
  const a = new EyePulse(),
    b = new EyePulse();
  a.trigger(0, 0.3);
  b.trigger(0, 1);
  assert.ok(b.sample(0.05) > a.sample(0.05) * 3);
  b.intensity = 0;
  b.reset();
  b.trigger(1);
  assert.equal(b.sample(1.05), 0);
});
test("continuous 130–140 BPM pulses remain bounded and nonzero for each beat", () => {
  for (const bpm of [130, 135, 140]) {
    const p = new EyePulse();
    for (let i = 0; i < 256; i++) {
      const t = (i * 60) / bpm;
      p.trigger(t);
      assert.ok(p.sample(t + 0.05) > 0.7);
      assert.equal(p.sample(t + 0.4), 0);
    }
  }
});
