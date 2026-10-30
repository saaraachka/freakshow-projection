# Approved expression-rig milestone

Frozen from the user-approved `surprised-mild-local-30` local runtime. Visible skin, hidden cage, controller, materials, hair, jaw, and teeth are preserved without additional sculpt edits.

- Canonical Local-17 rest remains exact.
- Locked jaw rollback: `f6f7a88`, tag `checkpoint/hidden-cage-mouth-40`.
- Neutral and Angry unchanged from the approved prototype.
- Surprised Candidate A: jawOpen .38, browRaise 1, eyeOpen .90, grin -.10, cheekCompress -.18; lipRound and commissureIn both zero.
- Pairwise blends use one intermediate protected jaw solution and eased soft-tissue field interpolation. Approved matched midpoint renders are in `review/surprised-mild-local/`.
- No audio integration or production-app changes.

Runtime: `public/3d-character-viewer/surprised-mild-local-30/index.html`.
Review: `public/3d-character-viewer/review/surprised-mild-local/index.html`.
Regression: `node tests/expression-rig-milestone-browser.js` with optional `EXPRESSION_LAB_URL` and `EXPRESSION_BROWSER=webkit`. Compares exact geometry, normal, index and dental receipts captured from the approved local state.

Restore this milestone using tag `checkpoint/expression-rig-approved` in a separate worktree; keep the original dirty workspace intact. The independent checkpoint is backed up on `review/expression-rig-milestone`. Pages permits deployment only from main; publication adds only the development viewer, review renders, checkpoint records and regression check to current main. Production files are unchanged.
