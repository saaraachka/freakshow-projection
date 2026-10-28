# FREAKSHOW 3D anatomy development

Stage 1 review candidate. Open `public/character-3d/index.html` through a web server. Production code, detection, saved songs, mappings and the approved mouth prototype are not imported or modified.

Three.js r180 and OrbitControls are vendored under `vendor/`, including their MIT license. No external runtime requests or illustration textures are used.

The front face is a radial quad surface with a genuine oral boundary. Its outer contour meets a rear skull hemisphere. Malar bulges, a mental prominence and nasolabial valleys are modeled in the surface. Aperture vertices lead into an oral tunnel, with a recessed cavity bowl. A continuous rounded lip loop follows the aperture. The lower surface receives a spatially weighted hinge deformation; weights decay to zero at the skull boundary. The same hinge carries the lower dental arch, gum ridge and tongue. Crowns retain their individual geometry and dimensions. Orbital rims, lids, brows, ears, nose and hair are separate three-dimensional volumes, with normal depth testing.

This is procedural sculpting blockout geometry, not a scanned anatomical model. Eyelid attachments, smile shaping, gum exposure, rear/front surface continuity and jaw deformation remain visual review criteria. Do not describe it as anatomically approved based on code checks. There are no facial morph targets or emotional rig controls yet; the four anatomy poses change smile and hinge parameters. The default is the grin.

Orbit/pinch controls, front/three-quarter/side presets, topology inspection, hair visibility, jaw opening, FPS/triangle reporting and DPR-limited rendering are available. Lower cost changes output pixel density only. Mobile layout and actual WebGL rendering are checked in Chromium and WebKit at an iPhone-sized viewport; physical iPhone Safari, thermal performance and sustained frame rate have not been verified for this new model.

Review captures: `public/character-3d/review/`. Run `node tests/character-3d-browser.js` with system Chromium and Playwright to regenerate them. They demonstrate rendered geometry; they do not establish anatomical quality.

## Next review gates

1. Review neutral anatomy, default smile, front, three-quarter, side, open and closed mouth.
2. After anatomy review, implement independent emotional morph targets and speech articulation, with lip/cheek/chin/eyelid/brow coordination, and publish expression review renders.
3. Only after expression review, build the separate layered motion controller and tempo/onset/phase/confidence tracking with ambiguity handling, smooth tempo changes, manual BPM and tap tempo, beat simulation and microphone controls. Preserve production detection and Song Lab data.
4. Production integration requires explicit character approval.

WebKit review: `node tests/character-3d-webkit.js` (requires Playwright WebKit and host dependencies; optional `FREAKSHOW_WEBKIT_EXECUTABLE`). Cloud software rendering measured roughly 1–3 FPS in the desktop capture run; this is not an acceptable performance target or a physical-device benchmark. Further batching and on-device profiling remain necessary before production integration.
