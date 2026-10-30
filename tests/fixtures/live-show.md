# Live Show synthetic capture fixture

`live-show.wav`: 8 seconds, mono PCM16, 44.1 kHz, generated noise/tones (no copyrighted recording). Kick-like 65 Hz decays at .5/1/5.6 seconds; 660 Hz tonal notes at 1.6/1.83/2.06/6.4; band-limited 250–1800 Hz snare noise at 3/5.85; 2400–4900 Hz clap noise at 4/6.1; 8000–13000 Hz hat noise at5. Seed104. Soft 3 ms attack/15 ms end taper. This tests actual browser capture/FFT/onset/controller integration, not instrument recognition on real songs.

`live-show.mp3` is an MP3 encoding of the same synthetic test signal, generated with FFmpeg for local file-picker/playback regression tests.
