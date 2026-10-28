import * as THREE from "three";
import { eyeLandmark } from "./implicit-skin.js?sculpt=3";
import { createSculptHair } from "./sculpt-hair.js?sculpt=3";
import { createDentition } from "./sculpt-dentition.js?sculpt=3";
// Static sculpt only. No pose blending, jaw rig, audio coupling or animation loop.
export async function createProceduralHead() {
  const started = performance.now(),
    root = new THREE.Group();
  root.name = "VictorianClownStaticSculpt";
  const geometry = await new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./sculpt-worker.js?sculpt=3", import.meta.url),
      { type: "module" },
    );
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Sculpt generation failed"));
    };
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      const g = new THREE.BufferGeometry();
      for (const key of ["position", "normal", "color"])
        g.setAttribute(key, new THREE.BufferAttribute(data[key], 3));
      g.setIndex(new THREE.BufferAttribute(data.index, 1));
      g.userData = data.metadata;
      g.computeBoundingBox();
      g.computeBoundingSphere();
      resolve(g);
    };
  });
  const face = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.83 }),
  );
  face.name = "ContinuousCraniofacialAuricularSurface";
  root.add(face);
  const dental = createDentition();
  root.add(dental.group);
  const eyes = [];
  for (const sign of [-1, 1]) {
    const { x, y, z } = eyeLandmark(sign),
      rx = 0.19,
      ry = 0.19,
      rz = 0.19;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xd0cbb8, roughness: 0.48 }),
    );
    globe.name = sign < 0 ? "LeftSeatedGlobe" : "RightSeatedGlobe";
    globe.position.set(x, y, z);
    globe.scale.set(rx, ry, rz);
    root.add(globe);
    eyes.push(globe);
    const cap = (radius, color, name, lift) => {
      const vertices = [],
        ix = [],
        nr = 9,
        ns = 48;
      for (let r = 0; r <= nr; r++)
        for (let i = 0; i <= ns; i++) {
          const a = (i / ns) * Math.PI * 2,
            xx = -0.008 + (Math.cos(a) * radius * r) / nr,
            yy = -0.006 + (Math.sin(a) * radius * r) / nr;
          const zz =
            rz * Math.sqrt(Math.max(0, 1 - (xx / rx) ** 2 - (yy / ry) ** 2)) +
            lift;
          vertices.push(x + xx, y + yy, z + zz);
          if (r < nr && i < ns) {
            const k = r * (ns + 1) + i;
            ix.push(k, k + 1, k + ns + 1, k + 1, k + ns + 2, k + ns + 1);
          }
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      g.setIndex(ix.map((_, i) => ix[i - (i % 3) + 2 - (i % 3)]));
      g.computeVertexNormals();
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.57 }),
      );
      m.name = name;
      root.add(m);
    };
    cap(0.066, 0x78c72b, "CurvedAcidGreenIris", 0.0015);
    cap(0.026, 0x090e10, "CurvedPupil", 0.0025);
  }
  const groom = createSculptHair();
  root.add(groom.group);
  const generationMs = performance.now() - started;
  return {
    root,
    face,
    teeth: dental.teeth,
    eyes,
    hair: groom.group,
    get state() {
      return {
        source: "procedural-code",
        revision: "anatomical-refinement-3",
        staticSculpt: true,
        generationMs,
        faceVertices: geometry.attributes.position.count,
        teeth: dental.teeth.length,
        dentalClasses: dental.records,
        hairClumps: groom.records.filter((r) => r.kind === "primary").length,
        hairLocks: groom.records.length,
        groom: groom.records.map(({ guide, ...record }) => record),
        continuousLowerFace: true,
        integratedEars: true,
        detachedLipMeshes: 0,
        detachedLidMeshes: 0,
      };
    },
  };
}
