// Shared causal sound-onset detector and v4-derived expression envelopes at 60 Hz.
export const STEP = 1 / 60;
export const DEFAULTS = {
  selectivity: "selective",
  motion: "smooth",
  exaggeration: "extreme",
  idle: "haunt",
  scene: "clown",
  palette: "cream",
  flash: true,
  rules: [],
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
export class Engine {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.reset();
  }
  reset() {
    this.prev = { bass: 0, mid: 0 };
    this.at = { eye: -1e6, mouth: -1e6 };
    this.levels = { bass: 0, mid: 0, high: 0, volume: 0 };
    this.bassDrive = 0;
    this.midDrive = 0;
    this.hair = 0;
    this.events = [];
    this.lastCandidate = { kick: -1e6, lead: -1e6, bright: -1e6 };
    this.expression = {
      eye: { strength: 1, shape: this.options.motion, duration: 0.52 },
      mouth: { strength: 1, shape: this.options.motion, duration: 0.71 },
    };
  }
  trigger(kind, time, expression = null) {
    this.expression[kind] = expression || {
      strength: 1,
      shape: this.options.motion,
      duration: kind === "eye" ? 0.52 : 0.71,
    };
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
    const detections = [];
    const modern = Number.isFinite(target.bassFlux);
    for (const [source, band] of [
      ["kick", "bass"],
      ["lead", "mid"],
      ["bright", "high"],
    ]) {
      const v = target[band] || 0,
        previous = this.prev[band] || 0;
      const flux = modern ? target[band + "Flux"] : Math.max(0, v - previous);
      const floor = { frequent: 0.007, selective: 0.014, rare: 0.03 }[
        this.options.selectivity
      ];
      const coherent =
        source !== "lead" ||
        !modern ||
        (target.tonal > 0.1 &&
          v > (target.high || 0) * 0.55 &&
          v > (target.bass || 0) * 0.65);
      const isolated = source !== "kick" || v > (target.high || 0) * 0.25;
      const onset =
        v > floor &&
        v >= previous * 0.8 && // Reject spectral changes caused by a note ending.
        flux > Math.max(floor * 0.5, v * 0.14) &&
        coherent &&
        isolated;
      if (onset && time - this.lastCandidate[source] > 0.14) {
        this.lastCandidate[source] = time;
        const rule = this.options.rules?.find((r) => r.source === source);
        const kind =
          rule?.target ||
          (source === "kick" ? "eye" : source === "lead" ? "mouth" : "ignore");
        const candidate = {
          source,
          time,
          kind,
          energy: v,
          ignored: kind === "ignore",
        };
        detections.push(candidate);
        if (!candidate.ignored) {
          const strength =
            source === "kick"
              ? Math.min(1, 0.16 + v * 2)
              : Math.min(1, 0.5 + v);
          const expression = {
            strength:
              strength *
              ({ subtle: 0.35, dramatic: 0.72, extreme: 1 }[rule?.drama] || 1),
            shape: rule?.reaction || this.options.motion,
            duration: source === "lead" ? 0.25 : 0.24,
          };
          const event = this.trigger(kind, time, expression);
          event.source = source;
          event.strength = expression.strength;
          events.push(event);
        }
      }
      this.prev[band] = v;
    }
    for (const kind of manual) events.push(this.trigger(kind, time));
    // Resting sockets remain small: audio changes transient amplitude, not resting size.
    this.bassDrive = 0;
    this.midDrive = 0;
    // Ignored bright sounds do not drive hair; its autonomous motion lives in the renderer.
    this.hair = 0;
    const scale = { subtle: 0.4, dramatic: 0.72, extreme: 1 }[
      this.options.exaggeration
    ];
    return {
      time,
      events,
      detections,
      levels: { ...this.levels },
      bassDrive: this.bassDrive * scale,
      midDrive: this.midDrive * scale,
      clownHair: this.hair,
      eyeAccent:
        envelope(
          time - this.at.eye,
          this.expression.eye.duration,
          this.expression.eye.shape,
        ) *
        scale *
        this.expression.eye.strength,
      mouthAccent:
        envelope(
          time - this.at.mouth,
          this.expression.mouth.duration,
          this.expression.mouth.shape,
        ) *
        scale *
        this.expression.mouth.strength,
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
