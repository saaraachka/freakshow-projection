// Causal audio-onset estimates. Classification is deliberately heuristic, not
// source separation; levels alone never continuously open the mouth.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BANDS = {
  low: [40, 180],
  mid: [180, 2000],
  presence: [2000, 5000],
  high: [5000, 14000],
};
export function spectralFeatures(spectrum, previous, rate, fftSize) {
  const result = {};
  for (const [name, [lo, hi]] of Object.entries(BANDS)) {
    let e = 0,
      f = 0,
      sum = 0,
      peak = 0;
    for (
      let i = Math.max(1, Math.ceil((lo * fftSize) / rate));
      i < Math.min(spectrum.length, Math.ceil((hi * fftSize) / rate));
      i++
    ) {
      const v = spectrum[i] || 0,
        d = Math.max(0, v - (previous?.[i] || 0));
      e += v * v;
      f += d * d;
      sum += v;
      peak = Math.max(peak, v);
    }
    result[name] = {
      energy: Math.sqrt(e),
      flux: Math.sqrt(f),
      tonality: peak / (sum || 1),
    };
  }
  return result;
}
export class OnsetDetector {
  constructor() {
    this.reset();
  }
  reset() {
    this.stats = Object.fromEntries(
      Object.keys(BANDS).map((k) => [k, { energy: 0, flux: 0, variance: 0 }]),
    );
    this.last = {
      kick: -100,
      snare: -100,
      clap: -100,
      hat: -100,
      melody: -100,
      body: -100,
    };
    this.time = null;
  }
  process(features, time, sensitivity = 1) {
    const dt =
      this.time === null ? 1 / 60 : clamp(time - this.time, 0.001, 0.1);
    this.time = time;
    const s = clamp(sensitivity, 0.5, 2),
      attacks = {};
    for (const k of Object.keys(BANDS)) {
      const f = features[k],
        p = this.stats[k];
      attacks[k] =
        f.energy > 0.003 / s &&
        f.energy > p.energy * 1.06 &&
        f.flux >
          Math.max(
            0.003 / s,
            (p.flux * 2.1 + Math.sqrt(p.variance) * 1.35) / s,
          );
    }
    const out = [],
      emit = (kind, band, cooldown) => {
        if (time - this.last[kind] < cooldown) return;
        this.last[kind] = time;
        out.push({
          kind,
          time,
          strength: clamp(features[band].flux / 0.065, 0.35, 1),
        });
      };
    const { low, mid, presence, high } = features;
    if (attacks.low && low.energy > mid.energy * 0.18)
      emit("kick", "low", 0.13);
    const isHat = high.energy > (mid.energy + presence.energy) * 1.25;
    if (
      (attacks.mid || attacks.presence) &&
      mid.energy + presence.energy > low.energy * 0.25 &&
      !isHat &&
      time - this.last.body > 0.115
    ) {
      this.last.body = time;
      if (mid.tonality > 0.18 && mid.energy > presence.energy * 0.25)
        emit("melody", "mid", 0.14);
      else if (presence.energy > mid.energy * 1.25)
        emit("clap", "presence", 0.16);
      else emit("snare", "mid", 0.15);
    } else if (attacks.high && isHat) emit("hat", "high", 0.09);
    const a = 1 - Math.exp(-dt / 1.1),
      b = 1 - Math.exp(-dt / 1.6);
    for (const k of Object.keys(BANDS)) {
      const f = features[k],
        p = this.stats[k],
        d = f.flux - p.flux;
      p.energy += (f.energy - p.energy) * a;
      p.flux += d * b;
      p.variance += (d * d - p.variance) * b;
    }
    return out;
  }
}
