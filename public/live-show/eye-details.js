import * as THREE from "three";
// Material-space irises on the existing curved globes. No discs or eye mesh edits.
export class EyeDetails {
  constructor(character) {
    this.irisSize = 1;
    this.pupilSize = 1;
    this.dilation = 0;
    this.uniforms = {
      uIris: { value: 0.071 },
      uPupil: { value: 0.026 },
      uEyeInverse: { value: new THREE.Matrix3() },
    };
    this.globes = new Set(character.eyes);
    character.root.traverse((o) => {
      if (o.name === "CurvedAcidGreenIris" || o.name === "CurvedPupil")
        o.visible = false;
    });
  }
  decorate(material) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      previous?.(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = "varying vec3 vEyeLocal;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvEyeLocal=position;",
      );
      shader.fragmentShader =
        "varying vec3 vEyeLocal; uniform float uIris; uniform float uPupil; uniform mat3 uEyeInverse;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
       vec3 epos=uEyeInverse*vEyeLocal;
       float radius=length(epos.xy-vec2(-.008,-.006));
       float aa=max(fwidth(radius),.0006);
       float iris=(1.-smoothstep(uIris-aa,uIris+aa,radius))*step(.10,epos.z);
       float edge=smoothstep(uIris*.82,uIris,radius);
       float angle=atan(epos.y+.006,epos.x+.008);
       float fibers=.018*sin(angle*29.+sin(angle*11.)*1.3+radius*190.)*clamp(1.-fwidth(angle)*29.,0.,1.);
       vec3 irisColor=mix(vec3(.14,.18,.13)+fibers,vec3(.018,.025,.018),edge);
       diffuseColor.rgb=mix(diffuseColor.rgb,irisColor,iris);
       float pupil=(1.-smoothstep(uPupil-aa,uPupil+aa,radius))*step(.1,epos.z);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.0015),pupil);
     `,
      );
    };
    material.customProgramCacheKey = () =>
      "freakshow-eye-surface-1-" + material.type;
    return material;
  }
  update(pose, pulse) {
    this.dilation = pulse;
    const iris = 0.071 * this.irisSize * (1 + 0.4 * pulse);
    this.uniforms.uIris.value = iris;
    this.uniforms.uPupil.value = Math.min(
      0.071 * this.irisSize * 0.76,
      0.026 * this.pupilSize,
    );
    const rotation = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(-(pose.gazeY || 0) * 0.16, (pose.gazeX || 0) * 0.2, 0),
    );
    this.uniforms.uEyeInverse.value.setFromMatrix4(rotation.invert());
  }
}
