import { FacialPerformance, ease } from "./performance.js?release=ink-5";
import { BeatClock, TempoTracker } from "./beat.js?release=ink-5";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ACCENTS = {
  kick: {
    pose: { eyeOpen: 0.18 },
    head: { pulse: 0.009 },
    attack: 0.025,
    hold: 0.025,
    release: 0.16,
  },
  snare: {
    pose: { browRaise: 0.12, jawOpen: 0.65 },
    head: { recoil: 0.014 },
    attack: 0.025,
    hold: 0.035,
    release: 0.18,
  },
  clap: {
    pose: { cheekRaise: 0.08, browLeft: 0.08, cornerLeft: 0.035 },
    head: { tilt: 0.008 },
    attack: 0.025,
    hold: 0.025,
    release: 0.14,
  },
  hat: {
    pose: { blink: 0.05 },
    head: {},
    attack: 0.02,
    hold: 0.01,
    release: 0.09,
  },
  melody: {
    pose: { jawOpen: 0.9, upperLipRaise: 0.025 },
    head: { turn: 0.005 },
    attack: 0.045,
    hold: 0.04,
    release: 0.22,
  },
};
function envelope(v, t) {
  const a = Math.max(0, t - v.start),
    g = ACCENTS[v.kind];
  return a < g.attack
    ? v.from + (v.strength - v.from) * ease(a / g.attack)
    : a < g.attack + g.hold
      ? v.strength
      : v.strength * (1 - ease((a - g.attack - g.hold) / g.release));
}
export class MusicalPerformance extends FacialPerformance {
  constructor(options, time = 0) {
    super(options);
    this.limits = options.controls;
    this.beatClock = new BeatClock(135, time);
    this.tracker = new TempoTracker();
    this.mode = "beat";
    this.automatic = true;
    Object.defineProperties(this, {
      mode: { get: () => "beat", set: () => {}, enumerable: true },
      phraseBeats: { get: () => 2, set: () => {}, enumerable: true },
      transitionBeats: { get: () => 1, set: () => {}, enumerable: true },
    });
    this.accentIntensity = 0.6;
    this.energy = 0.3;
    this.energyTime = null;
    this.accents = [];
    this.sequenceIndex = 0;
    this.lastPhrase = 0;
    this.currentExpression = "Default sinister grin";
    this.optionalNeutral = false;
    this.optionalSurprised = false;
    this.random = false;
    this.seed = 1729;
  }
  reset() {
    super.reset();
    this.accents = [];
    this.phraseTransition = null;
    this.automatic = false;
    this.lastAccent = {};
    this.currentExpression = "Default sinister grin";
  }
  start(t, blend = false) {
    const from = this.baseAt(t);
    this.beatClock.resync(t);
    this.automatic = true;
    this.lastPhrase = 0;
    this.sequenceIndex = 0;
    this.currentExpression = "Default sinister grin";
    this.transition = null;
    this.base = this.zero();
    this.phraseTransition = blend
      ? { from, to: this.zero(), start: 0, duration: this.transitionBeats }
      : null;
  }
  setMode(mode, t) {
    const pose = this.sample(t, false).pose;
    super.reset();
    this.base = pose;
    this.accents = [];
    this.phraseTransition = null;
    this.mode = "beat";
    this.automatic = false;
    this.start(t, true);
  }
  sequence() {
    return [
      "Default sinister grin",
      "Angry",
      "Unhappy / creepy frown",
      "Manic laughter",
      ...(this.optionalSurprised ? ["Surprised"] : []),
      ...(this.optionalNeutral ? ["Neutral"] : []),
    ];
  }
  baseAt(t) {
    if (!this.phraseTransition) return super.baseAt(t);
    const a = this.phraseTransition,
      w = ease((this.beatClock.at(t) - a.start) / a.duration),
      q = this.mix(a.from, a.to, w);
    if (w === 1) {
      this.base = { ...a.to };
      this.phraseTransition = null;
    }
    return q;
  }
  preset(pose, t, duration = 0.8) {
    if (!this.beatClock) return super.preset(pose, t, duration);
    const from = this.baseAt(t);
    this.automatic = false;
    this.phraseTransition = null;
    this.gesture = null;
    this.twitch = null;
    this.accents = [];
    this.voices = [];
    this.transition = null;
    this.phraseTransition = {
      from,
      to: this.constrain({ ...this.zero(), ...pose }),
      start: this.beatClock.at(t),
      duration: 1,
    };
    this.currentExpression =
      Object.keys(this.presets).find(
        (k) => JSON.stringify(this.presets[k]) === JSON.stringify(pose),
      ) || "Manual pose";
  }
  clearAccents() {
    this.accents = [];
    this.gesture = null;
    this.twitch = null;
    this.voices = [];
  }
  listen(events, t, level = 0) {
    const dt =
      this.energyTime === null ? 1 / 60 : clamp(t - this.energyTime, 0, 0.2);
    this.energyTime = t;
    const target = clamp(level * 7);
    this.energy +=
      (target - this.energy) *
      (1 - Math.exp(-dt / (target > this.energy ? 0.25 : 1.2)));
    this.tracker.observe(events, t);
    if (this.autoSync) this.tracker.update(this.beatClock, t);
  }
  eventLabel(kind) {
    return this.mode === "legacy"
      ? this.mappings[kind].expression
      : `${kind} accent · ${this.currentExpression}`;
  }
  trigger(kind, t, strength = 1, options = {}) {
    if (this.mode === "legacy") {
      const accepted = super.trigger(kind, t, strength, options);
      if (accepted) this.currentExpression = this.mappings[kind].expression;
      return accepted;
    }
    if (
      !ACCENTS[kind] ||
      (!options.manual &&
        t - (this.lastAccent[kind] ?? -100) < this.mappings[kind].cooldown)
    )
      return false;
    const old = this.accents.find((v) => v.kind === kind),
      from = old ? envelope(old, t) : 0;
    this.accents = this.accents.filter((v) => v.kind !== kind);
    this.accents.push({
      kind,
      start: t,
      strength: clamp(strength, 0.25, 1),
      from,
    });
    this.lastAccent[kind] = t;
    this.voices = this.accents;
    this.events.push({ kind, time: t, expression: this.eventLabel(kind) });
    if (this.events.length > 120) this.events.shift();
    return true;
  }
  update(t) {
    if (this.autoSync) this.tracker.update(this.beatClock, t);
    if (this.mode !== "beat" || !this.automatic) return;
    const read = this.beatClock.read(t, this.phraseBeats);
    if (read.phrase <= this.lastPhrase) return;
    const from = this.baseAt(t),
      names = this.sequence();
    let next;
    if (this.random) {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      const choices = names.filter((n) => n !== this.currentExpression);
      next = choices[this.seed % choices.length];
    } else {
      this.sequenceIndex = (this.sequenceIndex + 1) % names.length;
      next = names[this.sequenceIndex];
      if (next === this.currentExpression) {
        this.sequenceIndex = (this.sequenceIndex + 1) % names.length;
        next = names[this.sequenceIndex];
      }
    }
    this.lastPhrase = read.phrase;
    this.currentExpression = next;
    this.transition = null;
    this.phraseTransition = {
      from,
      to: this.constrain({ ...this.zero(), ...this.presets[next] }),
      start: read.phrase * this.phraseBeats,
      duration: this.transitionBeats,
    };
  }
  sample(t, idle = true) {
    if (!this.beatClock || this.mode === "legacy") return super.sample(t, idle);
    this.update(t);
    const s = super.sample(t, idle),
      q = s.pose,
      add = {};
    const energyScale = 0.35 + 0.65 * this.energy;
    // Main emotion stays recognizable; slow energy changes modulate its strength,
    // never its phrase duration. Manual expression inspection uses the exact preset.
    if (this.automatic)
      for (const k of Object.keys(q))
        if (k !== "gazeX" && k !== "gazeY") q[k] *= 0.9 + 0.1 * this.energy;
    this.accents = this.accents.filter(
      (v) =>
        t - v.start <
        ACCENTS[v.kind].attack + ACCENTS[v.kind].hold + ACCENTS[v.kind].release,
    );
    this.voices = this.accents;
    for (const v of this.accents) {
      const e = envelope(v, t) * this.accentIntensity * energyScale,
        g = ACCENTS[v.kind];
      for (const [k, val] of Object.entries(g.pose))
        add[k] = Math.max(add[k] || 0, val * e);
      for (const [k, val] of Object.entries(g.head))
        s.head[k] = Math.max(s.head[k], val * e);
    }
    for (const [k, val] of Object.entries(add)) {
      if (k === "eyeOpen" && q.squint > 0.1) continue;
      const max = this.limits?.[k]?.[2] ?? (k === "jawOpen" ? 6 : 1);
      q[k] += (max - (q[k] || 0)) * (val / max);
    }
    s.pose = this.constrain(q);
    return s;
  }
}
