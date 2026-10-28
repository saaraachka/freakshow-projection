# Skull and hair review · pass 5

This pass changes only the posterior crown, scalp interface and groom. The existing eyes, nose, mouth, teeth, ears, facial expression, materials and production application are preserved. There is no facial animation, audio integration or NPR shading.

## Preserved comparison

`baseline-8777414/` contains the complete pre-pass viewer, generation modules and generated meshes, saved before changes in commit `cba2a5f`. Only relative shared-vendor/comparison links were relocated. `skull-hair-baseline-8777414` preserves the original repository state. Earlier `baseline-6b838a5/` and `approved/` versions remain intact.

The current viewer switches the actual old/new meshes without changing the camera or lighting. Neutral clay, silhouettes, hair visibility, orbit and zoom work with either version. `review/index.html` includes matched front, both three-quarter views, both profiles, back and top, plus unlit head silhouettes, hair-only silhouettes and bare-skull comparisons. The previous precision gallery is retained at `review/precision-8777414.html`. PNGs document real renders; they are not character geometry or textures.

## Modeling changes

`cranial-refinement.js` starts with the unchanged anatomical mesh and applies a smooth posterior-crown warp. Its support excludes every vertex at or below y=0.60 and every vertex at or in front of z=0.12. This rounds the upper occipital/crown transition without resizing the face or moving the ears. The original skin topology is retained, and only supported normals are transformed with the inverse-transpose deformation Jacobian. Protected skin positions, normals and colors remain bitwise unchanged.

The scalp distance function follows that same anatomical loft and inverse posterior warp. The hair foundation tapers from approximately 0.006 units at the irregular hairline to 0.081 units inside the groom, replacing the separate thick cap edge. The anterior hairline has an asymmetric recession/forelock rather than a horizontal band.

`sculpt-hair.js` defines twenty authored primary masses, from the asymmetric crest and temples through the crown, occipital falls and nape. Their roots and paths are placed on the actual skull. Each mass owns two smaller curl rolls with different widths, directions and returns. Five finer flyaways have embedded roots. This replaces the previous 150 logical locks with 65, rather than adding randomly distributed curls.

Primary forms are filled, variable-width elliptical sweeps with substantial depth. Continuous cubic centerlines and transported frames avoid the segmented end caps of a union of short cylinders. The secondary curls blend into their parent masses; they are not separate rings attached to a shell. The groom is extracted as a single closed connected implicit volume, with the five rooted fine strands added separately. No torus meshes, image planes, sprites or ribbons are used.

The worker loads a reproducible compressed geometry cache for mobile review. At bake time, meshoptimizer may reduce the groom within an absolute error bound while protecting closed topology. This is a static sculpt and guide hierarchy for future rigging, not animation-ready retopology. The renderer still pauses when idle; there is no new animation loop. The validated scene renders 369,944 triangles versus 392,742 in the preserved version (about 6% fewer). This is a mobile budget check, not a measure of artistic quality.

## Build and verification

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html?sculpt=5
npm run sculpt:bake   # after procedural geometry changes
npm run sculpt:check  # source/cache match, also checked by Pages CI
PAGES_BASE=/freakshow-projection/ npm run build
node tests/skull-hair-browser.js
```

`tests/sculpted-viewer-browser.js` forwards to the current skull/hair regression. The precision-pass test remains in Git at 8777414. Set `FREAKSHOW_WEBKIT_EXECUTABLE` to a compatible WebKit executable to include WebKit, and `FREAKSHOW_TEST_PORT` to choose a local test port. `FREAKSHOW_BASE_URL` selects the actual HTTPS deployment. This cloud uses `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` for remote testing with the trusted system CA; certificate verification remains enabled.

The browser test compares the real preserved/current models. It requires exact equality of all non-hair mesh attributes/transforms/material colors, bitwise equality of protected skin attributes, unchanged skin topology, a lower/equal rendered triangle count, a closed connected groom, full sampled crown coverage and embedded fine roots. It exercises model switching, clay/silhouette modes, orbit/zoom, phone-sized controls and gallery decoding, and checks console/asset errors. `?generate=1` bypasses the cache for slower source generation.

Geometry checks and polygon counts do not establish artistic success. The matched clay and silhouette renders are the basis for review. Physical iPhone performance, thermal behavior and pinch gestures are not established by phone-sized browser emulation. Do not proceed to facial animation or other anatomy before this pass is reviewed.
