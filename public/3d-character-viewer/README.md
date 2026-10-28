# Anatomical refinement of the approved clown

The development route remains `index.html`, with full orbit/zoom, neutral clay, fixed white studio lights, color inspection and hair visibility. **Compare sculpt** switches the refined head and the approved `28900d9` foundation without moving the camera. A second head is generated on first use and cached; only the selected head is rendered. There is no animation, audio response, NPR shader or production integration.

## Preserved foundation and rollback

Before geometry changes, commit `8e84931` saved the approved model in `approved/`. It is an independent working viewer, including its original model-generation modules and worker. Relative vendor paths were relocated; geometry, materials, lighting and generation parameters were retained. The Git tag `approved-static-sculpt-28900d9` preserves the original repository state. The comparison tests load that actual snapshot and verify every crown's geometry and placement against the refinement.

No illustration, sprite, image plane, SVG, GLB, external modeling service or Blender installation is used. Review PNGs document the model; none are loaded as character geometry or textures. Main production FREAKSHOW is unchanged.

## Targeted changes

- **Rear cranium:** the approved anterior loft and cheek landmarks are retained. A separate posterior profile supplies occipital depth, crown curvature and a fuller temporal-to-occipital transition. The posterior radius blends through the internal sagittal center, without scaling or translating the face. Hair-hidden profile, rear three-quarter and back comparisons expose the actual skull.
- **Lips:** regional upper-lip bodies, a central tubercle, paired Cupid's-bow peaks, a philtral groove/columns, upper white roll and vermilion borders belong to the same skin field. A fuller lower-lip body tapers toward the commissures; its border and labiomental crease blend into the jaw. These are volumetric facial relief, not tube meshes or painted lip outlines. The very wide grin and all 28 dental crowns/placements are preserved.
- **Ears:** the pointed outline is slightly narrower and less projected. Continuous cartilage relief defines a broader antihelix stem and bifurcation, helix/scapha, concha, tragus and antitragus. The old isolated spherical additions were removed. A shallow canal recess replaces the through-cut, and the lobule/temporal attachment remains continuous with the skin.
- **Eyes:** the globes are genuine spheres rather than flattened ellipsoids, seated beneath the existing sunken sockets. Apertures are slightly narrower to meet the globes at their corners. Lid relief and under-eye folds are broadened to avoid a sharp rim. Curved green irises and pupils follow the spherical surface; asymmetry and the unsettling gaze remain.
- **Nose and chin:** nasal-tip blending is wider, nostrils are smaller inclined recesses, and the columella transition is softer. Pogonion projection is reduced through the lower-face loft and mental relief, without replacing the approved jaw or cheekbones.
- **Groom:** the same 47 primary guides, irregular curls, quiff, sideburn design and seed are retained. Rounder cross-sections and shallower longitudinal grooves reduce blade-like edges. Posterior vertices follow the new cranial profile, including the recessed undercoat; front forelocks remain in place. Curvature caps, fairing, welded seams and guide-level ear clearance remain. Longitudinal samples were reduced slightly to keep the static triangle budget comparable despite the deeper skull.

`implicit-skin.js` defines the anatomical field; `surface-nets.js` extracts and repairs a shared indexed skin surface. A small Taubin relaxation, bounded projection back to the field, and field-gradient normals retain the forms. Conforming local subdivision around the small nasal cuts removes coarse serrated borders without increasing sampling density across the whole head. Sampling and meshing run in `sculpt-worker.js`, off the main thread. The scene redraws only on changes. The skin is a closed static surface, **not animation-ready quad retopology**.

The refinement remains around 346,000 rendered triangles, comparable with the approved model's 339,388. Counts are a runtime constraint, not evidence of sculptural quality. WebKit phone emulation does not establish physical iPhone frame rate, thermal performance or pinch behavior.

## Matched review and tests

`review/index.html` pairs the approved and refined models using identical clay, light colors/intensities, cameras and framing. It includes front, both three-quarter views, both profiles, both rear three-quarter views, back, crown, underside, lips, eyes, ears, nose and hair. Three additional hair-hidden comparisons isolate the skull. Color and phone screenshots supplement those views. Both versions can also be compared interactively in the same viewer.

Development renders were inspected after the cranial, lip/ear and eye/nose/groom stages. The profile check caught excessive new lower-lip projection; it was reduced before final comparisons. Clay review is still an artistic judgment: a render or topology pass alone does not establish the acceptance criteria.

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html
# http://localhost:5173/public/3d-character-viewer/approved/index.html

PAGES_BASE=/freakshow-projection/ npm run build
node tests/sculpted-viewer-browser.js
```

Set `FREAKSHOW_WEBKIT_EXECUTABLE` to a supported Playwright WebKit executable to include WebKit. Set `FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/` to check the deployed build. In this cloud, `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` uses WebKit's trusted system CA store rather than isolated Chromium profiles lacking the proxy CA; TLS verification remains enabled.

The focused browser check loads both real models. It verifies a single closed connected skin, manifold edge incidence, finite attributes, exactly spherical globe scales, unchanged crown vertices and transforms, stable anterior cheek projection, increased posterior extent, a bounded triangle count, and geometric asymmetry. It renders all comparison angles, decodes the gallery images, switches models without camera drift, tests orbit/zoom, clay/color/hair controls and iPhone-sized controls, and checks console errors and failed assets. Artistic approval and physical device review remain pending. No animation has been developed or validated for this refinement.
