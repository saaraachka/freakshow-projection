import {addLipVolumeCorrectives,lipWeights} from "./lip-volume-correctives.js";
import { finishMouthSurface } from "./mouth-surface-finish.js";
import {
  JAW_PIVOT,
  LOWER_DENTAL_SEAT,
  jawPose,
  jawPoint,
  jawNormal,
  jawWeight,
} from "./mouth-kinematics.js";
import {
  refineSkinSurface,
  finishExpressionSurfaces,
} from "./refinement-pass.js";
import { applyOrbitalFlow } from "./continuous-orbital-field.js?repair=11";
import { rebuildExpressionMouth } from "./expression-mouth.js?expressions=10";
import * as THREE from "../../character-3d/vendor/three.module.js";
const clamp = THREE.MathUtils.clamp;
export function normalizedWeights(anger = 0, surprise = 0) {
  anger = clamp(Number(anger) || 0, 0, 1);
  surprise = clamp(Number(surprise) || 0, 0, 1);
  const sum = Math.max(1, anger + surprise);
  return {
    anger: anger / sum,
    surprise: surprise / sum,
    neutral: 1 - (anger + surprise) / sum,
  };
}
// Coherent mandibular skinning. Unlike the previous constrained Laplacian
// solve, nothing locks the chin's posterior surface against its anterior bone.
function buildJawTissueTargets(g) {
  const p = g.attributes.position,
    n = g.attributes.normal,
    positions = [],
    normals = [];
  for (const [neutral, surprise] of [
    [1, 0],
    [0, 1],
    [0.5, 0.5],
  ]) {
    const pose = jawPose(neutral, surprise),
      data = p.array.slice(),
      normal = n.array.slice();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      if (!jawWeight(x, y, z)) continue;
      data.set(jawPoint(x, y, z, pose), i * 3);
      jawNormal(x, y, z, n.getX(i), n.getY(i), n.getZ(i), pose).toArray(
        normal,
        i * 3,
      );
    }
    positions.push(new THREE.BufferAttribute(data, 3));
    normals.push(new THREE.BufferAttribute(normal, 3));
  }
  g.morphAttributes.position = positions;
  g.morphAttributes.normal = normals;
  g.morphTargetsRelative = false;
  g.userData.expressionReports = {
    jaw: "shared TMJ rotation; rigid chin and body; smooth cheek transition",
    pivot: JAW_PIVOT,
  };
}

export function buildExpressionGeometry(g) {
  refineSkinSurface(g);
  buildJawTissueTargets(g);
  rebuildExpressionMouth(g);
  finishMouthSurface(finishExpressionSurfaces(applyOrbitalFlow(g)));
  // A continuous mid-pose corrective controls commissure trajectory. It is
  // residual tissue motion on the SAME surface, not another displayed head.
  const p = g.attributes.position.array,
    n = g.attributes.normal.array,
    a = g.morphAttributes.position[0].array,
    b = g.morphAttributes.position[1].array,
    c = g.morphAttributes.position[2].array,
    na = g.morphAttributes.normal[0].array,
    nb = g.morphAttributes.normal[1].array,
    nc = g.morphAttributes.normal[2].array;
  for (let i = 0; i < p.length; i += 3) {
    const mask = 1 - THREE.MathUtils.smootherstep(p[i + 1], -0.14, 0.01);
    for (let k = 0; k < 3; k++) {
      c[i + k] = p[i + k] + mask * (c[i + k] - 0.5 * (a[i + k] + b[i + k]));
      nc[i + k] = n[i + k] + mask * (nc[i + k] - 0.5 * (na[i + k] + nb[i + k]));
    }
  }
  g.userData.midCorrective = true;
  return addLipVolumeCorrectives(g);
}
export function createExpressionSystem(character) {
  if (!character.face.geometry.morphAttributes.position?.length) {
    const oldGeometry = character.face.geometry;
    character.face.geometry = buildExpressionGeometry(oldGeometry);
    if (character.face.geometry !== oldGeometry) oldGeometry.dispose();
  }
  character.face.updateMorphTargets();
  const lowerJaw = new THREE.Group();
  lowerJaw.name = "HingedLowerDentalArch";
  const pivot = new THREE.Vector3(...JAW_PIVOT);
  lowerJaw.position.copy(pivot);
  character.root.add(lowerJaw);
  // Rigid enamel crowns keep their exact shape and identity. Gingiva and tongue
  // follow the same lower jaw; upper crowns and palate remain on the maxilla.
  const lower = [];
  character.root.traverse((o) => {
    if (o.isMesh && /^(Lower_|LowerScalloped|Lingual|Tongue)/.test(o.name))
      lower.push(o);
  });
  for (const mesh of lower) {
    lowerJaw.attach(mesh);
    // Seat the entire mandibular arch, gums and tongue together. The prior
    // fang rows already intersected at the source grin; no crowns are reshaped.
    mesh.position.add(new THREE.Vector3(...LOWER_DENTAL_SEAT));
  }
  let current = normalizedWeights(1, 0),
    target = { ...current },
    demoStart = null,
    demoKind = "full",
    demoFrom = { ...current };
  function apply(weights) {
    current = character.face.geometry.userData.perioralTopology ? normalizedWeights(0, 0) : normalizedWeights(weights.anger, weights.surprise);
    character.face.morphTargetInfluences[0] = current.neutral;
    character.face.morphTargetInfluences[1] = current.surprise;
    character.face.morphTargetInfluences[2] =
      4 * current.neutral * current.surprise;
    if (!character.face.geometry.userData.perioralTopology) lipWeights(current.neutral,current.surprise).forEach((w,i)=>character.face.morphTargetInfluences[3+i]=w);
    const pose = jawPose(current.neutral, current.surprise);
    lowerJaw.rotation.x = pose.angle;
    lowerJaw.position.set(pivot.x, pivot.y + pose.down, pivot.z - pose.back);
  }
  apply(current);
  function set(weights, { immediate = false } = {}) {
    demoStart = null;
    target = normalizedWeights(weights.anger, weights.surprise);
    if (immediate) apply(target);
  }
  const demoDuration = 24;
  function sampleDemo(seconds) {
    const t = clamp(seconds, 0, demoDuration),
      leg = Math.min(3, Math.floor(t / 6)),
      u = clamp((t - leg * 6 - 0.9) / 4.2, 0, 1),
      blend = u * u * u * (u * (u * 6 - 15) + 10);
    const poses = [
      normalizedWeights(0, 0),
      normalizedWeights(1, 0),
      normalizedWeights(0, 0),
      normalizedWeights(0, 1),
      normalizedWeights(0, 0),
    ];
    return normalizedWeights(
      THREE.MathUtils.lerp(poses[leg].anger, poses[leg + 1].anger, blend),
      THREE.MathUtils.lerp(poses[leg].surprise, poses[leg + 1].surprise, blend),
    );
  }
  function samplePrimary(seconds) {
    const t = clamp(seconds, 0, 12),
      leg = Math.min(1, Math.floor(t / 6)),
      u = clamp((t - leg * 6 - 0.9) / 4.2, 0, 1),
      v = u * u * u * (u * (u * 6 - 15) + 10);
    return normalizedWeights(0, leg ? 1 - v : v);
  }
  return {
    set,
    apply,
    sampleDemo,
    samplePrimary,
    demoDuration,
    play(now = performance.now()) {
      demoKind = "full";
      demoFrom = { ...current };
      demoStart = now;
    },
    playPrimary(now = performance.now()) {
      demoKind = "primary";
      demoFrom = { ...current };
      demoStart = now;
    },
    stop() {
      demoStart = null;
      target = { ...current };
    },
    update(dt, now) {
      if (demoStart !== null) {
        const elapsed = (now - demoStart) / 1000;
        if (elapsed < 1.2) {
          const u = clamp(elapsed / 1.2, 0, 1),
            v = u * u * u * (u * (u * 6 - 15) + 10);
          apply({
            anger: demoFrom.anger * (1 - v),
            surprise: demoFrom.surprise * (1 - v),
          });
        } else
          apply(
            demoKind === "primary"
              ? samplePrimary(elapsed - 1.2)
              : sampleDemo(elapsed - 1.2),
          );
        if (elapsed >= (demoKind === "primary" ? 12 : demoDuration) + 1.2) {
          demoStart = null;
          target = { ...current };
        }
        return true;
      }
      const error =
        Math.abs(current.anger - target.anger) +
        Math.abs(current.surprise - target.surprise);
      if (error < 0.0001) {
        if (error) apply(target);
        return false;
      }
      const alpha = 1 - Math.exp(-Math.min(dt, 0.05) / 0.28);
      apply({
        anger: THREE.MathUtils.lerp(current.anger, target.anger, alpha),
        surprise: THREE.MathUtils.lerp(
          current.surprise,
          target.surprise,
          alpha,
        ),
      });
      return true;
    },
    get state() {
      return { ...current, target: { ...target }, demo: demoStart !== null };
    },
    lowerJaw,
  };
}
