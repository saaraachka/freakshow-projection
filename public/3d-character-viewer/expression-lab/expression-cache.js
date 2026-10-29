import * as THREE from "../../character-3d/vendor/three.module.js";
export async function loadExpressionCache() {
  if (
    new URL(location.href).searchParams.has("rebuildExpressions") ||
    typeof DecompressionStream === "undefined"
  )
    return null;
  const response = await fetch(
    new URL(
      "./expression-generated/manifest.json?architecture=11",
      import.meta.url,
    ),
  );
  if (!response.ok)
    throw Error("Expression cache manifest failed: " + response.status);
  const manifest = await response.json();
  if (manifest.revision !== "perioral-flow-11")
    throw Error("Wrong expression cache revision");
  const file = await fetch(
    new URL("./expression-generated/" + manifest.file, import.meta.url),
  );
  if (!file.ok) throw Error("Expression cache failed: " + file.status);
  const bytes = await new Response(
      file.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer(),
    length = new DataView(bytes).getUint32(0, true),
    header = JSON.parse(
      new TextDecoder()
        .decode(new Uint8Array(bytes, 4, length))
        .replace(/\0+$/, ""),
    );
  if (
    header.sourceHash !== manifest.sourceHash ||
    header.baseSourceHash !== manifest.baseSourceHash
  )
    throw Error("Expression cache header mismatch");
  const arrays = {};
  for (const [name, v] of Object.entries(header.layout))
    arrays[name] = new globalThis[v.type](
      bytes,
      4 + length + v.offset,
      v.length,
    );
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(arrays.index, 1));
  for (const name of ["position", "normal", "color"])
    g.setAttribute(name, new THREE.BufferAttribute(arrays[name], 3));
  g.setAttribute(
    "perioralWeight",
    new THREE.BufferAttribute(arrays.perioralWeight, 1),
  );
  g.morphAttributes.position = [
    new THREE.BufferAttribute(arrays.neutralPosition, 3),
    new THREE.BufferAttribute(arrays.surprisedPosition, 3),
  ];
  g.morphAttributes.normal = [
    new THREE.BufferAttribute(arrays.neutralNormal, 3),
    new THREE.BufferAttribute(arrays.surprisedNormal, 3),
  ];
  g.morphTargetsRelative = false;
  g.userData = header.metadata;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
