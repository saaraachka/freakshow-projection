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

The service worker uses a versioned app-shell cache. Increment `CACHE` in `sw.js` when publishing a new release. Updates activate as soon as their files have cached; reload the page to use the updated app. Serve development and production on distinct origins/ports when switching between them so a previous production worker cannot cache development files.

## Structure and v4 compatibility

- `src/engine.js`: adaptive onset detection, continuous drive, reaction envelopes, deterministic fixed steps, annotation matching.
- `src/analysis.js`: pure Blackman-window FFT, v4 frequency bands/gains and spectral smoothing; shared by worker and microphone PCM capture.
- `src/analysis-worker.js`: recorded-song analysis away from the UI thread.
- `src/mic-worklet.js`: microphone PCM windows on the audio clock, independent of display frame rate.
- `src/renderer.js`: extracted v4 canvas paths and scene drawing, consuming explicit state rather than DOM controls.
- `src/app.js`: workspace orchestration, transport, notes, diagnostics, device lifecycle, and projector messaging.
- `public/baseline-v4.html`: the original repository page, preserved byte-for-byte for comparison.

The original v4 page remains available as a baseline. The current detector uses linear spectral energy and positive spectral change rather than the v4 logarithmic averages, which could saturate and hide note onsets. It rejects note-release transients and routes low thumps to eyes, tonal notes to mouth, and bright ticks to Ignore by default. These are heuristic sound families, not source separation or instrument recognition. Dense mixes can require calibration. Detected sound candidates and resulting animation triggers are visible separately. Reaction envelopes close between quick notes; kick energy controls pulse amplitude while resting sockets stay small. The renderer's original clown paths and autonomous motion are preserved. No timestamp schedules animation.

Song Lab's native file input is visible and enabled when ready, with local loading/error feedback, same-file reselection, and drag-and-drop fallback. Tests click the native input, wait for a file-chooser event, then choose actual generated WAV and encoded MP3 fixtures. This verifies browser file selection, not the host integration of every embedded webview's operating-system picker. If an embedded browser suppresses its native picker, use the system browser or drop a file. The reported deployed-picker failure could not be reproduced on the remote site because the cloud network denies its hostname; do not treat local success as remote verification. A release cache version bump prevents old cached modules from persisting across releases after reload.

## Visual sound editor and calibration status

Zoom the waveform and pan with **Move view**. Click a sound chip or click/drag on the waveform to select an example. Choose a sound family, **Ignore**, **What Moves**, **How It Reacts**, and **How Dramatic**, then **Apply to similar sounds**. The mapping changes the selected family across the whole song and in Live Show. It is deliberately broad, not a classifier trained on the exact sample. Reset mappings to restore defaults. Mappings persist in preferences and exported sessions. Expected timestamp notes remain tests only. Advanced diagnostics reveals bass/mid energy lanes; the main view contains waveform, heard sounds, and animation output. Eye/mouth percentages and the recent heard sound distinguish missing detections from missing motion.

**“Remotif – Airtight (Original Mix)” is not calibrated yet.** The actual audio has not been supplied. `tests/fixtures/airtight-plan.json` records the approximate 6.3/6.6/6.9-second expectations and listening checks, explicitly as an unverified plan. It is not loaded by the detector and is not counted as a passing test. After obtaining the user's audio file, listen to and mark the opening hats, the three separate lead notes, background kicks and the drop; compare exact heard sounds, triggered events, and rendered expressions. Export the annotated real-song session for regression. Do not infer actual-track accuracy from synthetic fixtures.

Generalization checks currently cover multiple pitches and levels, legato changes, three notes 300 ms apart, quiet/loud kick pulses, ignored high ticks, mapping at changed timestamps, and equality of microphone/recorded-window features. These validate the mechanism, not separation quality on arbitrary finished recordings. Session feature snapshots are versioned; old notes can still be imported against matching audio, but re-export the song before running the new CLI detector regression.

To run the interaction suite against the actual deployed app (when network access is allowed):

```sh
FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/ CHROMIUM_PATH=/usr/bin/chromium node tests/browser.js
```

For a local full-suite check under the Pages path, run `FREAKSHOW_TEST_BASE_PATH=/freakshow-projection/ CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

The deployed test uses the configured HTTPS proxy, checks asset/console failures, opens file choosers and loads MP3/WAV. A blocked navigation is a failed deployment-verification attempt, not a pass.

No strobe is used. Test projector placement and playback conditions on the intended hardware before a show.

## Persistent GitHub Pages preview

The `Deploy FREAKSHOW preview` workflow builds and tests `main`, then publishes `dist/` to GitHub Pages. No third-party hosting account or deployment secret is required.

One-time repository setup: open **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**, and save if prompted. In **Actions → Deploy FREAKSHOW preview**, choose **Run workflow** on `main` if the initial push ran before Pages was enabled. Approve the `github-pages` deployment if your repository's environment rules require it.

After a successful deployment, the expected address is `https://saaraachka.github.io/freakshow-projection/`. Use the URL reported by the successful GitHub Actions deployment as the authoritative live address. Subsequent pushes to `main` rebuild it automatically. This is the production app with offline caching, microphone support over HTTPS, and a separate projector window; it requires no download. Enable popups and microphone access in your browser when testing Live Show.

The Codex cloud workspace and desktop browser panel do not necessarily share localhost. If the cloud server returns HTTP 200 but the panel reports connection refused, use a platform-provided forwarded URL when available or the Pages preview above. Restarting the healthy server does not create a tunnel.
