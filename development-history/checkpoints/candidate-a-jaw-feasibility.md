# Candidate A: protected visual reference and bounded jaw prototype

## Immutable content checkpoint

User-selected Candidate A is fed4cd1, surface cleanup + angry brow. Commit `9d339cb` and tag `checkpoint/candidate-A-visual-approved` preserve its exact archived source and associated assets. The SHA-256 inventory covers 26 source/vendor/cache files. Git commits identify immutable content; the tag is a restore pointer, not a claim of GitHub tag-protection administration. `node scripts/check-candidate-a-lock.js` checks the inventory. No original asset is edited by this prototype.

## Audit / approach selection

Original skin: 82,720 vertices / 165,436 triangles, zero boundary/non-manifold edges and zero triangles below 1e-12 area in the cached source. It is a surface-nets triangle sculpt, without authored facial loops, bones or skin-weight semantics. Manifoldness does not imply animation readiness.

Reuse the exact original render skin, hair, skull/ears/nose/brow/eye assets, dental crown shapes, studio viewer and the general transverse TMJ-axis coordinate from previous work. Do NOT reuse Local-17 rest skin, its donor binding/lip station map, old expression correctives, cached neutral mouth or dental seating offsets. Those depend on a different face/topology or change the approved appearance.

Chosen narrow feasibility method: ordinary smooth angle-weighted jaw rotation on the original vertices, with upper face anchors, commissure/cheek falloff and rigid chin/lower-lip participation. Lower crowns, gingiva and tongue use the same rigid jaw rotation. Existing crown transforms are restored exactly at zero; no LOWER_DENTAL_SEAT offset, jaw translations, corrective sculpt or mesh replacement. Normals are transported analytically from original normals; no smoothing/normal recomputation changes stationary tissue. This is a single bounded 0–3° trial, not a corrective tuning series.

## Gates and evidence

Static gate ran BEFORE enabling/binding the jaw. Original/prototype positions, normals and indices match; front, three-quarter and profile pixels match. Actual static renders inspected: original wide grin, dental display, cheek structure and angry brow retained.

Then 0°, 1°, 2°, 3° matched views were inspected. The small opening keeps the upper lip anchored while the lower lip, chin, teeth and surrounding soft tissue follow the jaw. Return-to-rest restores source buffers and original dental matrices exactly. Fixed tissue and upper teeth are unchanged; no new nonfinite positions or triangle orientation reversals/degenerates in the sampled maximum (minimum signed area ratio ~.7504). This is not a global self-intersection guarantee for every preexisting dental/skin surface.

The browser's real-time slow opening/closing uses wall-clock phase through requestAnimationFrame. A short browser recording is included, plus an interactive preview. Static reference rendering pauses while only the prototype moves. No physical-device FPS certification is claimed.

## Recommendation / limits

This establishes a limited jaw feasibility channel, NOT a full animation-ready facial rig. Do not extend to larger openings or expressions by adding patches/threshold correctives. The reliable next workflow for substantial facial motion is a Candidate-A-specific, artist-authored control cage with intentional mouth/eyelid flow and manually checked weights, driving the unchanged original render surface with rest-offset preservation. Static appearance must pass before each motion gate. Do not use another visible generic donor fit as a shortcut to likeness.

The separate public prototype at `public/candidate-a-jaw/` is review-only. Existing comparison, expression rig, gesture viewer and production remain unchanged. Candidate A is the definitive visual target, but this new jaw prototype is not promoted as the approved character until reviewed. No percussion, audio or new expression channels are added.
