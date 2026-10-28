class PCMFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(1024);
    this.index = 0;
    this.samples = 0;
    this.next = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let v = 0;
      for (const c of channels) v += c[i] / channels.length;
      this.ring[this.index] = v;
      this.index = (this.index + 1) % 1024;
      this.samples++;
      if (this.samples >= this.next) {
        const pcm = new Float32Array(1024);
        for (let j = 0; j < 1024; j++)
          pcm[j] = this.ring[(this.index + j) % 1024];
        this.port.postMessage({ pcm, time: this.samples / sampleRate });
        this.next += sampleRate / 60;
      }
    }
    return true;
  }
}
registerProcessor("pcm-frames", PCMFrames);
