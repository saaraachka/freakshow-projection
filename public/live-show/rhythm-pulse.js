import { EyePulse } from "./eye-pulse.js?release=head-6";
// One event gate owns both envelopes. No face/controller state is touched here.
export class RhythmPulse {
  constructor(eyes) {
    this.eyes = eyes;
    this.head = new EyePulse();
    this.head.intensity = 1;
    this.last = -Infinity;
    this.events = 0;
    this.configure();
  }
  configure() {
    for (const p of [this.eyes, this.head]) {
      p.attack = 0.05;
      p.release = 0.28;
    }
  }
  trigger(t, strength = 1) {
    // A late kick and the fallback clock may describe the same beat. Keep the
    // already-running impact instead of restarting its attack a second time.
    if (t - this.last < 0.09) return false;
    this.configure();
    this.last = t;
    this.head.trigger(t, 1);
    this.eyes.trigger(t, strength);
    this.events++;
    return true;
  }
  scale(t, intensity = 0.04) {
    return 1 + intensity * this.head.sample(t);
  }
  reset() {
    this.head.reset();
    this.eyes.reset();
    this.last = -Infinity;
  }
}
