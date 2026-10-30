const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * x * (10 + x * (-15 + 6 * x));
};
export class EyePulse {
  constructor() {
    this.attack = 0.05;
    this.release = 0.26;
    this.intensity = 0.8;
    this.state = null;
  }
  sample(t) {
    if (!this.state) return 0;
    const s = this.state,
      a = Math.max(0, t - s.time);
    return a < this.attack
      ? s.from + (s.peak - s.from) * ease(a / this.attack)
      : s.peak * (1 - ease((a - this.attack) / this.release));
  }
  trigger(t, strength = 1) {
    const from = this.sample(t);
    this.state = {
      time: t,
      from,
      peak: Math.max(from, clamp(strength) * clamp(this.intensity)),
    };
  }
  reset() {
    this.state = null;
  }
}
