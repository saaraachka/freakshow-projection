# Candidate A — distinct mouth mood and sixth frown preset

Starting checkpoint: bcf1c0e. The prior runtime is preserved byte-for-byte under public/candidate-a-rig-v1/ with a seven-file SHA-256 inventory in candidate-a-five-expression-rollback.json. The existing event-rig tag remains unchanged.

No remeshing, skin replacement, jaw/cage source change, dental transform change, hair/skull source change, or production integration. The original grin at zero is exact.

Added smileToFrown (0 original grin, approximately .5 relaxed/level, 1 full stylized frown). The perioral field moves outer and inner lips together and extends into cheek support; it does not scale the aperture or rebuild lip volume. A nonlinear monotonic strength curve creates a useful continuous range. Lower support fades into the chin; the first overly broad influence was rejected for pulling the jaw outline down too far. Independent negative corner controls now have broader depressor support; positive corner lift remains the previous field. Combined corner/mood strength is bounded.

Six enabled presets and six-entry automatic timings: original grin, Neutral, Angry, Surprised, Manic laughter, Unhappy / creepy frown. A prominent slider supplements the existing individual controls. Rehearsal, easing, interruptions and exact returns remain in place.

Validation: node tests/candidate-a-frown-browser.js
142 geometry samples, zero nonfinite/reversed triangles, minimum signed area ratio .084713. Rest position/normal/index buffers and dental transforms restore exactly. All six endpoints were inspected in front/three-quarter/profile, three representative midpoints in front/three-quarter, and five fixed-3-degree jaw mouth-mood samples with unchanged brows. Browser interactions, mobile width, rehearsal and reset pixels pass. 27 unit tests, cache checks and approved-asset inventory pass.

Limits: Neutral/frown retain some teeth and stylized anatomy; not a completely sealed human neutral. Jaw stays 0–6 degrees. Surprise is softly open, not a pursed O. Numerical sampling is not an all-pose intersection proof. Source and visual comparisons, not compilation alone, formed the release decision.

Production FREAKSHOW and all original Candidate A asset files remain unchanged.
