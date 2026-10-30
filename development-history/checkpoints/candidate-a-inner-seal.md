# Candidate A — focused lower-incisor coverage correction

Continues the preserved local shelf correction, not the deployed geometry. Exact input code is retained in development-history/candidate-a-shelf-local-source/. Deployed 2567f5d remains byte-exact under public/candidate-a-rig-v3/ with candidate-a-pre-shelf-rollback.json inventory and checkpoint/candidate-a-before-final-shelf tag.

Diagnosis: zero boundary/non-manifold edges; no missing patch. A probe through the slit saw Lower_L_incisor_0 at Z .430622 before the continuous skin at Z .422522. The outer tooth-neck wall crossed behind the seated incisor during shelf retraction. An independent interior overlay would not address that physical crossing.

The fix retains the outer crest/profile correction and constrains only the existing anterior tooth-neck wall against a scalar envelope rasterized from actual original lower teeth. No rendered geometry is generated. The wall follows the existing jaw frame, with C1 soft contact and C2 distance falloff outside the dental footprint. Conservative arch fairing avoids tooth-flute imprints. No tooth movement or jaw mechanism change. No black strip, floating patch or remesh.

Original grin and Manic have zero contact motion; Neutral contacts 157 vertices with max .021495 displacement, open frown 155 with max .027124. Original lip-crest, chin and recorded commissure landmarks match the preserved local shelf geometry exactly.

Validation: node tests/candidate-a-seal-browser.js
142 geometry samples without invalid/reversed triangles. Nine focused local-wall self-intersection states pass; shared-vertex adjacency excluded. Frontal former-slit rays have no unintended lower-dental hits in tested closed-jaw states/blends. Intended dental hits remain for grin/Manic/open-frown. Pixel-identical original grin. Skin index buffer unchanged.

Actual before/after diagnostic and clay views inspected front/three-quarter/profile; no exposed incisor fragments remain at the former secondary slit. Some original stylized crease structure remains; no entire-lip forward shift or chin enlargement is used. Transitions, interruption, cycle, rapid/percussion rehearsal, exact return and mobile-width controls pass. Normal 27 unit tests, cache and 26-file protected inventory pass.

Self-intersection coverage is local to the modified wall, and finite ray sampling is not an all-view/all-pose collision proof. Jaw remains 0–6 degrees. Production, protected sculpt/hair and dental transforms remain unchanged.
