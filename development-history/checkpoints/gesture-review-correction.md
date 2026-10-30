# Milestone A baseline recovery / conservative gesture review

## Audit before changing implementation

The failed uncommitted prototype is retained at `public/percussion-lab/` in the original development worktree and is excluded from this release. Its head import points to the correct approved `surprised-mild-local-30` runtime. All approved source files compare byte-identically with `a8af356`; six actual deployed mesh/controller/driver/map/jaw sources also match that checkpoint (public audit receipt included).

The identifiable implementation regression was the adapter's use of unvalidated combinations and a non-approved baseline, not an older mesh or changed cage bindings:

- Custom resting BASE: jaw .015, grin .10, browAnger .12, eyeOpen .10, cheeks .06 instead of exact Local-17 rest.
- Snare: jaw .23 + grin .95 + cheeks .80, whereas approved Angry has jaw .12. Each scalar was bounded, but the combination was not a validated pose.
- Kick: jaw .34 with independently selected legacy-mode grin/eye/cheek parameters rather than the approved Surprised corrective/blend path.
- The adapter lacked direct named approved presets and returned to its custom BASE after gestures.

The user-visible legacy experimental controls were inherited by the original frozen viewer. Its internal revision string still mentions local-28 even in the approved tag; byte comparisons, not that stale label, establish identity. The first percussion prototype was never deployed. The new clean route explicitly identifies the checkpoint without reusing that legacy interface.

## Correction

`public/gesture-review/` imports the approved head unchanged. Default grin calls `expressionChannels.rest()` exactly. Neutral, Angry and Surprised A call the approved presets; expression blending calls the approved API. No raw channel mixtures or custom rest settings remain.

Default-grin gesture routing uses `character.deformation.set(q)` (locked jaw only). Default peak jaw values: kick .24, snare .32, clap .088, other percussion .168. No lip, cheek or grin control is invented. Over a named expression, gestures follow only an existing approved pairwise blend to Surprised A; over Surprised A, they articulate toward Neutral and return. A user-created blend is an inspection mode; starting a rehearsal from it explicitly selects Default grin. Event overlaps use the maximum envelope, never additive deformation. Reset and preset selection clear all scheduled gestures.

The clean viewer exposes the three requested sections, deterministic scrub, slow review, matched camera angles and clay materials. It has no obsolete experiment controls, unsupported corrective sliders or audio features.

## Gates

- Exact geometry/normals/index/dental equality for rest, three named states, three midpoint blends against the frozen viewer.
- Pixel-identical screenshots: four states × front/three-quarter/profile plus three midpoint front views.
- Sixty deterministic gesture-phase renders (four categories × five phases × three views), plus nine named-underlying peak renders inspected.
- Exact return to all four underlying states after overlapping gestures.
- Six focused unit tests; UI preset/blend/reset/sequence/scrub and mobile checks.
- Controller timing measured separately from render submission and GPU completion; no performance or audio-sync claim based on the cloud software renderer.

Protected geometry, rig, jaw, teeth, hair, nose, ears and production source unchanged. Preserve rollback tags `checkpoint/expression-rig-approved` and `checkpoint/hidden-cage-mouth-40`. This is a conservative review candidate, not user approval of a new artistic milestone. Detection and additional gesture work remain stopped.
