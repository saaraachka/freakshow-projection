import * as THREE from "three";
import { mouthLine, oralCavityField } from "./implicit-skin.js?sculpt=8";
const cache = new WeakMap();
export function restoreMouthMaterials(character) {
  const saved = cache.get(character);
  if (!saved) return;
  for (const [mesh, material] of saved.materials) mesh.material = material;
  character.face.geometry.setAttribute("color", saved.colors);
}
export function applyMouthDiagnostic(character) {
  let saved = cache.get(character);
  if (!saved) {
    const materials = new Map(),
      diagnostic = new Map(),
      g = character.face.geometry,
      p = g.attributes.position,
      colors = [];
    const skin = new THREE.Color(0xb5bdc4),
      lip = new THREE.Color(0xec7860),
      cavity = new THREE.Color(0x9c8dba);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        q = Math.hypot(x / 0.665, (y - mouthLine(x)) / 0.145);
      const color = skin.clone();
      if (
        y < -0.12 &&
        y > -0.9 &&
        Math.abs(x) < 0.67 &&
        z > -0.22 &&
        z < 0.48 &&
        Math.abs(oralCavityField(x, y, z)) < 0.038
      )
        color.copy(cavity);
      if (y < -0.14 && z > 0.035 && q > 0.92 && q < 1.48) color.copy(lip);
      colors.push(...color.toArray());
    }
    character.root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      materials.set(mesh, mesh.material);
      let color = 0xaab2bb;
      if (character.teeth.includes(mesh)) color = 0xffedbb;
      else if (/Gingiva|Palatal|Tongue/.test(mesh.name)) color = 0x4299cf;
      diagnostic.set(
        mesh,
        new THREE.MeshStandardMaterial({
          color: mesh === character.face ? 0xffffff : color,
          vertexColors: mesh === character.face,
          roughness: 0.82,
          side: mesh.material.side,
        }),
      );
    });
    saved = {
      materials,
      diagnostic,
      colors: g.attributes.color,
      diagnosticColors: new THREE.Float32BufferAttribute(colors, 3),
    };
    cache.set(character, saved);
  }
  for (const [mesh, material] of saved.diagnostic) mesh.material = material;
  character.face.geometry.setAttribute("color", saved.diagnosticColors);
}
