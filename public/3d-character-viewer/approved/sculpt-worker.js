import { createSkinGeometry } from "./implicit-skin.js?sculpt=2";
// Transfer only generated buffers; no serialized model asset is loaded.
try {
  const geometry = createSkinGeometry(),
    data = { index: geometry.index.array, metadata: geometry.userData };
  for (const key of ["position", "normal", "color"])
    data[key] = geometry.attributes[key].array;
  postMessage(
    data,
    ["position", "normal", "color", "index"].map((key) => data[key].buffer),
  );
} catch (error) {
  postMessage({ error: error.message });
}
