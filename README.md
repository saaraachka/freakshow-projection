# FREAKSHOW Projection Workshop

A local, cross-platform web app with three workspaces and the original v4 clown artwork. Songs and microphone audio stay on your device. No account, API keys, backend, or external assets are required.

## Develop

Use Node.js 20 or later (validated with Node 24):

```sh
npm ci
npm run dev
```

Open the local server on port **5173** in a modern browser. Changes take effect on reload; development does not register the offline service worker. Use the existing checkout; cloud tasks already have an isolated workspace and need no extra Git worktree.

## The three modes

- **Song Lab** loads local MP3/WAV files, decodes to mono 44.1 kHz, and analyzes once in a worker at 60 steps per second. Play, pause, or seek with the waveform, any diagnostic lane, or the position slider. Bass, midrange, detected eye/jaw events, and expression strength share the song clock. Mark expected eye/jaw reactions or sounds to ignore; enter an exact timestamp while paused. Notes save per audio file SHA-256 on the current device. Export sessions to preserve/share notes and run regressions. Imported notes require the matching audio file, which is never embedded in the export. Clearing site storage removes local notes.
- **Visual Studio** explores idle character (slow haunt, still pose, restless), single eye/jaw triggers, and a repeating rehearsal. Smooth, snap, and bounce shapes plus three expression presets modify the shared animation. Preferences persist locally. No microphone permission is needed.
- **Live Show** requests microphone permission, supports input-device selection, and opens a separate projector window. Move it to an extended display and click **Enter fullscreen** there. The controller broadcasts evaluated animation states to the same renderer in the projector window. The microphone is never played back through speakers. Allow popups and microphone permission for the site.

Space plays/pauses a loaded song or pauses/resumes autonomous motion when focus is outside controls. The appearance disclosure retains the original clown, hands, ringmaster, tent, and palettes.

## Validate

```sh
npm test
npm run build
npx playwright install chromium  # once for browser tests
npm run test:browser
npm run check-session -- path/to/song.freakshow.json
```

For a system Chromium, set `CHROMIUM_PATH` to its executable when running `npm run test:browser`. The browser test manages its production server on port 5174 and saves screenshots/session output under ignored `artifacts/`. It covers WAV and MP3 loading, saved annotations, identical rendered poses after seeking, playback, session persistence/import/export, eye/jaw animation, simulated microphone input, projector synchronization/fullscreen, a mobile viewport, and offline reload. Real microphone acoustics, permissions, HDMI latency, and hardware fullscreen must still be checked on the show laptop.

`tests/fixtures/accents.json` is a saved annotation fixture with reproducible low-frequency and midrange tones, silence, and a sound below threshold. `accents.mp3` is the same synthetic audio encoded with LAME at 96 kbps. Unit tests analyze actual PCM rather than mocked detection results. Session regressions use the exported feature sequence and selected settings; failures return a nonzero exit code. Unannotated events remain visible but are not automatically failures. Ignore annotations assert no event within ±150 ms, and expected reactions use one-to-one matching in the same window. Review annotations against real songs as you refine detection.

## Offline production

```sh
npm run build
npm run preview
```

`dist/` is a standalone static site; serve it from localhost or HTTPS. After the first online visit completes caching, the app shell, modules, audio worklet, and baseline work offline. Local audio files must be chosen again after a reload. Installability varies by browser; offline use does not require installation. Opening `index.html` directly as `file://` is unsupported because ES modules, workers, and microphone APIs need a server.

The service worker uses a versioned app-shell cache. Increment `CACHE` in `sw.js` when publishing a new release. Close existing app tabs and reopen to activate an update. Serve development and production on distinct origins/ports when switching between them so a previous production worker cannot cache development files.

## Structure and v4 compatibility

- `src/engine.js`: adaptive onset detection, continuous drive, reaction envelopes, deterministic fixed steps, annotation matching.
- `src/analysis.js`: pure Blackman-window FFT, v4 frequency bands/gains and spectral smoothing; shared by worker and microphone PCM capture.
- `src/analysis-worker.js`: recorded-song analysis away from the UI thread.
- `src/mic-worklet.js`: microphone PCM windows on the audio clock, independent of display frame rate.
- `src/renderer.js`: extracted v4 canvas paths and scene drawing, consuming explicit state rather than DOM controls.
- `src/app.js`: workspace orchestration, transport, notes, diagnostics, device lifecycle, and projector messaging.
- `public/baseline-v4.html`: the original repository page, preserved byte-for-byte for comparison.

The v4 selective thresholds, adaptive baselines, cooldowns, continuous eye/jaw drive, idle artwork, and motion envelopes remain the baseline. Detection now advances at a fixed cadence instead of requestAnimationFrame. Replay/seek uses precomputed states, eliminating seek history and display-rate dependence. Microphone input uses the same feature extractor and engine at 60 Hz. Browser audio decoders can differ slightly across platforms; deterministic regression exports pin the extracted features. The old exaggeration selector computed a scale without applying it; v5 applies the chosen expression strength while preserving the original extreme setting as default. Random demo timing is replaced by a repeatable rehearsal. Automatic scene cycling and the OS setup wizard are omitted in favor of explicit scene choices and browser-native device access.

No strobe is used. Test projector placement and playback conditions on the intended hardware before a show.

## Persistent GitHub Pages preview

The `Deploy FREAKSHOW preview` workflow builds and tests `main`, then publishes `dist/` to GitHub Pages. No third-party hosting account or deployment secret is required.

One-time repository setup: open **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**, and save if prompted. In **Actions → Deploy FREAKSHOW preview**, choose **Run workflow** on `main` if the initial push ran before Pages was enabled. Approve the `github-pages` deployment if your repository's environment rules require it.

After a successful deployment, the expected address is `https://saaraachka.github.io/freakshow-projection/`. Use the URL reported by the successful GitHub Actions deployment as the authoritative live address. Subsequent pushes to `main` rebuild it automatically. This is the production app with offline caching, microphone support over HTTPS, and a separate projector window; it requires no download. Enable popups and microphone access in your browser when testing Live Show.

The Codex cloud workspace and desktop browser panel do not necessarily share localhost. If the cloud server returns HTTP 200 but the panel reports connection refused, use a platform-provided forwarded URL when available or the Pages preview above. Restarting the healthy server does not create a tunnel.
