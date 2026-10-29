# Sculpted clown curl clumps · pass 8

Working foundation: review release `0054631`. The high hairline and the complete skull/face are preserved. This is a hair-only reconstruction on the existing Three.js review route. Production FREAKSHOW, animation, rigging, audio, textures and NPR styling are unchanged.

## Comparison and rollback

`baseline-0054631/` freezes the previous viewer, generation modules and generated geometry; only shared-runtime and historical-gallery paths are relocated. Rollback tag: `curls-baseline-0054631`. The comparison selector also retains `7a6a104`; older snapshots remain linked through the archived galleries.

Actual old/new geometry switches without moving the camera, changing zoom, lighting or review material. `review/index.html` contains matched front, both three-quarter views, both profiles, back, top, crown, hairline, back hair, additional anatomical close-ups, opaque mouth diagnostics, unlit silhouettes and hair-hidden skull views. PNGs are render evidence, never substitute geometry.

## Modeling changes

- **Volume and silhouette:** the continuous skull-following support grows into fuller temporal, upper-side, crown and occipital masses. The back and top have their own authored crests, not just front-facing decoration. The visible forehead stays high and long; the skin and its cranial deformation are unchanged.
- **Curl system:** 51 authored pear-shaped solid clumps replace 129 swept curls. Broad scrolls alternate with swept folds. Their width, aspect, direction, handedness, contour, groove depth and curvature vary. Rolled crests, carved channels and flatter rooted heels shape the actual surfaces. There are no tube sweeps, toruses, ribbons, strands or wire flyaways in the new groom.
- **Rooting:** each clump joins the common hair volume. Low external temporal clumps trace back to hair-covered scalp rather than attaching to the bare forehead. Forehead protection retains the approved high line while allowing the external side halo to extend beside the head. The existing ear clearance also trims the added clumps.
- **Hairline:** the approved boundary function is unchanged. A thicker, rounded contact edge replaces the under-resolved thin cutoff. Crown coverage is checked against the supporting volume contained within the final union.
- **Solid construction:** each carved clump is a closed parametric solid, joined to the scalp-following support by exact Manifold Boolean union. Geometric guards retain the high hairline and ear clearance. Only the inner support uses implicit surface extraction; the visible curl channels are directly constructed surfaces. The free Apache-licensed Manifold runtime is vendored for optional browser source rebuilding; no external model is used. Closed, connected topology is checked before caching. Normal-aware simplification retains valid source geometry when contractions would damage it. No face data is simplified or deformed.

The result remains a stylized solid-clump sculpt. Matched neutral renders show a broader clown halo and remove the old swept-tube pattern. Some angular creases and broad exposed support surfaces remain visible at clump joins, particularly on the crown and back; these are known sculptural limitations, not hidden by the topology checks. This review is not an assertion of finished professional sculpt quality.

## Run and verify

```sh
npm run dev
# http://localhost:5173/public/3d-character-viewer/index.html?sculpt=8
npm run sculpt:bake
npm run sculpt:check
npm test
PAGES_BASE=/freakshow-projection/ npm run build
node tests/carved-curls-browser.js
```

`npm run test:sculpt` builds and runs the current browser comparison. Older browser-test entry points forward to it. `FREAKSHOW_WEBKIT_EXECUTABLE` adds WebKit; `FREAKSHOW_TEST_PORT` selects a local port. `FREAKSHOW_BASE_URL` selects the actual deployed HTTPS site, and `FREAKSHOW_REMOTE_WEBKIT_ONLY=1` selects WebKit for the cloud proxy. TLS verification remains enabled.

Checks cover source/cache identity; exact preservation of all skin positions, normals, colors and indices; unchanged separate facial meshes/transforms; preserved skull height and hairline; frontal clearance; greater lateral bulk and rear volume; fewer than half the previous logical curls; no strand sweeps or flyaways; one connected closed hair mesh; embedded roots; actual crown coverage; finite geometry; the mobile triangle budget; globe and enamel containment; comparison states; real mouse orbit/zoom; phone layouts; frozen standalone viewer; gallery decoding; and JavaScript/asset errors.

The generated geometry is cached for responsive review. Static rendering pauses at idle. Phone browser emulation is not a physical-iPhone performance or thermal measurement. No facial animation or production integration is part of this pass.
