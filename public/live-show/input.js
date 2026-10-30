import {
  spectralFeatures,
  OnsetDetector,
} from "./onsets.js?release=audio-file-3";
export class LiveInput {
  constructor({ state, frame }) {
    this.onState = state;
    this.onFrame = frame;
    this.generation = 0;
    this.stream = null;
    this.context = null;
    this.detector = new OnsetDetector();
    this.level = 0;
    this.maxLevel = 0;
    this.sensitivity = 1;
  }
  get sensitivity() {
    return this._sensitivity || 1;
  }
  set sensitivity(value) {
    this._sensitivity = Math.max(0.5, Math.min(2, Number(value) || 1));
    this.clockNode?.port.postMessage({ sensitivity: this._sensitivity });
  }
  async devices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "audioinput",
    );
  }
  async stop(notify = true) {
    ++this.generation;
    this.media?.pause();
    this.media = null;
    clearInterval(this.timer);
    this.clockNode?.disconnect();
    this.clockNode = null;
    const ctx = this.context;
    this.context = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.mute?.disconnect();
    this.level = 0;
    this.detector.reset();
    if (ctx && ctx.state !== "closed") await ctx.close().catch(() => {});
    if (notify) this.onState("off", "Input off · manual gestures ready");
  }
  async start(deviceId = "", media = null) {
    await this.stop(false);
    const generation = this.generation;
    let context, stream;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio || (!media && !navigator.mediaDevices?.getUserMedia))
        throw Error(
          "Microphone needs HTTPS and a browser with Web Audio. Manual gestures remain available.",
        );
      this.onState(
        "pending",
        media ? "Preparing local track…" : "Waiting for microphone permission…",
      );
      context = new Audio({ latencyHint: "interactive" });
      const resumed = context.resume();
      stream = media
        ? null
        : await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              deviceId: deviceId ? { exact: deviceId } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
      await resumed;
      if (generation !== this.generation) {
        stream?.getTracks().forEach((t) => t.stop());
        await context.close();
        return;
      }
      const source = media
          ? context.createMediaElementSource(media)
          : context.createMediaStreamSource(stream),
        analyser = context.createAnalyser(),
        mute = context.createGain();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      mute.gain.value = 0;
      source.connect(analyser);
      analyser.connect(mute).connect(context.destination);
      if (media) source.connect(context.destination);
      this.media = media;
      this.context = context;
      this.stream = stream;
      this.source = source;
      this.analyser = analyser;
      this.mute = mute;
      this.bins = new Float32Array(analyser.frequencyBinCount);
      this.linear = new Float32Array(analyser.frequencyBinCount);
      this.previous = new Float32Array(analyser.frequencyBinCount);
      this.pcm = new Float32Array(analyser.fftSize);
      this.detector.reset();
      this.maxLevel = 0;
      const label = media
        ? "Local track"
        : stream.getAudioTracks()[0]?.label || "Audio input";
      context.onstatechange = () => {
        if (this.context === context)
          this.onState(
            context.state === "running" ? "live" : "suspended",
            context.state === "running"
              ? label +
                  (media
                    ? " · playing through speakers"
                    : " · live, output muted")
              : "Input paused by browser · press Resume input",
          );
      };
      for (const track of stream?.getTracks() || [])
        track.onended = () => {
          if (this.stream === stream) {
            this.stop(false);
            this.onState(
              "error",
              "Audio device disconnected · reconnect input or use manual gestures",
            );
          }
        };
      this.onState(
        context.state === "running" ? "live" : "suspended",
        label + " · " + context.state,
      );
      try {
        if (!context.audioWorklet) throw Error("No audio worklet");
        await context.audioWorklet.addModule(
          new URL("./clock-worklet.js?release=audio-file-3", import.meta.url),
        );
        if (this.context !== context) return;
        const node = new AudioWorkletNode(context, "freakshow-clock");
        analyser.disconnect();
        analyser.connect(node);
        node.connect(mute);
        this.clockNode = node;
        node.port.postMessage({ sensitivity: this.sensitivity });
        node.port.onmessage = ({ data }) => {
          if (this.context !== context) return;
          const now = performance.now() / 1000;
          this.level = data.level;
          this.maxLevel = Math.max(this.maxLevel, data.level);
          this.detector.last = data.last;
          const events = data.events.map((e) => ({
            ...e,
            wallTime: now - Math.max(0, context.currentTime - e.time),
          }));
          this.onFrame({
            level: data.level,
            events,
            features: data.features,
            time: now,
          });
        };
      } catch {
        if (this.context === context)
          this.timer = setInterval(
            () => this.tick(performance.now() / 1000, this.sensitivity),
            1000 / 60,
          );
      }
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (context && context.state !== "closed")
        await context.close().catch(() => {});
      if (generation !== this.generation) return;
      this.context = null;
      this.media = null;
      this.stream = null;
      const message =
        e.name === "NotAllowedError"
          ? "Microphone permission denied. Allow it in browser settings and retry; manual gestures still work."
          : e.name === "NotFoundError"
            ? "No audio input found. Connect an interface/microphone or use manual gestures."
            : e.message;
      this.onState("error", message);
    }
  }
  async resume() {
    if (this.context) await this.context.resume();
  }
  tick(time, sensitivity) {
    if (!this.context || this.context.state !== "running") return;
    this.analyser.getFloatFrequencyData(this.bins);
    this.analyser.getFloatTimeDomainData(this.pcm);
    let sum = 0;
    for (const x of this.pcm) sum += x * x;
    this.level = Math.sqrt(sum / this.pcm.length);
    this.maxLevel = Math.max(this.maxLevel, this.level);
    for (let i = 0; i < this.bins.length; i++)
      this.linear[i] = 10 ** (this.bins[i] / 20);
    const features = spectralFeatures(
      this.linear,
      this.previous,
      this.context.sampleRate,
      this.analyser.fftSize,
    );
    this.previous.set(this.linear);
    const events = this.detector.process(
      features,
      this.context.currentTime,
      sensitivity,
    );
    this.onFrame({ level: this.level, events, features, time });
  }
}
