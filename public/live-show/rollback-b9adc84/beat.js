const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const wrap = (x) => x - Math.round(x);
// Keep one monotonic timeline across audio-context creation, suspension and reconnect.
// While audio runs, elapsed time comes from its sample clock, never timer increments.
export class AudioTimeline {
  constructor() {
    this.last = 0;
    this.source = null;
    this.offset = 0;
  }
  now(context, wall) {
    const source = context?.state === "running" ? context : null;
    if (source !== this.source) {
      this.source = source;
      this.offset =
        Math.max(wall, this.last) - (source ? source.currentTime : wall);
    }
    this.last = Math.max(
      this.last,
      (source ? source.currentTime : wall) + this.offset,
    );
    return this.last;
  }
}
export class BeatClock {
  constructor(bpm = 135, time = 0) {
    this.bpm = bpm;
    this.anchor = time;
    this.beat = 0;
    this.phaseRate = 0;
    this.taps = [];
    this.revision = 0;
  }
  at(t) {
    return this.beat + (t - this.anchor) * (this.bpm / 60 + this.phaseRate);
  }
  setBpm(bpm, t) {
    this.beat = this.at(t);
    this.anchor = t;
    this.bpm = clamp(Number(bpm) || 135, 40, 300);
  }
  setPhaseRate(rate, t) {
    this.beat = this.at(t);
    this.anchor = t;
    this.phaseRate = clamp(rate, -0.04, 0.04);
  }
  resync(t) {
    this.anchor = t;
    this.beat = 0;
    this.phaseRate = 0;
    this.revision++;
  }
  nudge(seconds, t) {
    this.beat = this.at(t) + (seconds * this.bpm) / 60;
    this.anchor = t;
  }
  tap(t) {
    if (this.taps.length && t - this.taps.at(-1) > 2) this.taps = [];
    if (this.taps.length && t - this.taps.at(-1) < 0.18) return null;
    this.taps.push(t);
    this.taps = this.taps.slice(-9);
    if (this.taps.length < 2) return null;
    const intervals = this.taps.slice(1).map((x, i) => x - this.taps[i]),
      m = median(intervals);
    const clean = intervals.filter((x) => Math.abs(x - m) < m * 0.2);
    const bpm = 60 / (clean.reduce((a, b) => a + b, 0) / clean.length);
    this.setBpm(bpm, t);
    this.beat = Math.round(this.beat);
    this.anchor = t;
    this.phaseRate = 0;
    return this.bpm;
  }
  read(t, phrase = 8) {
    const b = Math.max(0, this.at(t)),
      index = Math.floor(b + 1e-8);
    return {
      bpm: this.bpm,
      beat: b,
      barBeat: (index % 4) + 1,
      phraseBeat: (index % phrase) + 1,
      phrase: Math.floor(index / phrase),
      phase: b - index,
    };
  }
}
// Weighted phase coherence over recent percussion, with stable candidates and
// bounded tempo/phase slewing. No onset ever resets the beat counter.
export class TempoTracker {
  constructor() {
    this.clear();
  }
  clear() {
    this.events = [];
    this.confidence = 0;
    this.estimate = null;
    this.candidate = null;
    this.stable = 0;
    this.lastUpdate = null;
    this.locked = false;
    this.lastReliable = null;
  }
  observe(events, t) {
    for (const e of events)
      if (["kick", "snare", "clap"].includes(e.kind)) {
        const time = e.time ?? t;
        if (!this.events.length || time - this.events.at(-1).time > 0.07)
          this.events.push({ time, weight: e.kind === "kick" ? 1 : 0.75 });
      }
    this.events = this.events.filter((e) => t - e.time < 12).slice(-96);
  }
  update(clock, t) {
    if (this.lastUpdate !== null && t - this.lastUpdate < 0.4) return;
    const dt =
      this.lastUpdate === null ? 0.4 : Math.min(1, t - this.lastUpdate);
    this.lastUpdate = t;
    const events = this.events,
      age = events.length ? t - events.at(-1).time : 100;
    if (
      events.length < 6 ||
      events.at(-1).time - events[0].time < 2.2 ||
      age > 2
    ) {
      this.confidence *= Math.exp(-dt / 1.5);
      this.stable = 0;
      clock.setPhaseRate(clock.phaseRate * Math.exp(-dt), t);
      return;
    }
    let best = null;
    for (let bpm = 80; bpm <= 180; bpm += 0.5) {
      const period = 60 / bpm;
      let x = 0,
        y = 0,
        w = 0;
      for (const e of events) {
        const a = ((e.time - events[0].time) / period) * 2 * Math.PI;
        x += Math.cos(a) * e.weight;
        y += Math.sin(a) * e.weight;
        w += e.weight;
      }
      const coherence = Math.hypot(x, y) / w;
      const score = coherence - 0.015 * Math.abs(Math.log2(bpm / clock.bpm));
      if (!best || score > best.score)
        best = {
          bpm,
          coherence,
          score,
          epoch: events[0].time + (Math.atan2(y, x) / (2 * Math.PI)) * period,
        };
    }
    this.confidence =
      best.coherence *
      Math.min(1, (events.length - 3) / 7) *
      Math.exp(-Math.max(0, age - 0.7));
    if (this.confidence < 0.62) {
      this.stable = 0;
      clock.setPhaseRate(clock.phaseRate * Math.exp(-dt), t);
      return;
    }
    this.stable =
      this.candidate && Math.abs(best.bpm - this.candidate.bpm) < 2
        ? this.stable + 1
        : 1;
    this.candidate = best;
    if (this.stable < 3) return;
    this.estimate = best.bpm;
    this.locked = true;
    this.lastReliable = t;
    clock.setBpm(clock.bpm + clamp(best.bpm - clock.bpm, -4 * dt, 4 * dt), t);
    const error = wrap(((t - best.epoch) * clock.bpm) / 60 - clock.at(t));
    clock.setPhaseRate(error * 0.2, t);
  }
}
