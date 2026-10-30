# Approved hidden-cage checkpoint

The 25% opening was approved before larger-range work. The tagged commit is a self-contained development viewer checkpoint, separate from production.

Run `npm install` and `npm run dev`, then open `/public/3d-character-viewer/hidden-cage-local-25/index.html`. The exact canonical reference is `/public/3d-character-viewer/boundary-remesh-local-17/index.html`. Matched evidence is in `/public/3d-character-viewer/review/inner-mouth-arc-local.html`.

`node scripts/review-inner-mouth-arc.js` captures the six approved 17.5% / 25% views and checks exact rest buffers. It does not run a full browser suite. Baked numeric cage data is included; rebuilding historical fitting trials is not required.

CC0 original donor data and license evidence are preserved in `development-history/donor-makehuman`. Local-17 is rendered; the donor remains numeric driver data. Earlier rejected/uncommitted experiments are intentionally outside this checkpoint.
