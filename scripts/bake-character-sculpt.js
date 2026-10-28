// Reproducible cache of our own procedural geometry, not an external model.
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "../public/character-3d/vendor/three.module.js";
import { createSkinGeometry } from "../public/3d-character-viewer/implicit-skin.js";
import { createHairGeometry } from "../public/3d-character-viewer/sculpt-hair.js";
const root = new URL("../public/3d-character-viewer/", import.meta.url);
export const sources = [
  "implicit-skin.js",
  "surface-nets.js",
  "sculpt-hair.js",
  "volume-mesh.js",
  "../../scripts/bake-character-sculpt.js",
  "../../package-lock.json",
];
export async function sourceHash() {
  const hash = createHash("sha256");
  for (const name of sources) {
    hash.update(name);
    hash.update(await readFile(new URL(name, root)));
  }
  return hash.digest("hex");
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const hash = await sourceHash(),
    manifest = {
      revision: "precision-correction-4",
      sourceHash: hash,
      parts: {},
    };
  await mkdir(new URL("generated/", root), { recursive: true });
  for (const [part, generate] of [
    ["skin", createSkinGeometry],
    ["hair", createHairGeometry],
  ]) {
    const start = performance.now(),
      g = generate();
    if (part === "hair") {
      await MeshoptSimplifier.ready;
      const original = g.index.array,
        coreCount = g.userData.coreIndices,
        oldCoreVertices = g.userData.coreVertices;
      const input = new Uint32Array(original.slice(0, coreCount)),
        count = g.attributes.position.count,
        locked = new Uint8Array(count);
      const badEdges = (indices) => {
        const edges = new Map();
        for (let i = 0; i < indices.length; i += 3)
          for (let k = 0; k < 3; k++) {
            const a = indices[i + k],
              b = indices[i + ((k + 1) % 3)],
              key = a < b ? a * count + b : b * count + a;
            edges.set(key, (edges.get(key) || 0) + 1);
          }
        return [...edges]
          .filter(([, n]) => n !== 2)
          .map(([key]) => [Math.floor(key / count), key % count]);
      };
      if (badEdges(input).length)
        throw new Error("Source groom is not closed/manifold");
      // Protect coincident wedges and any contraction that would alter edge
      // incidence. A smaller buffer is never allowed to introduce open seams.
      const positionKeys = new Map(),
        p = g.attributes.position.array;
      for (let i = 0; i < oldCoreVertices; i++) {
        const key = p.slice(i * 3, i * 3 + 3).join(",");
        if (positionKeys.has(key)) {
          locked[i] = 1;
          locked[positionKeys.get(key)] = 1;
        } else positionKeys.set(key, i);
      }
      let simplified, error;
      for (let attempt = 0; attempt < 6; attempt++) {
        [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
          input,
          p,
          3,
          g.attributes.normal.array,
          3,
          [0.001, 0.001, 0.001],
          locked,
          180000 * 3,
          0.003,
          ["LockBorder", "ErrorAbsolute"],
        );
        const bad = badEdges(simplified);
        if (!bad.length) break;
        for (const edge of bad) for (const v of edge) locked[v] = 1;
        const ring = locked.slice();
        for (let i = 0; i < input.length; i += 3)
          if (ring[input[i]] || ring[input[i + 1]] || ring[input[i + 2]])
            for (let k = 0; k < 3; k++) locked[input[i + k]] = 1;
        if (attempt === 5)
          throw new Error(
            "Cannot simplify groom without altering its closed topology",
          );
      }
      const used = new Map(),
        ix = [],
        attributes = {};
      for (const name of ["position", "normal", "color"]) attributes[name] = [];
      const copy = (old) => {
        if (!used.has(old)) {
          used.set(old, used.size);
          for (const name of Object.keys(attributes))
            attributes[name].push(
              ...g.attributes[name].array.slice(old * 3, old * 3 + 3),
            );
        }
        return used.get(old);
      };
      for (const i of simplified) ix.push(copy(i));
      const coreVertices = used.size;
      for (let i = oldCoreVertices; i < g.attributes.position.count; i++)
        copy(i);
      for (let i = coreCount; i < original.length; i++)
        ix.push(used.get(original[i]));
      g.userData = {
        ...g.userData,
        sourceTriangles: original.length / 3,
        simplificationError: error,
        coreIndices: simplified.length,
        coreVertices,
      };
      for (const [name, array] of Object.entries(attributes))
        g.setAttribute(name, new THREE.Float32BufferAttribute(array, 3));
      g.setIndex(ix);
    }
    const arrays = { index: g.index.array };
    for (const name of ["position", "normal", "color"])
      arrays[name] = g.attributes[name].array;
    let offset = 0;
    const layout = {};
    for (const [name, array] of Object.entries(arrays)) {
      offset = Math.ceil(offset / 4) * 4;
      layout[name] = {
        type: array.constructor.name,
        offset,
        length: array.length,
      };
      offset += array.byteLength;
    }
    const header = Buffer.from(
      JSON.stringify({
        revision: manifest.revision,
        sourceHash: hash,
        part,
        layout,
        metadata: g.userData,
      }),
    );
    const padded = Math.ceil(header.length / 4) * 4,
      bytes = Buffer.alloc(4 + padded + offset);
    bytes.writeUInt32LE(padded, 0);
    header.copy(bytes, 4);
    for (const [name, array] of Object.entries(arrays))
      Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(
        bytes,
        4 + padded + layout[name].offset,
      );
    const file = `${part}-${hash.slice(0, 12)}.bin.gz`;
    const compressed = gzipSync(bytes, { level: 9 });
    await writeFile(new URL("generated/" + file, root), compressed);
    manifest.parts[part] = {
      file,
      triangles: g.index.count / 3,
      vertices: g.attributes.position.count,
      bytes: compressed.length,
    };
    console.log(
      part,
      manifest.parts[part],
      Math.round(performance.now() - start) + " ms",
    );
    g.dispose();
  }
  await writeFile(
    new URL("generated/manifest.json", root),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  for (const file of await readdir(new URL("generated/", root)))
    if (
      file.endsWith(".bin.gz") &&
      !Object.values(manifest.parts).some((p) => p.file === file)
    )
      await unlink(new URL("generated/" + file, root));
}
