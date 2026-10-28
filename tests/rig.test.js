import test from "node:test";
import assert from "node:assert/strict";
import { mouthPose, DENTITION } from "../src/clown-rig.js";
import { RigMotion, addRigMotion, RIG_POSES } from "../src/rig-motion.js";
const state = (mouth = 0) => ({
  mouthAccent: mouth,
  eyeAccent: 0,
  levels: { bass: 0, mid: 0, high: 0 },
  events: [],
});
test("closed to extreme has monotonic jaw motion with an unchanging tooth scale", () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const pose = mouthPose(i / 1000);
    assert.ok(pose.extra >= previous);
    assert.equal(pose.teethScale, DENTITION.upper.scale);
    assert.ok(pose.chinY < 660);
    previous = pose.extra;
  }
  assert.equal(mouthPose(0).extra, 0);
  assert.equal(mouthPose(-1).extra, 0);
  assert.equal(mouthPose(2).extra, mouthPose(1).extra);
  assert.ok(mouthPose(0.001).extra < 0.001, "no opening pop at the endpoint");
});
test("a retrigger or abrupt target change cannot snap the smoothed jaw shut", () => {
  const rig = new RigMotion();
  for (let i = 0; i < 30; i++) rig.step(state(1));
  const before = rig.smooth.mouth;
  const first = rig.step(state(0));
  assert.ok(first.rig.mouth > before * 0.7);
  assert.ok(first.rig.mouth < before);
  let previous = first.rig.mouth;
  for (let i = 0; i < 60; i++) {
    const current = rig.step(state(0)).rig.mouth;
    assert.ok(current <= previous);
    previous = current;
  }
  assert.ok(previous < 1e-12);
});
test("presentation filtering preserves detection results and reproduces seek poses", () => {
  const frames = Array.from({ length: 120 }, (_, i) => ({
    ...state(i >= 20 && i < 35 ? 1 : 0),
    events: i === 20 ? [{ kind: "mouth", time: 20 / 60 }] : [],
  }));
  const before = structuredClone(frames),
    a = addRigMotion(frames),
    b = addRigMotion(frames);
  assert.deepEqual(frames, before);
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.map((f) => f.events),
    frames.map((f) => f.events),
  );
});
test("every inspection expression uses the same canonical incisors and fangs", () => {
  assert.equal(Object.keys(RIG_POSES).length, 7);
  assert.equal(DENTITION.upper.incisors, 2);
  assert.equal(DENTITION.upper.fangs, 2);
  for (const pose of Object.keys(RIG_POSES)) {
    const rig = new RigMotion();
    let output;
    for (let i = 0; i < 60; i++) output = rig.step(state(), { pose });
    assert.ok(Math.abs(output.rig.mouth - RIG_POSES[pose].mouth) < 1e-12);
    assert.equal(mouthPose(output.rig.mouth).teethScale, 0.73);
  }
});
