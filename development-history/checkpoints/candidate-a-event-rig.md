# Candidate A — bounded facial performance release

Base: `9cc0ddc`; protected visual checkpoint: `9d339cb`.

Uses the existing local eight-preset controller, not a reconstruction. Candidate A's original visible skin and original dental geometry are loaded from the protected archived sculpt. No production source, approved asset, or jaw-cage source is modified.

## Released controls

Five enabled presets: Default sinister grin, Neutral, Angry, Surprised, Manic laughter. Jaw stays within 0–6 degrees. Neutral reduces smile/tension without requiring full closure; Surprised is softly open with mild rounding, not an anatomical pursed O. Three remaining targets are preserved in `experimentalPresets`, disabled in the UI and omitted from playback.

Strong rounding, compression and blink are capped below their rejected ranges. Competing mouth/brow/lid controls share continuous magnitude budgets. Independent sliders reflect the supported limits. The original zero state remains exact.

Automatic cycling varies transition/hold timing. All transitions ease from the current state and are interruptible. Four percussion rehearsal gestures (buttons or keys 1–4) return to the approved grin. They are timed/manual only; no microphone, percussion detection, audio integration or production mapping.

## Validation

`node tests/candidate-a-release-browser.js`

125 geometry samples: five endpoints, three interior samples for all ten preset pairs, twelve gesture samples, all individual limits including negative endpoints, and 48 deterministic combined-control poses. No nonfinite coordinates or reversed triangles relative to original normals; minimum signed area ratio 0.3665. Exact rest position/normal/index and dental-transform reset.

Actual front / three-quarter / profile endpoint renders inspected. Original wide grin remains the default. No strong-pursing tooth escape in the enabled endpoint views. No new conspicuous corner collapse, lip shelf, or jaw/chin failure in those views. Neutral remains a relaxed clown grin and Surprised remains a limited open-mouth surprise; do not relabel these as perfect closure or a pursed O.

Browser checks: interruption, destination convergence, cycling, rapid sequence, percussion rehearsal, exact reset pixels, disabled experimental targets, mobile-width Angry preset, no JS or asset failures. Cloud software frame median 41 ms, p95 102 ms: not an iPhone hardware guarantee.

27 existing unit tests, sculpt/expression cache checks, approved 26-file asset inventory, and Pages-base production build passed. Production source and prior development routes were compared unchanged against `9cc0ddc`.

Numerical sampling is not a proof of all-pose global collision freedom. No larger jaw range, full closure, full blink or strong lip purse is approved in this release.

Review: `public/candidate-a-rig/review.html`.

The rejected unrestricted local trial is retained as source text and failed endpoint metrics under `development-history/candidate-a-full-rig-pre-release/`; it is not a second runtime viewer.
