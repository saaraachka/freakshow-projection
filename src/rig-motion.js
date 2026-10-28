// Presentation-only, fixed-step smoothing. This never detects or schedules audio events.
export const RIG_POSES = Object.freeze({
  closed: { mouth: 0, width: 1, tongue: 0 },
  small: { mouth: 0.22, width: 1, tongue: 0 },
  wide: { mouth: 0.83, width: 1, tongue: 0 },
  round: { mouth: 0.7, width: 0.62, tongue: 0 },
  stretched: { mouth: 0.42, width: 1.12, tongue: 0 },
  tongue: { mouth: 0.9, width: 1, tongue: 1 },
  extreme: { mouth: 1, width: 1.04, tongue: 0 },
});
export class RigMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.fast = { mouth: 0, eye: 0, width: 1, tongue: 0 };
    this.smooth = { ...this.fast };
  }
  step(state, preview = null) {
    const pose =
      preview?.pose === "custom"
        ? { mouth: preview.amount, width: 1, tongue: 0 }
        : RIG_POSES[preview?.pose];
    const target = {
      mouth: pose?.mouth ?? state.mouthAccent,
      eye: state.eyeAccent,
      width: pose?.width ?? 1,
      tongue: pose?.tongue ?? 0,
    };
    for (const key of Object.keys(target)) {
      const alpha = 1 - Math.exp(-(1 / 60) / 0.025);
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
