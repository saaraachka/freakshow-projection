# Candidate A Live Show release

Protected rig/source base: `092423592144ffc9104554f51c243ad20102b715`.
Release restore pointer: `checkpoint/candidate-a-live-show-1`.

## Scope

- Main FREAKSHOW Live Show tab embeds a lazy, independent WebGL stage. Direct stage supports fullscreen and a synchronized separate projector window. Song Lab/Visual Studio remain available.
- Uses the exact existing Candidate A factory, rig, six presets, constraint function, original jaw and dental transforms. No geometry, shading design or original rig files changed.
- LiveInput owns microphone/device selection, cancellation, resume, cleanup, input meter and silent graph. Onset detection runs in the audio worklet and uses the existing pure FFT implementation; the main thread handles bounded gesture envelopes and display only.
- Distinct kick/snare/clap/optional-hat/melody gestures, absolute-time attack/release, overlapping bounded controls and deliberate melodic reattack separation. Smooth interruptible presets/demo, reset, restrained shared gaze/head idle motion. Audio-reactive toggle independent from microphone connection; manual control works without capture.
- Rendering uses GPU fences to avoid piling frames onto a slow GPU, and skips unchanged poses. Head/root motion is a transform of the approved character, not a sculpt edit.
- Offline cache includes only production/show assets and approved dependencies. No failed mouth-architecture directory exists in this release worktree/build. Those experiments remain in the old worktree and verified local archive `/workspace/attachments/candidate-a-mouth-architecture-local-failed.tar.gz`, not merged.

## Verification

- 34 unit tests pass; existing sculpt/expression caches match; all 26 protected source/assets match approved inventory.
- Chromium production base-path run: actual captured synthetic WAV via getUserMedia/audio worklet/FFT/detector; kick/snare/clap/melody detected; optional hats ignored in output by default; microphone controls, input meter, actual fullscreen, projector pose synchronization/reset, rapid overlap, six presets/demo, denied-permission manual fallback, main-app integration and capture teardown on mode change.
- WebKit production base-path run: synthetic MediaStream through same worklet; bass reactions, actual fullscreen, projector sync, manual fallback, six presets, demo and reset.
- Frozen 82,720 native skin vertices return exactly to rest. All 12 sampled peak/rapid cases finite with no reversed source-relative triangles; minimum sampled signed-area ratio approximately .20 (existing Neutral preset). No global all-poses collision proof claimed.
- Offline production reload renders original sculpt and starts the audio worklet without a network connection.
- Actual color renders inspected. Consolidated evidence published at `public/live-show/review.html` and its JSON observations. No claim of testing physical OS audio interfaces; heuristic instrument labels are not source separation.

Production output is intentionally updated only by this authorized audio-reactive integration. Approved rig viewers and older rollback checkpoints remain byte-unchanged. No percussion mapping into experimental/rebuilt geometry.
