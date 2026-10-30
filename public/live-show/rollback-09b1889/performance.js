const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t) => {
  t = clamp(t);
  return t * t * t * (10 + t * (-15 + 6 * t));
};
export const GESTURES = {
  kick: {
    attack: 0.025,
    hold: 0.025,
    release: 0.18,
    pose: { jawOpen: 1.4, eyeOpen: 0.4, browAnger: 0.12 },
    head: { pulse: 0.012 },
  },
  snare: {
    attack: 0.025,
    hold: 0.035,
    release: 0.22,
    pose: { jawOpen: 3.8, browRaise: 0.55, innerRaise: 0.15, eyeOpen: 0.25 },
    head: { recoil: 0.03 },
  },
  clap: {
    attack: 0.025,
    hold: 0.035,
    release: 0.18,
    pose: {
      jawOpen: 0.8,
      cornerLeft: 0.35,
      cornerRight: 0.08,
      cheekRaise: 0.4,
      browLeft: 0.25,
    },
    head: { tilt: 0.014 },
  },
  hat: {
    attack: 0.018,
    hold: 0.01,
    release: 0.12,
    pose: { squint: 0.1, browRaise: 0.025 },
    head: {},
  },
  melody: {
    attack: 0.055,
    hold: 0.05,
    release: 0.25,
    pose: {
      jawOpen: 4.2,
      browRaise: 0.28,
      browRelax: 0.12,
      upperLipRaise: 0.12,
    },
    head: { turn: 0.01 },
  },
};
export class FacialPerformance {
  constructor({ zero, constrain, presets }) {
    this.zero = zero;
    this.constrain = constrain;
    this.presets = presets;
    this.base = zero();
    this.transition = null;
    this.voices = [];
    this.events = [];
  }
  baseAt(t) {
    if (!this.transition) return { ...this.base };
    const a = this.transition,
      w = ease((t - a.start) / a.duration),
      q = this.zero();
    for (const k of Object.keys(q))
      q[k] = a.from[k] + (a.to[k] - a.from[k]) * w;
    if (w === 1) {
      this.base = { ...a.to };
      this.transition = null;
    }
    return q;
  }
  preset(pose, t, duration = 0.8) {
    this.transition = {
      from: this.sample(t, false).pose,
      to: this.constrain({ ...this.zero(), ...pose }),
      start: t,
      duration: Math.max(0.08, duration),
    };
    this.voices = [];
  }
  reset() {
    this.base = this.zero();
    this.transition = null;
    this.voices = [];
  }
  trigger(kind, t, strength = 1) {
    const g = GESTURES[kind];
    if (!g) return;
    // Repeated melodic notes have a short release/separation before reattack.
    let delay = 0;
    if (
      kind === "melody" &&
      this.voices.some((v) => v.kind === kind && t - v.start < 0.4)
    ) {
      for (const v of this.voices) if (v.kind === kind) v.cut = t + 0.025;
      delay = 0.045;
    }
    this.voices.push({
      kind,
      start: t + delay,
      strength: clamp(strength, 0.25, 1),
      cut: Infinity,
    });
    if (this.voices.length > 24) this.voices.shift();
    this.events.push({ kind, time: t });
    if (this.events.length > 120) this.events.shift();
  }
  sample(t, idle = true) {
    const q = this.baseAt(t),
      head = { pulse: 0, recoil: 0, tilt: 0, turn: 0 };
    this.voices = this.voices.filter(
      (v) =>
        t <
        Math.min(
          v.cut,
          v.start +
            GESTURES[v.kind].attack +
            GESTURES[v.kind].hold +
            GESTURES[v.kind].release,
        ),
    );
    for (const v of this.voices) {
      const g = GESTURES[v.kind],
        age = t - v.start;
      if (age < 0) continue;
      let e =
        age < g.attack
          ? ease(age / g.attack)
          : age < g.attack + g.hold
            ? 1
            : 1 - ease((age - g.attack - g.hold) / g.release);
      if (v.cut < Infinity) e *= clamp((v.cut - t) / 0.025);
      e *= v.strength;
      for (const [k, val] of Object.entries(g.pose))
        q[k] = Math.max(q[k] || 0, val * e);
      for (const [k, val] of Object.entries(g.head))
        head[k] = Math.max(head[k], val * e);
    }
    if (idle) {
      q.gazeX = 0.25 * Math.sin(t * 0.17);
      q.gazeY = 0.12 * Math.sin(t * 0.13);
      const phase = t % 11;
      if (phase < 3.5) {
        const e = Math.sin((Math.PI * phase) / 3.5) ** 2;
        q.cornerLeft = Math.max(q.cornerLeft || 0, 0.025 * e);
        q.browRight = Math.max(q.browRight || 0, 0.018 * e);
      }
    }
    return { pose: this.constrain(q), head };
  }
}
