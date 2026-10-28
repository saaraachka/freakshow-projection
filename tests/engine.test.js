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
  assert.equal(
    events.filter((e) => e.kind === "mouth" && e.time < 1).length,
    0,
    "isolated low kick must not trigger melody reaction",
  );
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

test("separate close melody notes, ignore bright ticks, scale kicks: varied pitches and levels", () => {
  for (const [pitch, gain] of [
    [330, 0.2],
    [560, 0.5],
    [920, 0.8],
  ]) {
    const recipe = {
      sampleRate: 44100,
      duration: 4,
      tones: [
        { start: 0.2, end: 0.25, frequency: 6000, amplitude: 0.5 },
        { start: 0.55, end: 0.6, frequency: 6800, amplitude: 0.5 },
        ...[1, 1.3, 1.6].map((start, i) => ({
          start,
          end: start + 0.22,
          frequency: pitch * (1 + i * 0.12),
          amplitude: gain,
        })),
        { start: 2.2, end: 2.3, frequency: 70, amplitude: 0.07 },
        { start: 3, end: 3.1, frequency: 70, amplitude: 0.7 },
      ],
    };
    const output = simulate(analyzePCM(synthesize(recipe))),
      events = output.flatMap((f) => f.events);
    const expected = [
      { time: 0.22, kind: "ignore" },
      { time: 0.57, kind: "ignore" },
      ...[1, 1.3, 1.6].map((time) => ({ time, kind: "mouth" })),
      { time: 2.2, kind: "eye" },
      { time: 3, kind: "eye" },
    ];
    assert.deepEqual(
      evaluateAnnotations(events, expected, 0.05).filter((r) => !r.pass),
      [],
      `pitch ${pitch}, level ${gain}`,
    );
    for (const time of [1, 1.3, 1.6])
      assert.equal(
        events.filter(
          (e) => e.kind === "mouth" && Math.abs(e.time - time) < 0.09,
        ).length,
        1,
      );
    for (const time of [1.28, 1.58, 1.88])
      assert.equal(
        output[Math.round(time * 60)].mouthAccent,
        0,
        "mouth closes between successive notes",
      );
    const kicks = events.filter((e) => e.kind === "eye");
    assert.ok(kicks[1].strength > kicks[0].strength * 2);
    assert.equal(
      output.at(-1).bassDrive,
      0,
      "resting eye size is independent of loudness",
    );
  }
});
test("sound mappings apply to new timings, not scheduled timestamps", () => {
  const sequence = [...features, ...features];
  const rules = [
    { source: "lead", target: "ignore", reaction: "smooth", drama: "subtle" },
    { source: "kick", target: "mouth", reaction: "snap", drama: "dramatic" },
  ];
  const output = simulate(sequence, { rules }),
    events = output.flatMap((f) => f.events);
  assert.equal(events.filter((e) => e.kind === "eye").length, 0);
  assert.equal(events.filter((e) => e.source === "lead").length, 0);
  assert.ok(
    events.some((e) => e.source === "kick" && e.time > 4),
    "mapping generalizes to repeated sound at a new time",
  );
  assert.ok(
    output
      .flatMap((f) => f.detections)
      .some((d) => d.source === "lead" && d.ignored),
    "ignored sounds remain observable",
  );
});
test("microphone windows and recorded analysis produce identical features and events", async () => {
  const { FeatureExtractor, FFT_SIZE, SAMPLE_RATE } = await import(
    "../src/analysis.js"
  );
  const pcm = synthesize(fixture),
    extractor = new FeatureExtractor(SAMPLE_RATE),
    live = [];
  for (let end = 0; end < pcm.length; end += 735) {
    const window = new Float32Array(FFT_SIZE);
    for (let j = 0; j < FFT_SIZE; j++) {
      const at = end - FFT_SIZE + j;
      if (at >= 0) window[j] = pcm[at] || 0;
    }
    live.push(extractor.process(window));
  }
  assert.deepEqual(live, analyzePCM(pcm));
  assert.deepEqual(simulate(live), simulate(analyzePCM(pcm)));
});

test("ignored hi-hats produce no audio-driven expression or hair motion", () => {
  const pcm = synthesize({
    duration: 1,
    sampleRate: 44100,
    tones: [{ start: 0.2, end: 0.26, frequency: 6000, amplitude: 0.8 }],
  });
  const output = simulate(analyzePCM(pcm));
  assert.ok(
    output
      .flatMap((f) => f.detections)
      .some((d) => d.source === "bright" && d.ignored),
  );
  assert.ok(
    output.every(
      (f) =>
        f.events.length === 0 &&
        f.eyeAccent === 0 &&
        f.mouthAccent === 0 &&
        f.clownHair === 0,
    ),
  );
});
test("legato pitch changes are detected even when band loudness barely changes", () => {
  const recipe = {
    duration: 2.5,
    sampleRate: 44100,
    tones: [
      { start: 0.5, end: 0.8, frequency: 440, amplitude: 0.45 },
      { start: 0.8, end: 1.1, frequency: 554, amplitude: 0.45 },
      { start: 1.1, end: 1.4, frequency: 659, amplitude: 0.45 },
    ],
  };
  const output = simulate(analyzePCM(synthesize(recipe)));
  const events = output.flatMap((f) => f.events);
  assert.deepEqual(
    evaluateAnnotations(
      events,
      [0.5, 0.8, 1.1].map((time) => ({ time, kind: "mouth" })),
      0.06,
    ).filter((r) => !r.pass),
    [],
  );
});
