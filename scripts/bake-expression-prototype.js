// Cache our own procedural shared-topology morph targets for fast review.
// This does not approve, commit, publish or change the production sculpt.
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import * as THREE from "../public/character-3d/vendor/three.module.js";
import { buildExpressionGeometry } from "../public/3d-character-viewer/expression-lab/facial-expressions.js";
const root = new URL(
  "../public/3d-character-viewer/expression-lab/",
  import.meta.url,
);
const sources = [
  "facial-expressions.js",
  "continuous-perioral-field.js",
  "continuous-orbital-field.js",
  "expression-mouth.js",
  "sculpt-fairing.js",
  "implicit-skin.js",
  "cranial-refinement.js",
  "generated/manifest.json",
  "../../../scripts/bake-expression-prototype.js",
];
export async function expressionHash() {
  const h = createHash("sha256");
  for (const name of sources) {
    h.update(name);
    h.update(await readFile(new URL(name, root)));
  }
  return h.digest("hex");
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const hash = await expressionHash(),
    out = new URL("expression-generated/", root);
  if (process.argv.includes("--check")) {
    const m = JSON.parse(await readFile(new URL("manifest.json", out)));
    if (m.sourceHash !== hash)
      throw Error(
        "Expression source/cache mismatch: run node scripts/bake-expression-prototype.js",
      );
    if ((await stat(new URL(m.file, out))).size !== m.bytes)
      throw Error("Expression cache size mismatch");
    console.log("Expression cache matches current local prototype source.");
  } else {
    const base = JSON.parse(
        await readFile(new URL("generated/manifest.json", root)),
      ),
      bin = gunzipSync(
        await readFile(new URL("generated/" + base.parts.skin.file, root)),
      ),
      length = bin.readUInt32LE(0),
      header = JSON.parse(
        bin
          .subarray(4, 4 + length)
          .toString()
          .replace(/\0+$/, ""),
      ),
      start = 4 + length,
      g = new THREE.BufferGeometry();
    for (const [name, layout] of Object.entries(header.layout)) {
      const bytes = bin.subarray(
          start + layout.offset,
          start + layout.offset + layout.length * 4,
        ),
        array = new globalThis[layout.type](
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        );
      if (name === "index") g.setIndex(new THREE.BufferAttribute(array, 1));
      else g.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }
    g.userData = { ...header.metadata, cacheHash: base.sourceHash };
    console.time("expression geometry");
    const result = buildExpressionGeometry(g);
    console.timeEnd("expression geometry");
    const arrays = {
      index: result.index.array,
      position: result.attributes.position.array,
      normal: result.attributes.normal.array,
      color: result.attributes.color.array,
      perioralWeight: result.attributes.perioralWeight.array,
      neutralPosition: result.morphAttributes.position[0].array,
      neutralNormal: result.morphAttributes.normal[0].array,
      surprisedPosition: result.morphAttributes.position[1].array,
      surprisedNormal: result.morphAttributes.normal[1].array,
    };
    const layout = {};
    let offset = 0;
    for (const [name, array] of Object.entries(arrays)) {
      layout[name] = {
        offset,
        length: array.length,
        type: array.constructor.name,
      };
      offset += array.byteLength;
    }
    const metadata = { ...result.userData, expressionCacheHash: hash },
      text = Buffer.from(
        JSON.stringify({
          sourceHash: hash,
          baseSourceHash: base.sourceHash,
          layout,
          metadata,
        }),
      ),
      padded = Math.ceil(text.length / 4) * 4,
      raw = Buffer.alloc(4 + padded + offset);
    raw.writeUInt32LE(padded);
    text.copy(raw, 4);
    for (const [name, array] of Object.entries(arrays))
      Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(
        raw,
        4 + padded + layout[name].offset,
      );
    const compressed = gzipSync(raw, { level: 9 }),
      file = "face-" + hash.slice(0, 12) + ".bin.gz";
    await mkdir(out, { recursive: true });
    await writeFile(new URL(file, out), compressed);
    await writeFile(
      new URL("manifest.json", out),
      JSON.stringify(
        {
          revision: "perioral-flow-11",
          sourceHash: hash,
          baseSourceHash: base.sourceHash,
          file,
          bytes: compressed.length,
          vertices: result.attributes.position.count,
          triangles: result.index.count / 3,
        },
        null,
        2,
      ) + "\n",
    );
    for (const old of await readdir(out))
      if (old.endsWith(".bin.gz") && old !== file)
        await unlink(new URL(old, out));
    console.log({
      file,
      bytes: compressed.length,
      vertices: result.attributes.position.count,
    });
  }
}
