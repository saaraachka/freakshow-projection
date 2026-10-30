const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t) => {
  t = clamp(t);
  return clamp(t * t * t * (10 + t * (-15 + 6 * t)));
};
export const GESTURES = {
  kick: {
    expression: "Angry",
    intensity: 1,
    cooldown: 0.13,
    head: { pulse: 0.012 },
  },
  snare: {
    expression: "Surprised",
    intensity: 1,
    cooldown: 0.15,
    head: { recoil: 0.03 },
  },
  clap: {
    expression: "Unhappy / creepy frown",
    intensity: 1,
    cooldown: 0.16,
    head: { tilt: 0.014 },
  },
  hat: { expression: "Eye twitch", intensity: 0.6, cooldown: 0.09, head: {} },
  melody: {
    expression: "Manic laughter",
    intensity: 1,
    cooldown: 0.18,
    head: { turn: 0.012 },
  },
};
export class FacialPerformance {
  constructor({ zero, constrain, presets }) {
    Object.assign(this, { zero, constrain, presets });
    this.mappings = structuredClone(GESTURES);
    this.envelope = { attack: 0.045, hold: 0.075, release: 0.18 };
    this.events = [];
    this.last = {};
    this.reset();
  }
  configure(kind, settings) {
    if (!this.mappings[kind]) return;
    const m = this.mappings[kind];
    if (
      settings.expression &&
      (settings.expression === "Eye twitch" ||
        settings.expression in this.presets)
    )
      m.expression = settings.expression;
    if (Number.isFinite(settings.intensity))
      m.intensity = clamp(settings.intensity);
    if (Number.isFinite(settings.cooldown))
      m.cooldown = clamp(settings.cooldown, 0, 2);
  }
  setEnvelope(settings) {
    for (const k of ["attack", "hold", "release"])
      if (Number.isFinite(settings[k]))
        this.envelope[k] = clamp(settings[k], k === "hold" ? 0 : 0.01, 2);
  }
  mix(a, b, w) {
    const q = this.zero();
    for (const k of Object.keys(q))
      q[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * w;
    return q;
  }
  baseAt(t) {
    if (!this.transition) return { ...this.base };
    const a = this.transition,
      w = ease((t - a.start) / a.duration),
      q = this.mix(a.from, a.to, w);
    if (w === 1) {
      this.base = { ...a.to };
      this.transition = null;
    }
    return q;
  }
  preset(pose, t, duration = 0.8) {
    const from = this.sample(t, false).pose;
    this.gesture = null;
    this.twitch = null;
    this.voices = [];
    this.transition = {
      from,
      to: this.constrain({ ...this.zero(), ...pose }),
      start: t,
      duration: Math.max(0.01, duration),
    };
  }
  reset() {
    this.base = this.zero();
    this.transition = null;
    this.gesture = null;
    this.twitch = null;
    this.voices = [];
    this.last = {};
  }
  trigger(kind, t, strength = 1, { manual = false } = {}) {
    const m = this.mappings[kind];
    if (!m || (!manual && t - (this.last[kind] ?? -100) < m.cooldown))
      return false;
    const from = this.sample(t, false).pose;
    const target =
      m.expression === "Eye twitch"
        ? { squint: 0.16, blink: 0.12 }
        : this.presets[m.expression];
    const amount = m.intensity * clamp(strength, 0.35, 1);
    if (m.expression === "Eye twitch") {
      this.twitch = { start: t, amount, ...this.envelope };
      this.last[kind] = t;
      this.events.push({
        kind,
        time: t,
        expression: m.expression,
        intensity: amount,
      });
      if (this.events.length > 120) this.events.shift();
      return true;
    }
    this.gesture = {
      kind,
      start: t,
      from,
      to: this.constrain(this.mix(this.zero(), target || {}, amount)),
      amount,
      ...this.envelope,
      head: m.head,
    };
    this.last[kind] = t;
    this.transition = null;
    this.base = this.zero();
    this.voices = [this.gesture]; // One dominant expression; never stack presets.
    this.events.push({
      kind,
      time: t,
      expression: m.expression,
      intensity: amount,
    });
    if (this.events.length > 120) this.events.shift();
    return true;
  }
  sample(t, idle = true) {
    let q = this.baseAt(t);
    const head = { pulse: 0, recoil: 0, tilt: 0, turn: 0 },
      g = this.gesture;
    if (g) {
      const age = Math.max(0, t - g.start);
      let e = 1;
      if (age < g.attack) {
        e = ease(age / g.attack);
        q = this.mix(g.from, g.to, e);
      } else if (age < g.attack + g.hold) q = { ...g.to };
      else {
        e = 1 - ease((age - g.attack - g.hold) / g.release);
        q = this.mix(this.zero(), g.to, e);
      }
      for (const [k, v] of Object.entries(g.head)) head[k] = v * e * g.amount;
      if (age >= g.attack + g.hold + g.release) {
        this.gesture = null;
        this.voices = [];
        q = this.zero();
      }
    }
    if (this.twitch) {
      const g = this.twitch,
        a = t - g.start;
      const e =
        a < g.attack
          ? ease(a / g.attack)
          : a < g.attack + g.hold
            ? 1
            : 1 - ease((a - g.attack - g.hold) / g.release);
      q.squint = Math.max(q.squint || 0, 0.16 * e * g.amount);
      q.blink = Math.max(q.blink || 0, 0.12 * e * g.amount);
      if (a >= g.attack + g.hold + g.release) this.twitch = null;
    }
    if (idle) {
      q.gazeX = 0.25 * Math.sin(t * 0.17);
      q.gazeY = 0.12 * Math.sin(t * 0.13);
    }
    return { pose: this.constrain(q), head };
  }
}
// Deterministic, wall-clock sequencer: no timers are queued while rendering stalls.
export class Rehearsal {
  constructor() {
    this.stop();
  }
  stop() {
    this.running = false;
  }
  start(mode, t, bpm = 120) {
    this.mode = mode;
    this.running = true;
    this.next = t;
    this.step = 0;
    this.interval = 60 / bpm / (mode === "stress" ? 4 : 2);
  }
  advance(t, { claps = true, hats = true } = {}) {
    if (!this.running || t < this.next) return [];
    if (t - this.next > this.interval * 2) this.next = t; // Skip stale beats, never burst a backlog.
    const n = this.step++,
      time = this.next;
    this.next += this.interval;
    let kind;
    if (this.mode === "melody") kind = n % 2 === 0 ? "melody" : null;
    else if (this.mode === "stress")
      kind = ["kick", "snare", "clap", "melody"][n % 4];
    else
      kind =
        n % 8 === 0 || n % 8 === 4
          ? "kick"
          : n % 8 === 2 || n % 8 === 6
            ? claps && n % 8 === 6
              ? "clap"
              : "snare"
            : hats
              ? "hat"
              : null;
    return kind ? [{ kind, time, strength: 1 }] : [];
  }
}
