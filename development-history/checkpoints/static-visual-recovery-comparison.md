# Static visual recovery comparison (no replacement)

The intended artistic reference is the earlier broad toothy grin, not the technically preserved Local-17 rest. The new `public/sculpt-comparison/` route is static comparison only. It proposes the preserved `fed4cd1` surface-cleanup/angry-brow sculpt in column A, with `3b89be9` available as an alternate historical reference. Columns B/C display the expression-rig rest and f17f295's default reset, respectively. No expression animation, gesture, detector, new geometry or fitting is implemented.

## Finding

The visual drift predates the percussion adapter:

1. The original fed4cd1 sculpt defines lip half-span .665, center half-height .125, and strongly lifted mouth corners. Its original generated skin/hair cache assets are byte-identical in the preserved archive. Some JS imports were relocated by one directory; the source geometry functions are unchanged.
2. The Local-17 boundary remesh used a prior `neutralPosition`/`neutralNormal` cache as input, excised a broad perioral area, and replaced lip/skin/vestibule flow. The surviving inner rim is .66 units wide and about .01124 units in vertical extent. This is not an original-wide-grin morph at rest. The sidecar records `FAILED_STATIC_NEUTRAL_VISUAL_GATE`; embedded metadata says `STATIC_NEUTRAL_UNREVIEWED`. Copied README text in that archive describes an older architecture and is not a reliable description of its actual loader.
3. The a8af356 loader directly reads this `boundary-neutral.json.gz`. Its asset is byte-identical to Local-17 preserved in 4932b4f. `createHiddenCageDriver` captures this narrowed skin and restores it at zero. Local-17's upstream neutral skin also relaxes the original brow/cheek expression. A later grin channel adds only small offsets to that altered rest; it does not retrieve the original static grin.
4. f17f295's exact reset faithfully reproduces this altered rest. B and C therefore intentionally match. Previous pixel equality proved preservation of the wrong artistic baseline, not recovery of the original design.
5. Expression work also introduced mandibular grouping and a lower dental seat offset [0,-.012,-.024]. The comparison shows each native historical dental presentation intact. Hair coverage support was added in the later rig; A retains its native earlier hair. No component is remodeled or swapped here.

Detailed source and asset provenance: `public/sculpt-comparison/provenance.json`.

## Review, not promotion

All three have identical camera position/target, field of view, lighting, exposure and neutral clay. Front, three-quarter and profile inspected. Orbit and zoom any column to move all together. Each historical model remains intact, preserving its own face/brow/nose/ears/skull/hair/teeth. Static differences are exposed rather than normalized or hidden.

Selecting a target records only a browser-local review nomination and offers a JSON export. It does not overwrite a checkpoint, change either existing viewer's default, or change production. A is proposed as the recovered visual reference; user review chooses the exact face to lock next. The comparison may be deployed without promoting any baseline.

`tests/sculpt-comparison-browser.js` checks source identity, linked cameras, selection/export, alternate reference and phone scrolling. These are functional checks only. The actual front/three-quarter/profile renders are the art-direction evidence.
