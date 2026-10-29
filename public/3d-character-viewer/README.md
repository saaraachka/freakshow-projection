# Forehead and clown silhouette · pass 7

Foundation: deployed review candidate `7a6a104`. This is a proportional refinement of the same static sculpt. Production FREAKSHOW, facial animation, rigging, audio detection and rendering style are unchanged.

## Preserved versions

`baseline-7a6a104/` is an independent copy of the prior viewer, procedural modules and generated meshes. Only shared-runtime and comparison/gallery paths were relocated. The rollback tag is `silhouette-baseline-7a6a104`. The selector also retains the earlier `7e5a8e3` foundation. Previous review galleries and snapshots remain available.

Switching versions preserves the exact camera position, target, zoom, lighting and review mode. The gallery pairs front, both three-quarter views, both profiles, back, top, underside, detail views, unlit silhouettes, opaque mouth diagnostics and hair-hidden skull views. Its images are actual browser renders, never substitute model geometry.

## What changed

1. **Upper skull / forehead:** `cranial-refinement.js` adds a smooth monotonic height deformation above y=0.48, reaching +0.32 units at the crown. The existing posterior depth correction is retained. The map and its inverse are shared by the skin and scalp, and normals use the inverse-transpose Jacobian. The lower face and ear geometry remain unchanged; this is not whole-head scaling.
2. **Hairline:** `hair-support.js` raises the frontal boundary by about 0.43 units at the center and carries the recession farther into the temples. Fringe roots move upward. Front-facing crown curls grow back over the crown rather than spilling down toward the brows. Fine flyaways now start at high crown roots.
3. **Clown hair silhouette:** four smoothly blended rounded temporal/occipital supporting volumes establish lateral mass behind the temples and ears. Curl guides gain lateral reach while retaining embedded scalp roots. Their visible sections are seated on the rounded support surface. These masses replace the flat shelf produced by simply widening a scalp shell. The existing six growth regions, tapered volumetric cross-sections and five flyaways remain; there is no random multiplication of curls or polygon-density increase used as a substitute for form.
4. **Eyes, mouth and ears:** the previous candidate's anatomy is retained in this proportion-focused pass. No eye, lip, dental, nasal, jaw or ear redesign is claimed. Tests compare protected skin positions/normals and all separate facial meshes and transforms against the frozen candidate. Existing seated-globe and visible-enamel containment checks still run.

Some curl shapes and the supporting hair surface remain simplified and procedural. This pass is for reviewing upper-head proportions and a broader clown silhouette, not a claim of finished professional hair sculpting. Further ear and facial polish remains separate work.

## Development and validation

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html?sculpt=7
npm run sculpt:bake
npm run sculpt:check
npm test
PAGES_BASE=/freakshow-projection/ npm run build
node tests/clown-silhouette-browser.js
```

`npm run test:sculpt` builds and runs the current comparison. Older browser-test entry points forward to it. Set `FREAKSHOW_WEBKIT_EXECUTABLE` for WebKit, `FREAKSHOW_TEST_PORT` for the local port, or `FREAKSHOW_BASE_URL` for the deployed HTTPS viewer. `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` selects WebKit for the cloud's remote test; TLS verification remains enabled.

The browser regression records measured skull rise, frontal hairline and visible-curl rise, total hair width and a side-volume percentile. It checks unchanged protected face geometry and topology, unchanged separate facial parts, complete seated globes, sampled exposed enamel contained by the oral cavity, embedded hair roots, crown coverage, finite geometry, source/cache consistency, all three comparison states, matched clay and silhouette images, actual mouse orbit and zoom, phone layouts, frozen standalone viewer and gallery assets. Measurements and unit tests support the actual render inspection; they do not establish artistic acceptance.

Phone-sized Chromium/WebKit tests are browser emulation, not physical-iPhone performance, thermal or gesture certification. The viewer remains static and pauses rendering when idle.
