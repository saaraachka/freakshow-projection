# Precision correction of the preserved static sculpt

The development route is `public/3d-character-viewer/index.html`. It retains orbit/zoom, consistent white studio lights, clay/color, hair visibility and the camera-preserving before/after switch. Close-up buttons cover eyes and mouth from front, three-quarter and profile, plus both mouth corners. **Mouth tissue colors** distinguishes opaque skin, lips, gums/palate/tongue, enamel and cavity walls without hiding geometry. Surface-role labels are approximate vertex colors.

Production, audio, animation and NPR code are unchanged. This is a static review, not animation-ready retopology or a claim of professional sculptural quality. No Blender, external model/service, SVG, image planes, sprites or texture-based replacement geometry is used.

## Rollback and comparison

Before corrections, commit `deb17a1` preserved the complete pre-correction viewer and geometry modules in `baseline-6b838a5/`. The exact source revision is recorded there. The `precision-baseline-6b838a5` Git tag preserves the original repository state. The live comparison loads this actual snapshot, caches both heads and renders only the selected head. The older `approved/` snapshot and its original tag are also retained.

`review/index.html` pairs the current and pre-correction head with identical camera, framing, neutral clay and lighting, including crown/back, both profiles, both three-quarter views, underside, bare skull, eyes, mouth corners, ears and nose. Additional matched tissue diagnostic views expose clipping. Review images document real Three.js renders; they are never used as character geometry.

## Corrections

- **Hair:** a closed full-crown foundation and seven asymmetric masses establish scalp coverage. Twenty-three named flow guides establish the crest, temples, fringe and occipital direction. Seventy-three unequal smaller curl clumps follow region-specific root directions; eight fine rooted flyaways break the silhouette. Rounded cross sections, fair centerlines and curvature-limited radii define solid curl sweeps. These are blended into the foundation as one implicit volume and extracted with shared-edge marching tetrahedra; separate intersecting sweep meshes are not rendered. Unrooted islands are removed. Eight finer flyaways have roots embedded in that closed connected groom. There are no torus meshes. This is static geometry, not animation-ready retopology.
- **Eyes:** the old closed socket cutter left a rear skin cap across the globe sides. The new aperture opens into a rear orbital vestibule. This removes the false cutaway while preserving narrowed lids and sunken placement. Complete spherical globes have a small corneal bulge; green iris and black pupil caps follow that surface. No clipping planes or transparent eye materials are used. Continuous lid tissue follows the actual globe envelope, preventing the external skin from falling behind its outer hemisphere. Lid/canthus vertices receive local conforming refinement and fairing.
- **Mouth:** the old arch was positioned independently of cheek thickness and opening, allowing posterior crowns outside the facial silhouette. The posterior arch now returns inward and backward, with orientation following the elliptical arch normal. Individual crown shapes, identities, size and order are preserved. The oral vestibule expands behind the lips while keeping a cheek wall. The opening/lip relationship covers roots; gum banks move behind the lip border. The former overextended palatal roof is rebuilt with a curved anterior boundary behind the teeth.
- **Ears and skin:** thinner helix/cartilage relief, shallower backing and gentler nasolabial transitions reduce thick rims and abrupt creases. The existing skull loft and face proportions remain the foundation.

## Verification

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html
npm run sculpt:bake   # after changing procedural geometry
npm run sculpt:check  # also enforced by Pages CI
PAGES_BASE=/freakshow-projection/ npm run build
node tests/sculpted-viewer-browser.js
```

Set `FREAKSHOW_WEBKIT_EXECUTABLE` to a compatible Playwright WebKit executable to include that engine. `FREAKSHOW_TEST_PORT` selects the local test port. `FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/` exercises the actual deployment. This cloud's HTTPS test uses WebKit's trusted system CA with `FREAKSHOW_REMOTE_WEBKIT_ONLY=1`; certificate verification stays enabled.

The focused browser test checks closed connected skin, finite attributes, bounded triangle count, unchanged crown shape hashes, preserved posterior extent and cheek projection, full crown foundation coverage at sampled skin vertices, globe radii/visibility and enamel containment. Dental checks sample both vertices and triangle centroids, rejecting enamel points outside both the oral void and skin, and crown bodies outside the oral cavity. Hair checks require one closed connected core and embedded flyaway roots. It exercises orbit/zoom, comparison, clay/color, diagnostic and iPhone-sized controls, renders the mandatory views and checks console/asset failures.

The worker normally loads a gzip cache of our own generated position/normal/color/index arrays (about 5 MB total). At bake time, meshoptimizer simplifies the groom with an absolute error limit and protected topology, concentrating the mobile triangle budget on curved regions. `npm run sculpt:bake` reproduces it from the procedural source. The manifest records a source hash; browser tests and Pages CI reject stale caches. `?generate=1` on the development viewer bypasses the optimized cache and rebuilds the unsimplified procedural surface in workers; this is substantially slower and has more triangles. No external GLB is involved.

Counts and topology checks do not establish artistic acceptance. The static groom, lip anatomy and facial integration remain subject to visual approval. Phone-sized Chromium/WebKit rendering is not a physical iPhone performance, thermal or pinch test.
