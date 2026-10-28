// V4 thresholds, adaptive baselines and envelopes, advanced at a fixed 60 Hz.
export const STEP = 1 / 60;
export const DEFAULTS = {
  selectivity: "selective",
  motion: "smooth",
  exaggeration: "extreme",
  idle: "haunt",
  scene: "clown",
  palette: "cream",
  flash: true,
};
export function envelope(age, duration, mode) {
  if (age < 0 || age > duration) return 0;
  if (mode === "snap") {
    if (age < 0.065) return age / 0.065;
    if (age < duration * 0.65) return 1;
    return Math.max(0, (duration - age) / (duration * 0.35));
  }
  if (mode === "spring") {
    const x = age / duration;
    return Math.max(0, Math.exp(-3.4 * x) * (1.1 * Math.sin(x * 11) + 0.42));
  }
  const x = age / duration;
  return Math.max(0, Math.min(1, x / 0.23, (1 - x) / 0.64));
}
const approach = (v, target, attack, release) =>
  v + (target - v) * (1 - Math.exp(-STEP / (target > v ? attack : release)));
export class Engine {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.reset();
  }
  reset() {
    this.base = { bass: 0.12, mid: 0.12 };
    this.dev = { bass: 0.06, mid: 0.06 };
    this.prev = { bass: 0, mid: 0 };
    this.at = { eye: -1e6, mouth: -1e6 };
    this.levels = { bass: 0, mid: 0, high: 0, volume: 0 };
    this.bassDrive = 0;
    this.midDrive = 0;
    this.hair = 0;
    this.events = [];
  }
  trigger(kind, time) {
    this.at[kind] = time;
    const event = { kind, time };
    this.events.push(event);
    return event;
  }
  step(target, time, manual = []) {
    const events = [];
    for (const k of ["bass", "mid", "high"])
      this.levels[k] +=
        (target[k] - this.levels[k]) *
        (target[k] > this.levels[k] ? 0.7 : 0.38);
    this.levels.volume =
      (this.levels.bass + this.levels.mid + this.levels.high) / 3;
    for (const band of ["bass", "mid"]) {
      const v = this.levels[band],
        base = this.base[band],
        dev = this.dev[band],
        select = this.options.selectivity,
        kind = band === "bass" ? "eye" : "mouth";
      const factor =
        select === "rare" ? 1.6 : select === "frequent" ? 0.5 : 0.85;
      if (
        v > Math.max(0.075, base + dev * factor) &&
        v - this.prev[band] >
          (select === "rare" ? 0.026 : select === "frequent" ? 0.008 : 0.014) &&
        time - this.at[kind] > (band === "bass" ? 0.18 : 0.26)
      )
        events.push(this.trigger(kind, time));
      this.base[band] += (v - base) * (v > base ? 0.003 : 0.012);
      this.dev[band] += (Math.abs(v - base) - dev) * 0.008;
      this.prev[band] = v;
    }
    for (const kind of manual) events.push(this.trigger(kind, time));
    this.bassDrive = approach(
      this.bassDrive,
      Math.min(1, this.levels.bass * 1.6),
      0.042,
      0.155,
    );
    this.midDrive = approach(
      this.midDrive,
      Math.min(1, this.levels.mid * 1.55),
      0.065,
      0.205,
    );
    this.hair = approach(this.hair, this.levels.high * 0.1, 0.075, 0.24);
    const scale = { subtle: 0.4, dramatic: 0.72, extreme: 1 }[
      this.options.exaggeration
    ];
    return {
      time,
      events,
      levels: { ...this.levels },
      bassDrive: this.bassDrive * scale,
      midDrive: this.midDrive * scale,
      clownHair: this.hair,
      eyeAccent:
        envelope(
          time - this.at.eye,
          this.options.motion === "smooth" ? 0.52 : 0.36,
          this.options.motion,
        ) * scale,
      mouthAccent:
        envelope(
          time - this.at.mouth,
          this.options.motion === "smooth" ? 0.71 : 0.47,
          this.options.motion,
        ) * scale,
      beat: Math.max(0, 1 - (time - this.at.eye) / 0.2),
    };
  }
}
export function simulate(features, options) {
  const engine = new Engine(options);
  return features.map((f, i) => engine.step(f, i * STEP));
}
// Match each expectation one-to-one; ignore marks assert that neither event fires.
export function evaluateAnnotations(events, annotations, tolerance = 0.15) {
  const used = new Set();
  return annotations.map((a) => {
    const annotationTime = a.time;
    const matches = events
      .map((e, i) => ({ ...e, i }))
      .filter(
        (e) =>
          Math.abs(e.time - a.time) <= tolerance &&
          (a.kind === "ignore" || e.kind === a.kind),
      )
      .sort(
        (a, b) =>
          Math.abs(a.time - annotationTime) - Math.abs(b.time - annotationTime),
      );
    const match = matches.find((e) => !used.has(e.i));
    if (a.kind === "ignore")
      return {
        ...a,
        pass: matches.length === 0,
        actual: matches.map((e) => e.kind).join(", ") || "quiet",
      };
    if (match) used.add(match.i);
    return { ...a, pass: !!match, actual: match ? match.time : null };
  });
}
