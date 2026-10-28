import { STEP } from "./engine.js";
export const SAMPLE_RATE = 44100,
  FFT_SIZE = 1024;
// Pure radix-2 FFT: the same feature extractor serves recordings and microphone PCM.
export function magnitudes(samples, start = 0) {
  const n = FFT_SIZE,
    re = new Float64Array(n),
    im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let j = 0,
      k = i;
    for (let b = 0; b < 10; b++) {
      j = (j << 1) | (k & 1);
      k >>= 1;
    }
    const window =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / n) +
      0.08 * Math.cos((4 * Math.PI * i) / n);
    re[j] = (samples[start + i] || 0) * window;
  }
  for (let size = 2; size <= n; size *= 2)
    for (let offset = 0; offset < n; offset += size)
      for (let j = 0; j < size / 2; j++) {
        const angle = (-2 * Math.PI * j) / size,
          c = Math.cos(angle),
          s = Math.sin(angle),
          a = offset + j,
          b = a + size / 2;
        const r = re[b] * c - im[b] * s,
          m = re[b] * s + im[b] * c;
        re[b] = re[a] - r;
        im[b] = im[a] - m;
        re[a] += r;
        im[a] += m;
      }
  return Float64Array.from(
    { length: n / 2 },
    (_, i) => Math.hypot(re[i], im[i]) / n,
  );
}
// Linear band energy avoids the v4 dB/gain clamp that flattened loud songs.
export function featuresFromSpectrum(
  spectrum,
  rate = SAMPLE_RATE,
  previous = null,
) {
  const band = (low, high) => {
    let energy = 0,
      positive = 0,
      total = 0,
      peak = 0;
    for (
      let i = Math.max(1, Math.ceil((low * FFT_SIZE) / rate));
      i <= Math.min(spectrum.length - 1, Math.floor((high * FFT_SIZE) / rate));
      i++
    ) {
      const v = spectrum[i];
      energy += v * v;
      total += v;
      peak = Math.max(peak, v);
      const rise = Math.max(0, v - (previous?.[i] || 0));
      positive += rise * rise;
    }
    return {
      energy: Math.min(1, Math.sqrt(energy) * 4),
      flux: Math.min(1, Math.sqrt(positive) * 4),
      tonal: total ? peak / total : 0,
    };
  };
  const bass = band(35, 180),
    mid = band(180, 2200),
    high = band(2200, 9000);
  return {
    bass: bass.energy,
    mid: mid.energy,
    high: high.energy,
    bassFlux: bass.flux,
    midFlux: mid.flux,
    highFlux: high.flux,
    tonal: mid.tonal,
  };
}
export class FeatureExtractor {
  constructor(rate = SAMPLE_RATE) {
    this.rate = rate;
    this.previous = new Float64Array(FFT_SIZE / 2);
  }
  process(window) {
    const spectrum = magnitudes(window);
    const feature = featuresFromSpectrum(spectrum, this.rate, this.previous);
    this.previous = spectrum;
    return feature;
  }
}
export function analyzePCM(pcm, rate = SAMPLE_RATE) {
  const result = [],
    extractor = new FeatureExtractor(rate),
    hop = Math.round(rate * STEP);
  for (let i = 0; i < pcm.length; i += hop) {
    // Causal trailing window, zero padded at the beginning of the song.
    const window = new Float32Array(FFT_SIZE),
      start = i - FFT_SIZE;
    for (let j = 0; j < FFT_SIZE; j++)
      if (start + j >= 0) window[j] = pcm[start + j] || 0;
    result.push(extractor.process(window));
  }
  return result;
}
