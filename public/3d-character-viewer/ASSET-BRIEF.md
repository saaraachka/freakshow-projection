# Required sculpted clown asset — not yet supplied

The viewer is infrastructure only. No convincing organic clown model has been created or approved. The earlier procedural blockout does not satisfy this brief and is not loaded here. Blender is available in the workspace; running it or exporting primitive geometry would not establish the required artistic quality.

Create and review a sculpted and retopologized head in Blender or an equivalent DCC application. Export an embedded, uncompressed GLB in glTF coordinates (Y up, face toward +Z), with sensible real-world scale and object names. No illustrated character texture, sprite, or flat face card is allowed.

Required geometry: skull, forehead, orbital sockets, cheekbones, cheeks, nasolabial transitions, ears with inner structure, chin, attached mandible, protruding clown nose, full upper/lower lip loops, deep oral cavity, individual teeth on rigid arches, gum collars, tongue, eyeballs, separate green irises/black pupils, and volumetric hair. Verify back and underside continuity. Avoid intersecting lips, exposed gum backs, and teeth emerging through closed lips.

Create facial morph targets with a stable shared vertex topology: evilGrin (default), smirk, snarl, laughter, disgust, shock, scream, whisper, Closed, O, A, E. Author jawOpen as a morph or a jaw/mandible/lowerjaw bone whose local X rotation opens the jaw. Use jaw skin weights and rigid dental attachment; crown geometry must never stretch with lips. The viewer discovers the asset's real targets rather than inventing missing controls. It cannot guarantee anatomy, weights, expression quality or default grin when the asset lacks them.

Before expression animation, publish actual front, side, back and underside renders. Then review mouth-open/closed depth and expressions. Emotions and speech must eventually have independent weights. Do not integrate into production until the model is approved.

The current viewer accepts a local binary GLB with embedded resources; it does not upload files or persist them. All loaded image textures are discarded in favor of studio-lit clay materials. It supports full orbit, pinch/scroll zoom, camera reset, view presets, discovered morph targets and a compatible jaw control. The empty state intentionally contains zero character geometry.

A reviewed asset can later be published at this isolated route. Character screenshots cannot be supplied until that model exists; viewer tests with a synthetic test fixture are not character proof. Physical iPhone Safari testing remains required; emulated mobile WebKit is a compatibility check only.
