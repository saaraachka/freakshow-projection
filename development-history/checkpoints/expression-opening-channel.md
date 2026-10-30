# Validated jaw-channel integration

Approved 25% checkpoint: `4932b4f`, tag `checkpoint/hidden-cage-mouth-25`.
Opening range checkpoint: `f6f7a88`, tag `checkpoint/hidden-cage-mouth-40`.

In the separate development review viewer, the existing expression API now forwards `setExpression({jaw: 0.35}, {immediate: true})` to the approved hidden-cage opening driver. `character.expressions.setJawOpening(value)` is also available. The channel is limited to 0–0.40. Existing expression-controller source, jaw mechanics, dental transforms, face topology and cage data are unchanged.

`node scripts/check-opening-channel.js` verifies that controller and direct driver produce identical position/normal/index buffers, morph influences and dental matrices at 30%, 35%, 40%, then checks exact rest restoration. This is a focused wiring check, not a full browser/animation suite.

No Angry or Surprised presets, expression blending, production merge or deployment are included. Existing canonical sculpt roughness remains. Above 40% is untested.
