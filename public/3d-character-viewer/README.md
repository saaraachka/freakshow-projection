# Static Victorian clown sculpt review

Open `index.html` using the existing development viewer. Neutral clay is the default; turn it off to inspect ivory skin, a red nose, green irises and navy-black hair. Orbit, pinch/scroll zoom, eight full-head views, five feature close-ups, hair visibility and rendering resolution remain directly accessible. There are no facial pose, jaw-animation or audio controls in this static review.

Production FREAKSHOW is unchanged. This route loads procedural code and the bundled Three.js runtime; no GLB, image plane, SVG, sprite, character texture or paid service is used. The review PNGs are documentation, never model inputs.

## Geometry system

- `implicit-skin.js`: independently controlled cranial cross-sections form a Hermite-interpolated anatomical loft. Landmark relief defines the frontal eminences, glabella, temporal fossae, orbital shelves, zygomatic bodies, buccal hollows, maxilla, mandibular body and mental eminence. Broad asymmetric offsets affect the actual geometry. A monotonic expansion of the anterior half avoids folding the scalar field under large relief.
- The nasal root, cartilage tip, alar wings, columella and nostril cuts merge into the skin. Lips, philtral columns, Cupid's bow, nasolabial folds, commissures, under-eye folds and lid thickness are modeled in that surface. Differently tilted almond apertures expose seated globes. The irises and pupils are curved caps following the globe, not floating flat discs.
- Both pointed auricles belong to the same skin surface. Their field includes helix, antihelix fork, concha, tragus, antitragus, canal recess and lobule. There are no overlapping standalone ear shells or separate chin volume.
- `surface-nets.js`: shared dual-grid vertices and indexed faces replace the previous tetrahedral triangle soup. Subvoxel saddle collapses and disjoint-fan splitting repair ambiguous thin folds; a small Taubin relaxation retains landmarks. Normals follow the scalar-field gradient. This is a closed static surface, **not animation-ready quad retopology**.
- `sculpt-dentition.js`: 28 individually placed crown lofts have incisor, canine, premolar and molar profiles, enamel lobes, neck taper, cutting-edge/occlusal relief, uneven orientation and curved arches. Two large upper incisors and upper canines remain distinct. Three-dimensional scalloped gingival banks seat the crowns. The oral subtraction includes the cavity walls and back; lingual and palatal relief are inside it.
- `sculpt-hair.js`: 47 authored directional primary clumps produce an asymmetric quiff, temple curls, layered occipital falls and unequal sideburns. Secondary locks vary their path length, curl tightness, orientation and thickness. Fine flyaways follow those guides. Closed, tapered, lobed sweep sections replace both the torus groom and uniform scalp sampling. Guide-level ear clearance keeps locks out of the concha while preserving each cross-section. Curvature limits and radius fairing prevent tight sweeps from turning inside out. A recessed, carved undercoat joins the occipital masses. Hair is intentionally stylized into sculpted clumps rather than a strand simulation.
- `sculpt-worker.js`: skin generation runs in a module worker and transfers its generated buffers to Three.js. Heavy sampling does not block the page's main thread. The static scene renders only when changed.

The current model renders about 339,000 triangles, versus 423,108 for `b55c69e`. The skin has about 50,600 vertices. Counts constrain runtime cost; they do not establish artistic quality. Ordinary standard materials and fixed white studio lights are used in both color and clay modes. There is no NPR shader.

## Review and verification

`review/index.html` pairs the previous `b55c69e` model with this sculpt in identical neutral clay, white studio lights, camera positions and framing. The set includes front, left/right three-quarter, left/right profiles, back, top, underside, and eyes/nose/mouth/ear/hair close-ups. Color, bare-skin and WebKit phone views are additional checks. `review/sculpt/checks.json` records the automated results.

Geometry was rendered during successive skull/face, eye-depth/ear, groom, dental and final remeshing stages. Those checks exposed and corrected eye/dental projection, hair winding, exposed crown roots, flyaways crossing the concha and sub-grid surface pinches. The before/after gallery is the final static review; it is not an assertion of professional sculpt quality or artistic approval.

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html

PAGES_BASE=/freakshow-projection/ npm run build
node tests/sculpted-viewer-browser.js
```

Set `FREAKSHOW_WEBKIT_EXECUTABLE` to a supported Playwright WebKit executable to include WebKit. Set `FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/` for deployed checks. In this cloud, WebKit uses the trusted system CA store; `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` skips isolated Chromium profiles that lack the cloud proxy CA. TLS verification stays enabled.

To regenerate baseline comparisons, serve `b55c69e` separately and set `FREAKSHOW_SCULPT_BASELINE` to its viewer URL. The test captures that actual previous geometry with the same review setup; baseline images are not substituted for current renders.

Checks cover one connected closed skin surface, manifold edge incidence, finite attributes, four dental classes, geometric asymmetry, a triangle budget, real browser screenshots, clay/color and hair controls, orbit/zoom, iPhone-sized touch controls, console errors and failed assets. These are structural and interaction tests, not automated judgments of anatomical beauty or collision-free animation. No animation has been developed or validated. Physical iPhone Safari performance, thermals and pinch behavior still require device review. Artistic approval remains pending.
