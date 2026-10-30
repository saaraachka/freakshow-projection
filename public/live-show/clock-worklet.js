import { magnitudes, FFT_SIZE } from "../../src/analysis.js";
import {
  spectralFeatures,
  OnsetDetector,
} from "./onsets.js?release=beat-4";
// Detect on the audio thread, not on rendering ticks. Every analysis window is
// sampled even if WebGL is busy. The output remains silent; no mic monitoring.
class ShowClock extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(FFT_SIZE);
    this.frame = new Float32Array(FFT_SIZE);
    this.index = 0;
    this.until = 0;
    this.previous = null;
    this.sensitivity = 1;
    this.detector = new OnsetDetector();
    this.port.onmessage = ({ data }) => {
      if (data.reset) {
        this.detector.reset();
        this.previous = null;
        this.ring.fill(0);
      }
      if (Number.isFinite(data.sensitivity))
        this.sensitivity = data.sensitivity;
    };
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let v = 0;
      for (const c of channels) v += c[i] / channels.length;
      this.ring[this.index] = v;
      this.index = (this.index + 1) % FFT_SIZE;
      this.until++;
      if (this.until >= sampleRate / 60) {
        this.until -= sampleRate / 60;
        let sum = 0;
        for (let j = 0; j < FFT_SIZE; j++) {
          const s = this.ring[(this.index + j) % FFT_SIZE];
          this.frame[j] = s;
          sum += s * s;
        }
        const spectrum = magnitudes(this.frame),
          features = spectralFeatures(
            spectrum,
            this.previous,
            sampleRate,
            FFT_SIZE,
          ),
          time = currentTime + i / sampleRate;
        const events = this.detector.process(features, time, this.sensitivity);
        this.previous = spectrum;
        this.port.postMessage({
          level: Math.sqrt(sum / FFT_SIZE),
          events,
          features,
          last: this.detector.last,
        });
      }
    }
    return true;
  }
}
registerProcessor("freakshow-clock", ShowClock);
