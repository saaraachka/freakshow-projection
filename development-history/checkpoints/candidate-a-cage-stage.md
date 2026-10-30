# Candidate A jaw-control cage: first staged prototype

Plan committed BEFORE implementation: `8dc4977`, `public/candidate-a-cage/rigging-plan.md`. Visual source remains protected by `9d339cb` / `checkpoint/candidate-A-visual-approved`; `node scripts/check-candidate-a-lock.js` still verifies all 26 source/assets. Prior 0–3° trial and every existing viewer are unchanged.

## What was built

A Candidate-A-specific lower-midface rotational control volume: 15 lateral columns × 8 anatomy-aligned rows × 6 depth layers = 720 controls / 490 cells. Rows use Candidate A's original mouth-line/lip profile (half span .665, central half height .125), with .045 minimum control-band half-height beyond the commissures to avoid collapsed cage cells. This changes no visible lip geometry. Maxillary/support rows anchor upper tissue, commissure/cavity rows partly follow the jaw, and lower-lip/cheek/chin rows carry mandibular motion. Depth and lateral boundary controls are anchored.

Binding samples neighboring node **rotational influence**, not donor surface positions. This first single-axis jaw cage precomputes original-vertex influence/gradient from the volume, then transfers the common jaw rotation about the existing TMJ-axis coordinate. Each source vertex retains its own rest coordinate. C2 interpolation avoids cell-normal discontinuities, but is not a guarantee of anatomical quality. The original normal is transported with the Jacobian; rest is restored by an exact buffer copy. Lower teeth, gingiva and tongue rotate rigidly with their original rest transforms; the upper arch remains fixed. No dental offsets, corrective shapes, new skin, surface fitting, remeshing or generic donor.

The optional cage overlay depicts the control volume only. It is disabled by default and is not replacement visible skin. This is a jaw-stage control cage, not an independently editable all-expression facial cage.

## Staged visual evidence

- Static rest tested before binding: source positions/normals/indices and matched pixels identical in front/¾/profile.
- 3° compared against the prior small-jaw result; then 4°, 5°, 6° rendered and inspected sequentially. No weights were retuned between increments.
- The opening grows while the wide grin remains. No new lip shelf, collapsed corner, disconnected tissue or visible tooth escape was observed in these sampled views. This is not a global self-intersection certification.
- Tracked lip-landmark gap: .264266 at rest, .330537 at 5°, .343193 at 6°. It is a source landmark proxy, interpreted with the actual renders.
- At 6°: exact return to rest, fixed-region buffers unchanged, upper dental transforms unchanged, no nonfinite positions, same indices, no triangle reversals; minimum signed triangle-area ratio .634811. This does not prove volume conservation.
- Adjustable maximum amount and cycle duration, fixed-angle buttons, rest reset and optional cage display tested. Browser opening/closing is clock-driven and recorded; no physical-device FPS claim.

6° is the highest inspected stage, not an absolute maximum safe angle. Stop here for user visual review. Do not extrapolate to large openings or expressions. If a later gate fails, use the authored anatomical control-shell workflow described in the plan instead of starting a corrective-patch series.

Public review route: `public/candidate-a-cage/`. No production, prior prototype, visual checkpoint, hair, eyes, skull, nose, ears or brow asset was edited. No audio, percussion or expression work.
