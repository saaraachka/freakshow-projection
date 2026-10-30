import * as THREE from "../../character-3d/vendor/three.module.js";
import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
const smooth = THREE.MathUtils.smootherstep;
// Transported implicit-field normals can magnify tiny source-grid errors at the
// upper vermilion after pursing. Derive local shading from the real posed mesh;
// keep the sculpt's original normals everywhere outside oral/commissure tissue.
export function finishMouthSurface(g) {
  const positions = [g.attributes.position, ...g.morphAttributes.position],
    normals = [g.attributes.normal, ...g.morphAttributes.normal];
  const mask = (x, y, z) =>
    smooth(z, 0.07, 0.28) *
    smooth(y, -0.97, -0.83) *
    (1 - smooth(y, -0.24, -0.145)) *
    (1 - smooth(Math.abs(x), 0.68, 0.8));
  for (let pose = 0; pose < positions.length; pose++) {
    const temp = new THREE.BufferGeometry();
    temp.setIndex(g.index.clone());
    temp.setAttribute("position", positions[pose].clone());
    temp.setAttribute("normal", normals[pose].clone());
    fairSurface(temp, {
      pairs: 8,
      limit: 0.006,
      reverseWeight: -0.46,
      preserveFieldNormals: false,
      normalPasses: 3,
      weight: mask,
    });
    const p = temp.attributes.position,
      n = temp.attributes.normal,
      original = normals[pose];
    for (let i = 0; i < p.count; i++) {
      const w = mask(p.getX(i), p.getY(i), p.getZ(i));
      if (!w) continue;
      const v = new THREE.Vector3()
        .fromBufferAttribute(original, i)
        .lerp(new THREE.Vector3().fromBufferAttribute(n, i), w)
        .normalize();
      v.toArray(original.array, i * 3);
    }
    positions[pose].array.set(p.array);
    temp.dispose();
  }
  g.userData.mouthFinish = {
    boundedDisplacement: 0.006,
    posedMeshNormals: true,
  };
  return g;
}
