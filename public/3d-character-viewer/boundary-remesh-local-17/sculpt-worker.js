import { createRefinedSkinGeometry } from "./cranial-refinement.js?sculpt=9";
import { createHairGeometry } from "./sculpt-hair.js?sculpt=9";
const part = new URL(import.meta.url).searchParams.get("part");
async function cached() {
  if (typeof DecompressionStream === "undefined") return null;
  const response = await fetch(
    new URL("./generated/manifest.json?sculpt=9", import.meta.url),
    { cache: "no-cache" },
  );
  if (!response.ok)
    throw new Error("Sculpt cache manifest: " + response.status);
  const manifest = await response.json();
  if (manifest.revision !== "angry-fairing-9")
    throw new Error("Sculpt cache revision mismatch");
  const asset = await fetch(
    new URL("./generated/" + manifest.parts[part].file, import.meta.url),
  );
  if (!asset.ok) throw new Error("Sculpt cache: " + asset.status);
  const buffer = await new Response(
    asset.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  const length = new DataView(buffer).getUint32(0, true),
    header = JSON.parse(
      new TextDecoder()
        .decode(new Uint8Array(buffer, 4, length))
        .trimEnd()
        .replace(/\0+$/, ""),
    );
  if (header.sourceHash !== manifest.sourceHash || header.part !== part)
    throw new Error("Sculpt cache identity mismatch");
  const types = { Float32Array, Uint16Array, Uint32Array },
    data = { metadata: { ...header.metadata, cacheHash: manifest.sourceHash } };
  for (const [name, { type, offset, length: count }] of Object.entries(
    header.layout,
  ))
    data[name] = new types[type](buffer, 4 + length + offset, count).slice();
  return data;
}
try {
  let data;
  if (!new URL(import.meta.url).searchParams.has("generate")) {
    try {
      data = await cached();
    } catch (error) {
      console.warn(
        "Procedural cache unavailable; regenerating.",
        error.message,
      );
    }
  }
  if (!data) {
    const geometry =
      part === "hair"
        ? await createHairGeometry()
        : createRefinedSkinGeometry();
    data = { index: geometry.index.array, metadata: geometry.userData };
    for (const key of ["position", "normal", "color"])
      data[key] = geometry.attributes[key].array;
  }
  postMessage(
    data,
    ["position", "normal", "color", "index"].map((key) => data[key].buffer),
  );
} catch (error) {
  postMessage({ error: error.message });
}
