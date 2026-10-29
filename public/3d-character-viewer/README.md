# Surface cleanup and angry brow · pass 9

Foundation: `3b89be9`, not an earlier sculpt. `baseline-3b89be9/` freezes that viewer, its procedural source, runtime and geometry caches. Only shared paths are relocated. The comparison selector retains it and `0054631`; the previous matched gallery remains at `review/carved-curls-3b89be9.html`.

## Scope

The existing 51 solid curl clumps, authored growth layout, carved channels, broad temporal/occipital halo, high hairline and cranial warp remain. No curl replacement or new support volume is introduced. Bounded Taubin fairing acts on the existing indexed mesh: stronger on the front, restrained on the back, with a maximum hair displacement of 0.018 model units. The geometry keeps its topology. Triangle orientation and area checks reject unsafe moves around thin CSG slivers. The original smooth Manifold normals receive restrained neighbor filtering so skinny triangles do not dominate the shading; analytical skin normals are retained.

The integrated brow ridge is mirrored, more prominent, and slopes down toward the inner brow and upward toward the tail. The dark navy brow marking follows the same anatomical ridge. It remains visible as actual relief in clay mode.

Exposed skin and auricular transitions receive restrained fairing capped at 0.004 units. The oral vestibule and globe-contact region are protected by a spatial mask. Continuous field normals retain the intended anatomical curvature without emphasizing tessellation. The upper scalp and cranial proportions are protected. Dental geometry, globes, irises, mouth opening and evil grin are retained. No animation, rigging, audio, production integration, textures or NPR work is included.

## Review and checks

The same interactive viewer retains orbit, zoom, clay, silhouette and mouth diagnostics. `review/index.html` contains matched front, both three-quarter views, both profiles, back, top, underside and close-ups, using identical cameras, zoom, material and studio lighting. Rendered PNGs are evidence, never replacement geometry.

```sh
npm run dev
npm run sculpt:bake
npm run sculpt:check
npm test
PAGES_BASE=/freakshow-projection/ npm run build
FREAKSHOW_WEBKIT_EXECUTABLE=/path/to/webkit node tests/sculpt-cleanup-browser.js
```

`npm run test:sculpt` builds and runs the current comparison. Tests check cache/source identity, preserved clump count and roots, crown coverage, closed connected hair, silhouette bounds against 3b89be9, exact hairline function, finite geometry, bounded fairing, symmetric angry brow direction, unchanged separate face parts and teeth, enamel containment, orbit/zoom, comparison switching, phone layout, gallery image decoding, and console/asset failures. The cache makes normal review fast; procedural source rebuilding remains available with `?generate=1`.

The mesh is kept within the existing mobile triangle budget. Idle rendering pauses. Browser phone emulation does not establish physical-iPhone thermal or performance behavior. Visual review, not successful compilation or polygon counts, determines artistic acceptance.
