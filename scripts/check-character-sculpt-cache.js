import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { sourceHash } from "./bake-character-sculpt.js";
const root = new URL(
    "../public/3d-character-viewer/generated/",
    import.meta.url,
  ),
  manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
assert.equal(
  manifest.sourceHash,
  await sourceHash(),
  "Procedural geometry changed. Run npm run sculpt:bake and commit the generated cache.",
);
for (const part of Object.values(manifest.parts))
  assert.equal(
    (await stat(new URL(part.file, root))).size,
    part.bytes,
    "Sculpt cache size mismatch",
  );
console.log("Sculpt cache matches current procedural source.");
