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
export class RigMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.fast = {
      ...RIG_POSES.closed,
      eye: 0,
      gazeX: 0,
      gazeY: 0,
      gazeIdle: 1,
    };
    this.smooth = { ...this.fast };
  }
  step(state, preview = null) {
    const pose =
      preview?.pose === "custom"
        ? interpolatePose(RIG_POSES.closed, RIG_POSES.a, preview.amount)
        : RIG_POSES[preview?.pose];
    const target = {
      ...(pose ??
        interpolatePose(RIG_POSES.closed, RIG_POSES.a, state.mouthAccent)),
      eye: preview?.pupil == null ? state.eyeAccent : preview.pupil,
      gazeX: preview?.gazeX ?? 0,
      gazeY: preview?.gazeY ?? 0,
      gazeIdle: preview?.gazeIdle ?? 1,
    };
    const alpha = 1 - Math.exp(-(1 / 60) / 0.025);
    for (const key of Object.keys(target)) {
      this.fast[key] += (target[key] - this.fast[key]) * alpha;
      this.smooth[key] += (this.fast[key] - this.smooth[key]) * alpha;
    }
    return { ...state, rig: { ...this.smooth } };
  }
}
export function addRigMotion(frames) {
  const rig = new RigMotion();
  return frames.map((frame) => rig.step(frame));
}
