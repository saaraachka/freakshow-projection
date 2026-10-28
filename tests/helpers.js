export function synthesize(fixture) {
  const pcm = new Float32Array(
    Math.ceil(fixture.duration * fixture.sampleRate),
  );
  for (const tone of fixture.tones)
    for (
      let i = Math.floor(tone.start * fixture.sampleRate);
      i < tone.end * fixture.sampleRate;
      i++
    ) {
      const t = i / fixture.sampleRate - tone.start;
      pcm[i] +=
        tone.amplitude *
        Math.sin(2 * Math.PI * tone.frequency * t) *
        Math.min(1, t / 0.005, (tone.end - i / fixture.sampleRate) / 0.01);
    }
  return pcm;
}
export function wav(pcm, sampleRate) {
  const out = Buffer.alloc(44 + pcm.length * 2);
  out.write("RIFF");
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++)
    out.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767),
      44 + i * 2,
    );
  return out;
}
