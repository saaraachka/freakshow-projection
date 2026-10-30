# Validated opening-range checkpoint

The approved 25% deformation code and numeric cage map are unchanged. The 30%, 35% and 40% front/three-quarter/side samples pass the focused visual review. Highest clean tested sample: 40%. No failure threshold beyond 40% is claimed.

Canonical rest buffers remain exact before and after each sample. Existing canonical sculpt roughness remains; no new opening-related artifacts were identified in these views. No full collision/intersection certification is implied.

No Angry/Surprised presets or production integration. Matched review: ../review/jaw-opening-range.html. Script: scripts/review-jaw-opening-range.js.

The first controller-integration step exposes `assetViewer.setExpression({jaw: .35}, {immediate:true})` and `character.expressions.setJawOpening(value)`, clamped to 0–40%. `scripts/check-opening-channel.js` verified exact driver/controller equivalence at the three reviewed openings and exact rest reset. No expression presets were added.
