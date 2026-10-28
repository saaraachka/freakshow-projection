import test from "node:test";
import assert from "node:assert/strict";
import { mouthPose, DENTITION, eyeGeometry } from "../src/clown-rig.js";
import {
  RigMotion,
  addRigMotion,
  RIG_POSES,
  rehearsalPreview,
} from "../src/rig-motion.js";
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
  assert.equal(Object.keys(RIG_POSES).length, 6);
  assert.equal(DENTITION.upper.incisors, 2);
  assert.equal(DENTITION.upper.fangs, 2);
  for (const pose of Object.keys(RIG_POSES)) {
    const rig = new RigMotion();
    let output;
    for (let i = 0; i < 60; i++) output = rig.step(state(), { pose });
    assert.ok(Math.abs(output.rig.mouth - RIG_POSES[pose].mouth) < 1e-12);
    assert.equal(mouthPose(output.rig.mouth).teethScale, 0.55);
  }
});

test("shared gaze does not depend on pupil dilation, and the iris never grows", () => {
  const resting = eyeGeometry(
    { gazeX: -1, gazeY: 1, gazeIdle: 0, eye: 0 },
    1,
    10,
  );
  const hit = eyeGeometry({ gazeX: -1, gazeY: 1, gazeIdle: 0, eye: 1 }, 1, 10);
  assert.equal(resting.dx, hit.dx);
  assert.equal(resting.dy, hit.dy);
  assert.equal(resting.irisRadius, hit.irisRadius);
  assert.ok(hit.pupilRadius > resting.pupilRadius);
  const rig = new RigMotion();
  for (let i = 0; i < 60; i++) rig.step(state(), { pupil: 1 });
  for (let i = 0; i < 60; i++) rig.step(state(), { pupil: 0 });
  assert.ok(rig.smooth.eye < 0.001);
});

test("three rehearsed notes have different contours and nearly close between notes", () => {
  const rig = new RigMotion(),
    peaks = [],
    closures = [];
  for (let i = 0; i < 180; i++) {
    const t = i / 60,
      pose = rig.step(state(), rehearsalPreview(t)).rig;
    if ([12, 66, 120].includes(i)) peaks.push(pose);
    if ([45, 99, 153].includes(i)) closures.push(pose);
  }
  assert.equal(peaks.length, 3);
  assert.equal(closures.length, 3);
  for (const pose of closures) assert.ok(pose.bottom - pose.top < 0.02);
  assert.ok(peaks[0].span < peaks[1].span && peaks[1].span < peaks[2].span);
  assert.ok(peaks[1].bottom - peaks[1].top > peaks[2].bottom - peaks[2].top);
});
test("transition filtering is consistent at 30, 60, and 120 Hz", () => {
  const outputs = [30, 60, 120].map((hz) => {
    const rig = new RigMotion();
    for (let i = 0; i < hz / 5; i++) rig.step(state(1), null, 1 / hz);
    return rig.smooth;
  });
  for (const key of Object.keys(outputs[0]))
    for (const other of outputs.slice(1))
      assert.ok(Math.abs(outputs[0][key] - other[key]) < 1e-10);
});
