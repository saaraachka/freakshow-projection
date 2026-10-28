import { CharacterMotion } from "./character-motion.js";
// Presentation only: no audio detection or scheduling changes.
export const RIG_POSES = Object.freeze({
  closed: {
    mouth: 0,
    span: 112,
    top: 325,
    bottom: 325,
    corner: 326,
    curl: 1,
    bow: 2,
    cheek: 0.9,
    jaw: 0,
    jawWidth: 0,
  },
  o: {
    mouth: 0.66,
    span: 57,
    top: 310,
    bottom: 363,
    corner: 331,
    curl: 16,
    bow: 0,
    cheek: 1.05,
    jaw: 5,
    jawWidth: -2,
  },
  a: {
    mouth: 0.82,
    span: 112,
    top: 313,
    bottom: 376,
    corner: 329,
    curl: 5,
    bow: 2,
    cheek: 0.95,
    jaw: 9,
    jawWidth: 1,
  },
  e: {
    mouth: 0.42,
    span: 147,
    top: 322,
    bottom: 348,
    corner: 328,
    curl: 1,
    bow: 0,
    cheek: 0.8,
    jaw: 2,
    jawWidth: 3,
  },
  grin: {
    mouth: 0.54,
    span: 152,
    top: 321,
    bottom: 355,
    corner: 311,
    curl: 0,
    bow: -5,
    cheek: 0.84,
    jaw: 3,
    jawWidth: 4,
  },
  scream: {
    mouth: 1,
    span: 124,
    top: 302,
    bottom: 385,
    corner: 331,
    curl: 12,
    bow: 1,
    cheek: 1.1,
    jaw: 12,
    jawWidth: -1,
  },
});
export function interpolatePose(a, b, t) {
  t = Math.max(0, Math.min(1, t || 0));
  return Object.fromEntries(
    Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * t]),
  );
}
// Three visual notes with deliberate silence; this never enters the audio engine.
export function rehearsalPreview(elapsed) {
  const t = ((elapsed % 3.6) + 3.6) % 3.6;
  const note = Math.min(2, Math.floor(t / 0.9)),
    local = t - note * 0.9;
  const ease = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  const strength =
    local < 0.12
      ? ease(local / 0.12)
      : local < 0.24
        ? 1
        : 1 - ease((local - 0.24) / 0.18);
  return { pose: ["o", "a", "e"][note], strength };
}
export class RigMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.character = new CharacterMotion();
    this.fast = {
      ...RIG_POSES.closed,
      eye: 0,
      gazeX: 0,
      gazeY: 0,
      gazeIdle: 1,
    };
    this.smooth = { ...this.fast };
  }
  step(state, preview = null, dt = 1 / 60) {
    const pose =
      preview?.pose === "custom"
        ? interpolatePose(RIG_POSES.closed, RIG_POSES.a, preview.amount)
        : RIG_POSES[preview?.pose];
    const target = {
      ...(pose
        ? interpolatePose(RIG_POSES.closed, pose, preview?.strength ?? 1)
        : interpolatePose(RIG_POSES.closed, RIG_POSES.a, state.mouthAccent)),
      eye: preview?.pupil == null ? state.eyeAccent : preview.pupil,
      gazeX: preview?.gazeX ?? 0,
      gazeY: preview?.gazeY ?? 0,
      gazeIdle: preview?.gazeIdle ?? 1,
    };
    // Exact solution for two cascaded filters: smooth and independent of display rate.
    const h = Math.max(0, Math.min(0.1, dt)) / 0.025,
      decay = Math.exp(-h);
    for (const key of Object.keys(target)) {
      const previous = this.fast[key] - target[key];
      this.fast[key] = target[key] + previous * decay;
      this.smooth[key] =
        target[key] + (this.smooth[key] - target[key] + previous * h) * decay;
    }
    return {
      ...state,
      rig: { ...this.smooth },
      anatomy: this.character.step(state, preview?.anatomy ?? {}),
    };
  }
}
export function addRigMotion(frames, presentation = null) {
  const rig = new RigMotion();
  return frames.map((frame) =>
    rig.step(frame, presentation ? { anatomy: presentation } : null),
  );
}
