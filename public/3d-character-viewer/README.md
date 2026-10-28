# Procedural 3D clown — anatomy review

Open `index.html`. A visible Three.js character is generated immediately by `procedural-head.js`; no upload, GLB, external model service, illustration texture, sprite or production renderer is involved. Production FREAKSHOW is unchanged.

## Modeled geometry

The skin is one indexed polygon mesh continuing from lip border through cheeks, sculpted socket recesses, brow and nose-bridge volumes, forehead, jawline and chin, around the sides to the rear skull. An annular front topology preserves loops around the oral aperture. A continuous oral wall starts at the exact aperture boundary and recesses into a throat volume. Rounded lip geometry follows the same boundary. Lower-face deformation uses spatial hinge weights; lower crowns, gum ridge and tongue use one shared rigid jaw rotation. Each of the 24 crowns retains its vertices and dimensions when the jaw opens.

Eyes are solid eyeballs with separate iris and pupil meshes, surrounded by curved upper/lower lid volumes. The clown nose protrudes from the modeled bridge. Ear pinnae have a recessed bowl, raised outer helix, front and rear surfaces. Hair consists of dimensional spiral tubes merged into one draw mesh, with a modeled scalp surface beneath the rear curls. All surfaces use untextured clay materials and simple studio lights.

## This stage and its limits

The default is a wide tooth-bearing grin. The contour selector offers a relaxed smile and asymmetric smirk study. These currently recompute the same skin topology; they are not a completed library of artist-reviewed morph targets. Jaw deformation is geometric weighting plus a rigid lower-arch transform. The topology/rig organization supports future lip, cheek and expression work, but no music-reactive controller or vintage ink shader is connected.

This is an initial procedural anatomical study, not a finished sculpt or an assertion of anatomical accuracy. Ear-root blending, orbital/lid transitions, mouth-corner thickness, chin movement at large openings, posterior dental arch alignment and curl grooming remain refinement targets. Eyelids and pinnae are separate modeled surfaces that overlap the skin at their attachment, not yet a fully welded retopology. The lip loop follows the aperture but is also a separate volume. The rear skull is genuine mesh geometry, not a backdrop.

Inspect front, three-quarter, side, back, underside and jaw-open images in `review/`. Rotate the live head through 360°, pinch/scroll to zoom, or reset the camera. The wireframe and hair visibility controls expose geometry for inspection.

## Rendering and verification

The viewer only draws when the camera, pose, size or controls change; idle rendering pauses. The displayed metric is draws per second, not a continuous animation benchmark. Pixel ratio is capped at 2, with a DPR-1 option. This saves idle GPU work but does not establish sustained iPhone performance.

Run `PAGES_BASE=/freakshow-projection/ npm run build`, then `node tests/sculpted-viewer-browser.js`. Set `FREAKSHOW_WEBKIT_EXECUTABLE` to include WebKit. Set `FREAKSHOW_BASE_URL=https://saaraachka.github.io/freakshow-projection/` to verify the published route. Tests check generated mesh rendering, required views, rigid crown vertices under jaw rotation, mobile width, and absence of image/model requests. WebKit viewport checks are not physical iPhone Safari testing.

No model approval or production integration is implied by test success.
