# Continuous expression architecture · review candidate

This is a repair of the existing local, uncommitted prototype. The approved default viewer and production FREAKSHOW remain fed4cd1. Hair, skull proportions, hairline, source face positions/normals/colors/indices, dental crown geometry and source angry expression are preserved exactly. The before-repair implementation is saved in development-history/expression-prototype-before-flow; prior renders remain in ../review/expressions-wip-before-architecture.

## Structural change

The active rig no longer cuts a mouth region out of the face or stitches in an annulus. All states use the original connected skin vertices and indices. A compact C4 radial-basis velocity field transports lip motion through perioral tissue in 3D. Inner/outer/depth lip landmarks preserve flesh volume; nose and posed mandibular-surface anchors stabilize the skeleton. The jaw-tissue base, existing dental hinge, weights, easing and three expression presets are retained.

A separate continuous orbital field replaces the earlier cage's folded orbital tissue. Lids travel tangentially around the seated globes; inward radial motion is constrained in the socket. Clearance is integrated into the velocity rather than imposed by a discontinuous endpoint projection. RK2 integration and transported normals keep the field smooth. No new expressions, audio integration, NPR work or production integration are included.

## Review evidence

../review/expression-work-in-progress.html contains six states in front, three-quarter and profile, primary-transition quarter blends, tissue influence, the actual slow browser recording and prior defective renders. Rehearse O mouth runs Neutral → Surprised → Neutral. The full slow demo retains Neutral → Angry → Neutral → Surprised → Neutral. Both ease from the current state into neutral before starting, avoiding a demo-start snap.

Chromium and WebKit checked controls, comparison, cached assets, presets, phone layout and console failures. Twelve sampled configurations covered endpoints and quarter blends on all three expression-pair edges, with no detected skin self-intersections, collapsed mouth triangles, open/non-manifold edges, or globe intrusion beyond the recorded numerical tolerance. The source static geometry, hair and tooth crowns match fed4cd1 bit-for-bit.

The visible-enamel probe uses a coarse virtual aperture: the unchanged approved grin has three probe misses, the mixed expression one, Neutral and Surprised zero. These are retained in checks.json and are not presented as proof of zero clipping. Actual matched renders and the slow recording were inspected separately. Phone testing is emulation, not a physical-iPhone performance test.

## Reproduce

- npm run dev: approved default viewer plus /public/3d-character-viewer/expression-lab/index.html
- npm run expressions:bake: rebuild cached targets from procedural source
- npm run expressions:check: verify source/cache identity
- npm test and npm run sculpt:check: existing application checks
- With the dev server running: node tests/expression-architecture-browser.js
- Optional cloud WebKit/video setup: PLAYWRIGHT_BROWSERS_PATH=/tmp/freakshow-browsers FREAKSHOW_WEBKIT_EXECUTABLE=/tmp/freakshow-webkit-run

The ordinary viewer loads a generated shared-topology morph cache. ?rebuildExpressions=1 exercises source generation. Cache generation is local procedural geometry, not an imported external model. No user modeling software is required.
