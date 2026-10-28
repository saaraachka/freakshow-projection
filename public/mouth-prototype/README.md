# Mouth and lower-face anatomy study

Review prototype only. The production renderer, clown artwork, audio analysis, and Song Lab are not imported or changed.

Open `public/mouth-prototype/index.html` through the existing development server or GitHub Pages. The existing build copies this directory without changing the production entry point. This page does not register a service worker or load external libraries.

## Construction

- **Upper face, cheeks, lip volumes and chin:** one triangulated annular surface, with shared indexed vertices and identical topology in all poses. The inner boundary is the vermilion rim, not an image pasted over a face. Its intermediate rings carry the lip displacement into the cheeks and outer jaw contour. Cheek compression/extension, lip protrusion and chin travel change with articulation. A procedural nose mound anchors the upper surface.
- **Mandible:** a rigid jaw body with two side supports rotates about a transverse hinge at y=320, z=-180. The lower gum, lower crowns and tongue receive the same rigid transform. Facial skin blends that hinge motion into the connected lower cheeks and chin.
- **Dentition:** twenty named, individually modeled crowns, including two upper front incisors and two longer upper fangs. Crown vertices are created once. Upper crowns stay fixed; lower crowns rotate with the mandible. Nothing rescales teeth to fit an expression.
- **Gums:** separate scalloped surfaces cover the crown roots. The tongue sits behind the dental arches. The dark cavity is recessed behind all of them.
- **Occlusion:** WebGL depth testing resolves facial tissue, gums, individual crowns and tongue per pixel. Facial tissue is shaped to enclose the dental arches outside the lip aperture. There is no horizontal clipping divider, sprite overlap repair, or automatic image stretching. The cutaway omits tissue and the dark cavity so the jaw attachments can be seen.

Closed, O, A and E have distinct width, jaw angle, corner location, upper-lip lift, curvature, cheek tension and facial silhouette. The rehearsal articulates O, A and E at 0.72-second intervals, with a closed phase between gestures. Motion integrates in small time steps independently of the display refresh rate; Pause freezes the current state.

## Review and limits

Use the expression buttons and strength slider for contour and closure. Use the wireframe for the continuous face topology, and the cutaway, angle control and tooth labels for attachments and tooth identity. Review evidence is stored under `review/` after running the browser inspection.

This is a simplified anatomical study, not a finished clown design or a muscle/soft-tissue simulation. The hinge is an approximation without condylar translation; tissue deformation is authored rather than physically simulated. The crowns, cheeks, philtrum and lip volumes still need artistic judgment. The prototype must pass human visual review before any production integration.

## Verification

```sh
npm run build
node tests/mouth-prototype-browser.js
```

The browser check uses the existing Playwright installation and `/usr/bin/chromium` (override with `CHROMIUM_PATH`). It checks rigid tooth distances and identity, fixed upper and transformed lower arches, cheek/chin displacement, rendered tooth visibility at five strengths and three view directions, three openings separated by near-full closure, pause, mobile overflow, and browser errors. Screenshots go to `artifacts/mouth-prototype/`. These checks support inspection; they do not certify the visual design.

## Rendered review evidence

- [Four expressions](review/expressions.png): closed, rounded O, wide A and stretched E, rendered from the same mesh and dentition.
- [Connected tissue wireframe](review/mesh.png): continuous shared topology from upper face through cheeks, lips and chin.
- [Jaw and dental cutaway](review/cutaway.png): both jaw supports, gums, crowns and tongue at an oblique view.

The inspected revision recorded zero exposed crowns in the closed pose and zero crown pixels outside the projected lip aperture across all 28 strength/view checks. The live browser rehearsal also passed three opening and inter-note closure checks. These are bounded checks on this prototype, not a claim of anatomical or artistic approval.
