# Opening-range review: 30%, 35%, 40% visually pass

{
  "result": "OPENING_RANGE_VISUAL_GATE_PASSED_THROUGH_40_PERCENT",
  "checkpoint25": "4932b4f5060e379117b8272bb18b91c4f4be2e5d",
  "testedPercentages": [
    30,
    35,
    40
  ],
  "views": [
    "front",
    "three-quarter",
    "side"
  ],
  "highestVisuallyCleanTestedPercentage": 40,
  "fortyPercentPasses": true,
  "observations": "Lip volume/curved inner aperture and progressive dental framing remain; commissures, chin and cheek continuity remain coherent. No new visible clipping, flat vestibule wall, lower-lip bulk or shelf regression identified in these views.",
  "remainingArtifacts": "Existing canonical Local-17 surface roughness/faceting remains unchanged. No new opening-related defect identified within the tested range.",
  "rest": "Exact position/normal/index hashes before and after all three samples",
  "limits": "Discrete visual samples only; above 40% untested, no precise failure threshold measured and no full collision certification.",
  "unchanged": "Approved deformation code, hidden cage map, visible base geometry, original controller source, jaw/dental and hair assets are byte-identical to the 25% checkpoint. Production unchanged.",
  "presets": "Angry and Surprised not added.",
  "release": "Development checkpoint only; no merge to main or Pages deployment."
}

Controller integration: the validated jaw channel is now wired through the existing expression API. Direct-driver and controller geometry/normals/dental matrices match exactly at 30/35/40, with exact rest restoration. No Angry/Surprised presets.
