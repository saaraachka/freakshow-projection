import { refineHairCoverage } from "./refinement-pass.js";
import { loadExpressionCache } from "./expression-cache.js?architecture=11";
import { createExpressionSystem } from "./facial-expressions.js?expressions=10";
import * as THREE from "three";
import { eyeLandmark } from "./implicit-skin.js?sculpt=9";
import { createDentition } from "./sculpt-dentition.js?sculpt=9";
// Static sculpt only. No pose blending, jaw rig, audio coupling or animation loop.
export async function createProceduralHead() {
  const started = performance.now(),
    root = new THREE.Group();
  root.name = "VictorianClownStaticSculpt";
  const generate = (part) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL(
          "./sculpt-worker.js?sculpt=9&part=" +
            part +
            (new URL(location.href).searchParams.has("generate")
              ? "&generate=1"
              : ""),
          import.meta.url,
        ),
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
  const [geometry, hairGeometry] = await Promise.all([
    loadExpressionCache()
      .catch((error) => {
        console.warn(
          "Expression cache unavailable; rebuilding source:",
          error.message,
        );
        return null;
      })
      .then((g) => g || generate("skin")),
    generate("hair").then(refineHairCoverage),
  ]);
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
      rx = 0.205,
      ry = 0.205,
      rz = 0.205;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xd0cbb8, roughness: 0.48 }),
    );
    const ep = globe.geometry.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const xx = ep.getX(i) * rx,
        yy = ep.getY(i) * ry,
        zz = ep.getZ(i) * rz;
      const bulge =
        0.012 *
        Math.exp(-1 * (Math.hypot(xx, yy) / 0.085) ** 4) *
        THREE.MathUtils.smoothstep(zz, 0.05, 0.15);
      ep.setXYZ(i, xx, yy, zz + bulge);
    }
    globe.geometry.computeVertexNormals();
    globe.name = sign < 0 ? "LeftSeatedGlobe" : "RightSeatedGlobe";
    globe.position.set(x, y, z);
    globe.userData.nominalRadius = rx;
    globe.userData.cornealBulge = 0.012;
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
            0.012 * Math.exp(-1 * (Math.hypot(xx, yy) / 0.085) ** 4) +
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
    cap(0.071, 0x73d51c, "CurvedAcidGreenIris", 0.0015);
    cap(0.026, 0x090e10, "CurvedPupil", 0.0025);
  }
  const groom = {
    group: new THREE.Group(),
    records: hairGeometry.userData.records,
  };
  groom.group.name = "HierarchicalFullCrownGroom";
  const hairMesh = new THREE.Mesh(
    hairGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.86,
    }),
  );
  hairMesh.name = "JoinedCarvedCurlClumps";
  groom.group.add(hairMesh);
  root.add(groom.group);
  const generationMs = performance.now() - started;
  const character = {
    root,
    face,
    teeth: dental.teeth,
    eyes,
    hair: groom.group,
    get state() {
      return {
        source: "procedural-code",
        revision: "boundary-remesh-local-17-static",
        staticSculpt: false,
        cacheHash: geometry.userData.cacheHash || null,
        expressionCacheHash: face.geometry.userData.expressionCacheHash || null,
        hairCacheHash: hairGeometry.userData.cacheHash || null,
        generationMs,
        faceVertices: geometry.attributes.position.count,
        teeth: dental.teeth.length,
        dentalClasses: dental.records,
        hairClumps: hairGeometry.userData.hairClumps,
        hairLocks: hairGeometry.userData.hairLocks,
        primaryMasses: hairGeometry.userData.primaryMasses,
        flyawayRoots: hairGeometry.userData.flyawayRoots,
        groom: groom.records.map(({ guide, ...record }) => record),
        continuousLowerFace: true,
        integratedEars: true,
        detachedLipMeshes: 0,
        detachedLidMeshes: 0,
      };
    },
  };
  character.expressions = createExpressionSystem(character);
  return character;
}
