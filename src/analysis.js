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
export function featuresFromSpectrum(spectrum, rate = SAMPLE_RATE) {
  const avg = (min, max) => {
    let sum = 0,
      n = 0;
    for (
      let i = Math.floor(min / (rate / FFT_SIZE));
      i <= Math.min(spectrum.length - 1, Math.ceil(max / (rate / FFT_SIZE)));
      i++
    ) {
      sum += Math.max(
        0,
        Math.min(1, (20 * Math.log10(Math.max(1e-12, spectrum[i])) + 100) / 70),
      );
      n++;
    }
    return n ? sum / n : 0;
  };
  return {
    bass: Math.min(1, avg(35, 180) * 2.2),
    mid: Math.min(1, avg(180, 2200) * 2.4),
    high: Math.min(1, avg(2200, 9000) * 2),
  };
}
export function analyzePCM(pcm, rate = SAMPLE_RATE) {
  const result = [],
    smooth = new Float64Array(FFT_SIZE / 2),
    hop = Math.round(rate * STEP);
  for (let i = 0; i < pcm.length; i += hop) {
    // Causal trailing window, zero padded at the beginning of the song.
    const window = new Float32Array(FFT_SIZE),
      start = i - FFT_SIZE;
    for (let j = 0; j < FFT_SIZE; j++)
      if (start + j >= 0) window[j] = pcm[start + j] || 0;
    const spectrum = magnitudes(window);
    for (let j = 0; j < smooth.length; j++)
      smooth[j] = smooth[j] * 0.16 + spectrum[j] * 0.84;
    result.push(featuresFromSpectrum(smooth, rate));
  }
  return result;
}
