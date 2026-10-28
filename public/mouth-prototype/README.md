# Mouth and lower-face anatomy study · acting and illustrated dentition

Independent character-development page. Production now imports the approved anatomy in this directory through `src/approved-character.js`; this page does not import production audio, Song Lab or its controller. The approved c9a99b6 geometry and crown color data are guarded by a production fingerprint test. Open `public/mouth-prototype/index.html` through the development server or GitHub Pages. The existing build copies this directory. The page registers no worker and loads no external libraries; the existing prototype-only offline-worker exception remains unchanged.

## Preserved foundation

The connected face mesh, shared topology, mandibular hinge, rigid jaw attachment and smooth time-stepped transitions are retained. Upper face, cheeks, lips and chin share indexed vertices. The lip boundary carries its displacement through intermediate tissue rings to the facial silhouette. The lower jaw rotates about the same transverse hinge at y=320, z=-180, carrying lower gums, lower crowns and tongue.

WebGL depth testing resolves tissue, individual crowns, gums, cheek lining and tongue per pixel. Crown roots sit behind their gum margins; closed lips occlude all crowns. There is no halfway clipping divider, image stretching or per-pose tooth replacement. The normal view includes a dark mucosal covering over the jaw; the cutaway exposes the same underlying jaw body and side supports.

## Speech plus character acting

Closed, rounded O, wide A and stretched E remain independent speech shapes. Emotional acting is a separate selector and intensity control. Acting deltas add to the selected speech shape with bounded jaw travel and lip width, rather than replacing it. The Mouth opening control closes articulation while retaining the expression's corner attitude and cheek tension.

| Expression      | Authored acting                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Sinister grin   | Broad smile, asymmetric corners, exposed upper canines, lifted cheeks                                   |
| Angry snarl     | Local upper-lip retraction over one canine, tense corners, lower-lip retraction and a small jaw opening |
| Manic laughter  | Wide smiling aperture, high cheek lift and pulsed articulation in the demo                              |
| Evil smirk      | One corner curls higher, narrow opening, restrained jaw and asymmetric cheek lift                       |
| Unhinged scream | Narrow elongated aperture, strong upper-lip lift, drawn cheeks and chin tension                         |
| Creepy whisper  | Pursed narrow lips, near-closed dentition and controlled small movements in the demo                    |

**Demonstrate six emotional expressions** visits all six over 10.8 seconds and repeats. Pause holds the current state. The original **three quick openings** rehearsal still articulates O/A/E with closures between notes and can retain a selected emotion. Start with Closed and neutral speech strength to inspect acting alone; select a speech shape plus an emotion to inspect their blend.

## Illustrated rigid crowns

The same twenty tooth IDs and upper/lower assignments are preserved. Tooth vertices are authored once and never change with lip movement. Upper crowns remain fixed; lower crowns receive only the original rigid jaw transform.

- Incisors have broad, flattened labial surfaces, narrower cervical necks, beveled cutting surfaces and subtly irregular edges.
- Upper canines have curved, asymmetric pointed crowns. Lower canines are smaller and less acute.
- Premolars have smaller cusped crowns and recede in width and depth along the arch. The lower front teeth are smaller and set behind the upper incisors.
- Small deterministic variations in crown length, spacing, tilt and arch rotation remain fixed for each tooth.
- Gingival margins follow the individual crown centers and widths, with interdental papillae and dark cervical contours.
- Warm ivory, cervical staining, subtle enamel glints, inked margins and crossed shadow strokes are bound to crown-local coordinates. They do not slide across the teeth as the jaw rotates.

The dental close-up toggle and angle slider expose crown form and depth. Tooth labels retain the original identifiers.

## Rendered review evidence

- [Six magnified expressions](review/acting-closeups.png) and [full-face acting sheet](review/acting-expressions.png)
- [Every emotion at closed, half and full opening](review/acting-openings.png)
- [Front dental close-up](review/teeth-front.png) and [oblique dental cutaway](review/teeth-oblique.png)
- Individual views: [grin](review/grin.png), [snarl](review/snarl.png), [laughter](review/laughter.png), [smirk](review/smirk.png), [scream](review/scream.png), [whisper](review/whisper.png)
- [Original speech shapes with the revised teeth](review/expressions.png), [connected mesh](review/mesh.png), and [jaw cutaway](review/cutaway.png)

The revision was visually inspected in all eighteen emotion/opening captures and both dental close-ups. The acting check recorded zero crown pixels outside the projected lip aperture in 58 views, including intermediate openings, oblique views and speech/acting blends. Per-tooth cervical coverage checks also passed in those views. Rest-bite alignment and nonintersecting neighboring crown bounds are checked independently of lip occlusion. All closed emotional mouths hid every crown. The original 28-view speech check also recorded zero external crown pixels. Both three-note rehearsals, rigid crown identity/attachment and the six-emotion UI demo passed.

## Verification

```sh
npm run build
node tests/mouth-acting-browser.js
node tests/mouth-prototype-browser.js
```

The browser checks use the existing Playwright installation and `/usr/bin/chromium` (override with `CHROMIUM_PATH`). They validate shared topology, rigid crown distances and vertices, fixed upper and transformed lower arches, cheek/chin displacement, pixel-level dental visibility, independent speech/acting controls, the demonstration, inter-note closures, pause, mobile overflow and browser errors. Screenshots go to `artifacts/mouth-acting/` and `artifacts/mouth-prototype/`.

The c9a99b6 anatomy was approved and is now shared with production. This page remains available for further anatomical/acting development; new anatomy changes need explicit review before updating the production fingerprint. Tissue deformation is authored rather than physically simulated, the hinge omits condylar translation, and the vintage material treatment is procedural. Passing automated checks does not certify artistic or anatomical approval.
