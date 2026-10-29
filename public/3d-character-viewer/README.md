# Reference-guided static refinement · pass 6

The current development viewer compares the reference-guided sculpt against a frozen `7e5a8e3` model. Production FREAKSHOW, detection, audio, animation and NPR shading are unchanged.

The four supplied image references inform grouped tapering curls, root direction, overlapping clumps, and readable stylized facial transitions. They are visual guides only; the model remains procedural 3D geometry. No image planes, texture substitutes, toruses or external model assets were introduced. Artistic approval remains pending. The current candidate still has simplified, tubular curl shapes and visible undercoat in places; it does not yet meet the full professional hair-design target.

## Preservation and comparison

`baseline-7e5a8e3/` preserves the prior source modules, compressed meshes and viewer. Only shared-vendor and comparison/gallery paths are relocated. The earlier `baseline-8777414/`, `baseline-6b838a5/` and `approved/` versions remain available. The rollback tag is `reference-baseline-7e5a8e3`.

The main viewer switches actual meshes while retaining camera, target, zoom, lighting, clay/silhouette modes and orbit controls. `review/index.html` contains paired whole-head views (front, both three-quarter views, both profiles, back, top, underside), hairline/crown/back-hair and anatomical close-ups, opaque mouth diagnostics and unlit silhouettes. The previous gallery is retained as `review/skull-hair-7e5a8e3.html`. Review PNGs are real renders, never character geometry.

## Geometry changes

- `hair-support.js` defines six growth regions: asymmetric fringe, left/right temples, crown whorl, occipital fall and nape. Their root rows are staggered, with different sweep, lift and fall. A continuous thin scalp-following envelope supports the groom and preserves crown coverage; the previous twenty large exposed lobes are removed.
- `sculpt-hair.js` builds volumetric clumps along each region's growth direction. Bent curl axes follow the skull; radius, tightness, handedness, phase, width and tip taper vary deterministically. Closed transported cross-sections have substantial depth and shallow longitudinal fluting. Five fine flyaways start inside parent clumps. The reference-guided groom remains a review candidate, not approved professional sculpting or animation-ready topology.
- `implicit-skin.js` seats the globes slightly farther forward and replaces the self-referential socket subtraction with a spherical chamber inside a thicker tissue envelope. The almond apertures retain the narrowed expression. Upper and lower vermilion volumes are strengthened within the same skin surface. Nasolabial creases soften; auricular helix/antihelix/tragus relief is thinner; nasal-tip and nostril blending is smoother. Skull landmarks, posterior depth and the cranial warp remain unchanged.
- `sculpt-dentition.js` keeps every crown's identity and local geometry. Roots follow the curved upper/lower lip landmarks, and the posterior dental arch recedes farther into the oral cavity. The teeth are not globally shrunk.

The compressed geometry cache is generated reproducibly from these source modules. The renderer pauses when idle. Mobile viewport checks and a triangle ceiling do not establish physical-device speed or artistic success.

## Run and validate

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html?sculpt=6
npm run sculpt:bake
npm run sculpt:check
npm test
PAGES_BASE=/freakshow-projection/ npm run build
node tests/reference-refinement-browser.js
```

`npm run test:sculpt` builds then runs the current browser regression. The older test entry points forward to it. Set `FREAKSHOW_WEBKIT_EXECUTABLE` to include WebKit, `FREAKSHOW_TEST_PORT` to choose the server port, and `FREAKSHOW_BASE_URL` for deployed HTTPS checks. `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` selects WebKit for deployment testing in this cloud; TLS verification remains enabled.

Checks cover source/cache identity, complete globes and visible spherical surface samples, unchanged tooth crown geometry, exposed enamel contained in the cavity from multiple directions, embedded clump roots, sampled crown coverage, unchanged cranial warp, finite geometry, preserved camera on comparison switch, real mouse orbit/zoom, phone-sized controls and failed assets/JavaScript errors. The gallery records identical-angle before/after renders. The frozen standalone viewer is also exercised.

Review the renders for remaining stylization, repetition, undercoat visibility and intersections. These are not certified professional sculpture or physical-iPhone performance results. No animation or production integration should begin until the static sculpt is approved.
