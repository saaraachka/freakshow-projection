# Procedural 3D clown — structural refinement

Use the same `index.html` viewer and orbit/zoom controls. This development route is isolated from production FREAKSHOW. It uses only generated geometry: no illustration, plane, sprite, GLB or external model service. Lighting, camera presets, orbit controls and quality options remain unchanged for comparison.

## Anatomy

`implicit-skin.js` defines a continuous solid containing the reduced frontal/occipital vault, temples, orbital mounds, cheekbones, maxilla, mandibular body, chin, nose bridge and clown nose. Smooth unions blend those volumes. Recessed sockets and an oral cavity are cut into that same solid. Marching tetrahedra extracts one indexed, connected skin surface; normals come from the scalar-field gradient. The lip relief, mouth corners and nasolabial tension belong to this skin, rather than separate lip or eyelid tubes. There is no separate chin or neck ball. The head finishes in a continuous mandibular/submental surface.

The white globes sit inside the orbital recesses, behind the surrounding lid surface. Green irises and black pupils remain actual small dimensional lens surfaces. The red nose is part of the skin solid and blends into the bridge and alae. Its maximum forward extent and that of the eye volumes are reduced from the previous model. Pinnae have pointed upper helices, conchal bowls, antihelix folds, rear surfaces and thickness; their medial sections embed in the modeled temporal/mastoid roots. The ear shells are separate overlapping meshes, not a fully welded ear retopology.

The oral cut extends behind the teeth and includes an inner wall and back surface. Both gum arches now sit behind the facial border, so the lower ridge does not read as an external tube. All 24 crowns remain rigid. The lower teeth, gum ridge and tongue share a physical jaw hinge; a spatially weighted deformation moves the corresponding continuous skin and oral wall. Relaxed and asymmetric contours alter cheek/corner tension on the same topology. These are development studies, not a finished FACS or speech rig.

## Hair

The groom contains 762 deterministic, open 3D strands. Each varies radius, taper, thickness, handedness, turn count, orientation and drift. Coils progress along a local scalp tangent instead of circling one root like a torus. Sideburn locks and wisps change the silhouette. Color variation uses ordinary untextured standard materials; there is no NPR shader. Scalp color under the overlapping strands is part of the skin mesh, with an irregular receding boundary. The groom is merged for drawing and remains a volume from the rear and underside.

## Review and checks

`review/index.html` shows front, three-quarter, side, back, underside and jaw-open renders. Each required view includes the previous geometry for comparison with identical camera and lighting presets. The WebKit/iPhone-viewport screenshot and `checks.json` record current verification. Screenshots are evidence of this geometry, not approval of the sculpt.

```sh
PAGES_BASE=/freakshow-projection/ npm run build
node tests/sculpted-viewer-browser.js
```

Set `FREAKSHOW_WEBKIT_EXECUTABLE` to a supported Playwright WebKit executable to include WebKit. Set `FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/` to check the deployed route without a local server. The focused test checks:

- One connected skin component, finite matching geometry attributes and unit normals.
- No separate lip, lid, chin or neck meshes; bounded eye/nose projection.
- Open, varied, oppositely wound hair strands and an unchanged rigid crown arrangement through jaw deformation.
- All required camera views, real rendered pixels, mobile layout, orbit/zoom and jaw controls.
- No illustration/model requests, failed assets or application console errors.

Rendering pauses when idle. Mesh generation is synchronous once per page load (the measured generation time is in the report); pose changes update existing buffers. This higher-detail study has roughly 423,000 visible triangles. Use the existing **Lower cost · DPR 1** option if needed on a phone. WebKit viewport checks use software WebGL in this cloud and do not establish physical iPhone Safari frame rate or thermal performance. Actual device review remains necessary.

Production application files, audio detection and reaction code are unchanged. No production integration or NPR work is included.
