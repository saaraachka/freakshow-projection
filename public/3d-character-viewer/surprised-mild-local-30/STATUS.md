# Surprised corrective — lip-round visual gate still fails

{
  "result": "SURPRISED_ONLY_GATE_STILL_FAILS_LIP_ROUND_CONTOUR",
  "protectedBase": "f6f7a88",
  "continuedFrom": "Local expression-channel prototype 27; preserved unchanged",
  "changes": [
    "Surprised-only brow lift uses upward translation/arching with broad smooth forehead falloff and no forward extrusion",
    "Surprised-only eyelid-margin motion follows globe curvature with stable corner falloff",
    "Reduced inward commissure/rounding strength, explicit grin/cheek relaxation before rounding",
    "Local lateral soft-tissue depth constraint uses fixed upper canine envelopes; no teeth are moved or hidden"
  ],
  "channelAssessment": {
    "browRaise": "Tall raised ridges resolved in the three final views; forehead remains recognizable.",
    "eyeOpen": "Wider margin motion; no new visible socket tearing identified in the final views.",
    "grinRelaxation": "Diagnostic B remains close to jaw-only A and does not introduce the remaining mouth defect.",
    "commissureIn": "Reduced strength keeps canines behind the lip boundary; still interacts with lipRound to produce an angular pursed contour.",
    "lipRound": "Remaining blocker: mouth remains too angular/wide rather than a convincing organic O.",
    "isolationLimit": "C combines lipRound and commissureIn. No further split-channel trials were performed after the visual failure."
  },
  "diagnostics": {
    "A": "Protected jawOpen .38 only",
    "B": "JawOpen .38 with restrained grin/cheek relaxation",
    "C": "B plus Surprised lipRound and commissureIn corrective",
    "D": "Final Surprised with corrected brows/eyelids, front/three-quarter/side"
  },
  "preservation": "Numeric snapshots confirm Neutral/Angry match local-27 exactly. Jaw-only output matches protected driver at 0/.10/.25/.40. Surprised dental matrices match bare validated jaw .38; rest position/normal/index hashes match Local-17. Protected source bytes match f6f7a88.",
  "notPerformed": [
    "Midpoint blends",
    "Interpolation/easing",
    "UI/demo integration",
    "Full suites",
    "New checkpoint/commit/push/deployment"
  ],
  "release": "Local uncommitted corrective only. Protected checkpoints, Local-17 and production remain unchanged."
}
