# Candidate A — focused lower-lip / chin anatomy correction

Prior deployed version: f21f9c0, preserved byte-for-byte under public/candidate-a-rig-v2/. Its nine-file SHA-256 inventory is candidate-a-six-expression-rollback.json and its restore tag is checkpoint/candidate-a-six-expressions-before-lip-chin.

One expression-only correction pass on the existing surface. No remesh, jaw/cage mechanism edit, tooth geometry/transform edit, hair/skull/ear/eye/nose source edit, or production integration.

The lower-lip body translates slightly backward across a broad volume; the labiomental tissue gains smooth support and the central chin pad has a modest forward offset with no width increase. The support fades in with smileToFrown and is exactly zero at the original grin. Maximum corner descent was reduced from .34 to .29; corners also move gently inward. The monotonic mouth-mood strength curve maintains relaxed corners near the slider midpoint. Neutral and Frown use more of the existing bounded closure channel.

Validation: node tests/candidate-a-lower-profile-browser.js

142 samples without invalid or reversed triangles; minimum signed area ratio .19845. Exact rest buffers/indices and dental reset. Pixel-identical original grin against the frozen prior runtime. Same-camera before/after Neutral, Frown, Surprised and original grin inspected front/three-quarter/profile. Supporting Angry/Manic and midpoint/open-jaw mouth-mood views inspected.

Central lip/chin depth step: Neutral .08472 → .01849; Frown .08209 → .01674; Surprise .11456 → .04863; original grin unchanged .08039. These are source-landmark proxies, not claims of human anatomical accuracy.

All 27 normal unit tests, sculpt/expression cache checks, protected 26-file original asset inventory, and Pages build pass. Interruption, cycle/rehearsal/rapid gestures, exact reset pixels and mobile-width controls pass. No new microphone or audio work.

Limits: still a stylized tooth-bearing mouth, not fully sealed lips. Jaw remains 0–6°. Numerical sampling is not an all-pose global intersection proof.
