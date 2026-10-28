import test from "node:test";
import assert from "node:assert/strict";
import { analyzePCM } from "../src/analysis.js";
import { simulate } from "../src/engine.js";
import { addRigMotion } from "../src/rig-motion.js";
import { synthesize } from "./helpers.js";
import { CharacterMotion, gazeTarget } from "../src/character-motion.js";
const melody = {
  duration: 1.7,
  sampleRate: 44100,
  tones: [0.3, 0.6, 0.9].map((start, i) => ({
    start,
    end: start + 0.13,
    frequency: [440, 554, 659][i],
    amplitude: 0.65,
  })),
};
const raw = simulate(analyzePCM(synthesize(melody))),
  before = structuredClone(raw),
  posed = addRigMotion(raw);
test("detected notes create three different mesh articulations with closures, preserving detector output", () => {
  const notes = raw.flatMap((f) => f.events).filter((e) => e.kind === "mouth");
  assert.equal(notes.length, 3);
  assert.deepEqual(raw, before);
  assert.deepEqual(
    posed.map((f) => f.events),
    raw.map((f) => f.events),
  );
  assert.deepEqual(
    posed.map((f) => f.detections),
    raw.map((f) => f.detections),
  );
  const peaks = notes.map((e) =>
    posed
      .filter((f) => f.time >= e.time && f.time < e.time + 0.18)
      .reduce((a, b) =>
        a.anatomy.params.open > b.anatomy.params.open ? a : b,
      ),
  );
  assert.deepEqual(
    peaks.map((f) => f.anatomy.speech),
    ["o", "a", "e"],
  );
  assert.ok(peaks.every((f) => f.anatomy.params.open > 0.25));
  assert.ok(
    peaks[0].anatomy.params.width < peaks[1].anatomy.params.width &&
      peaks[1].anatomy.params.width < peaks[2].anatomy.params.width,
  );
  for (let i = 0; i < notes.length; i++) {
    const frames = posed.filter(
      (f) => f.time > notes[i].time + 0.23 && f.time < notes[i].time + 0.28,
    );
    assert.ok(
      frames.some((f) => f.anatomy.params.open < 0.025),
      "close before next note",
    );
  }
  assert.deepEqual(
    addRigMotion(simulate(analyzePCM(synthesize(melody)))),
    posed,
    "replay and seeking are deterministic",
  );
});
test("remapped or ignored sounds keep their existing routing", () => {
  const features = analyzePCM(synthesize(melody));
  const ignored = simulate(features, {
    rules: [{ source: "lead", target: "ignore" }],
  });
  assert.ok(addRigMotion(ignored).every((f) => f.anatomy.note === 0));
  const mapped = simulate(features, {
    rules: [{ source: "lead", target: "eye" }],
  });
  assert.ok(addRigMotion(mapped).every((f) => f.anatomy.note === 0));
  assert.ok(mapped.some((f) => f.eyeAccent > 0));
});
test("pupil dilation returns to rest and does not alter the shared gaze", () => {
  const motion = new CharacterMotion();
  let frame;
  for (let i = 0; i < 90; i++)
    frame = motion.step({
      time: i / 60,
      eyeAccent: i < 10 ? 1 : 0,
      events: [],
    });
  assert.ok(frame.pupil < 0.0001);
  const resting = gazeTarget(9, { gazeIdle: 1, pupil: 0 }),
    dilated = gazeTarget(9, { gazeIdle: 1, pupil: 1 });
  assert.deepEqual(resting, dilated);
});
