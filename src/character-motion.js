// Presentation only. The detector, sound mappings and event timestamps are untouched.
import {
  POSES,
  composePose,
  mix,
  rehearsal,
  actingPreview,
} from "../public/mouth-prototype/rig.js";
export const APPROVED_RIG_SOURCE = "public/mouth-prototype/rig.js";
const clamp = (v) => Math.max(0, Math.min(1, v || 0));
export function gazeTarget(time, controls = {}) {
  const automatic = controls.gazeIdle ?? 1;
  return {
    x: (controls.gazeX || 0) * 9 + Math.sin(time * 0.28) * 8 * automatic,
    y: (controls.gazeY || 0) * 5 + Math.sin(time * 0.21) * 3.5 * automatic,
  };
}
export class CharacterMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.params = { ...POSES.closed, open: 0 };
    this.count = 0;
    this.last = -Infinity;
    this.speech = "closed";
    this.strength = 1;
    this.pupil = 0;
    this.gaze = { x: 0, y: 0, idle: 1 };
    this.lastTime = null;
  }
  step(state, controls = {}) {
    const time = state.time ?? 0,
      dt =
        this.lastTime == null
          ? 1 / 60
          : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    for (const event of state.events || [])
      if (event.kind === "mouth") {
        this.last = event.time;
        this.speech = ["o", "a", "e"][this.count++ % 3];
        this.strength = event.strength ?? 1;
      }
    const age = time - this.last;
    // A brief release on retrigger and a short pulse leave silence between notes.
    const ease = (x) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    };
    const pulse =
      age < 0.025
        ? 0
        : age < 0.065
          ? ease((age - 0.025) / 0.04)
          : age < 0.085
            ? 1
            : 1 - ease((age - 0.085) / 0.09);
    let speech = this.speech,
      opening = pulse * this.strength,
      emotion = controls.emotion ?? "none",
      affect = controls.affect ?? 1;
    if (controls.speech && controls.speech !== "animated") {
      speech = controls.speech;
      opening = controls.opening ?? 1;
    }
    if (controls.rehearsal) {
      const cue = rehearsal(time - controls.start);
      speech = cue.name;
      opening = cue.amount;
    }
    if (controls.demo) {
      const cue = actingPreview(time - controls.start);
      speech = "closed";
      emotion = cue.name;
      affect = cue.weight;
      opening = cue.opening;
    }
    const target = composePose(
      speech,
      controls.strength ?? 1,
      emotion,
      affect,
      opening,
    );
    const alpha = 1 - Math.exp(-dt / 0.025);
    for (const key of Object.keys(target))
      this.params[key] += (target[key] - this.params[key]) * alpha;
    const dilation = controls.pupil == null ? state.eyeAccent : controls.pupil;
    this.pupil += (clamp(dilation) - this.pupil) * (1 - Math.exp(-dt / 0.018));
    const gazeAlpha = 1 - Math.exp(-dt / 0.12);
    this.gaze.x += ((controls.gazeX ?? 0) - this.gaze.x) * gazeAlpha;
    this.gaze.y += ((controls.gazeY ?? 0) - this.gaze.y) * gazeAlpha;
    this.gaze.idle += ((controls.gazeIdle ?? 1) - this.gaze.idle) * gazeAlpha;
    return {
      params: { ...this.params },
      speech,
      opening,
      pupil: this.pupil,
      emotion,
      gazeX: this.gaze.x,
      gazeY: this.gaze.y,
      gazeIdle: this.gaze.idle,
      source: APPROVED_RIG_SOURCE,
      note: this.count,
    };
  }
}
