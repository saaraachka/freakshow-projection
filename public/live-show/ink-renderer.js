import * as THREE from "three";
export class InkRenderer {
  constructor(character, scene, renderer, eyes) {
    this.mode = "ink";
    this.outline = 2.2;
    this.contrast = 0.8;
    this.bands = 3;
    this.intensity = 1;
    this.background = "#cec6b0";
    this.renderer = renderer;
    this.eyes = eyes;
    this.records = [];
    this.lights = [];
    scene.traverse((o) => {
      if (o.isLight) this.lights.push({ light: o, power: o.intensity });
    });
    this.gradient = new THREE.DataTexture(
      new Uint8Array(4 * 4),
      4,
      1,
      THREE.RGBAFormat,
    );
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.generateMipmaps = false;
    this.uniforms = {
      uOutline: { value: this.outline },
      uViewport: { value: new THREE.Vector2(1000, 700) },
      uInk: { value: 1 },
    };
    this.outlineMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: this.uniforms,
      vertexShader: `uniform float uOutline; uniform vec2 uViewport;
    void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normal);vec2 dir=(projectionMatrix*vec4(n,0.)).xy;dir=normalize(dir+vec2(.00001));float irregular=1.+.045*sin(dot(position,vec3(23.,37.,19.)));p.xy+=dir*uOutline*irregular*2./uViewport*p.w;gl_Position=p;}`,
      fragmentShader: "void main(){gl_FragColor=vec4(.006,.005,.004,1.);}",
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const meshes = [];
    character.root.traverse((o) => {
      if (o.isMesh && o.visible) meshes.push(o);
    });
    for (const mesh of meshes) {
      const original = mesh.material;
      if (Array.isArray(original)) continue;
      const standard = eyes.globes.has(mesh)
        ? eyes.decorate(original.clone())
        : original;
      const toon = new THREE.MeshToonMaterial({
        color: original.color || 0xffffff,
        vertexColors: original.vertexColors,
        gradientMap: this.gradient,
        side: original.side,
      });
      toon.onBeforeCompile = (shader) => {
        shader.uniforms.uInk = this.uniforms.uInk;
        shader.fragmentShader = "uniform float uInk;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        float paperValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        vec3 paperColor=mix(vec3(.018,.016,.014),vec3(.90,.84,.70),smoothstep(.005,.70,paperValue));
        diffuseColor.rgb=mix(diffuseColor.rgb,paperColor,uInk);`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `float rimInk=smoothstep(.62,.9,1.-abs(dot(normal,normalize(vViewPosition))));outgoingLight*=1.-rimInk*.7*uInk;
        #include <opaque_fragment>`,
        );
      };
      toon.customProgramCacheKey = () =>
        "freakshow-ink-1-" + (eyes.globes.has(mesh) ? "eye" : "skin");
      if (eyes.globes.has(mesh)) eyes.decorate(toon);
      const outline = new THREE.Mesh(mesh.geometry, this.outlineMaterial);
      outline.name = "InkContourShell";
      outline.userData.inkOutline = true;
      outline.frustumCulled = false;
      mesh.add(outline);
      this.records.push({ mesh, original, standard, toon, outline });
    }
    this.apply();
  }
  apply() {
    const count = Math.max(2, Math.min(5, Math.round(this.bands))),
      data = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      const value =
        i === 0
          ? 0.1 + (1 - this.contrast) * 0.35
          : 0.35 + (0.65 * i) / (count - 1);
      data.set([value * 255, value * 255, value * 255, 255], i * 4);
    }
    this.gradient.image = { data, width: count, height: 1 };
    this.gradient.needsUpdate = true;
    this.uniforms.uOutline.value = this.outline * this.intensity;
    this.uniforms.uInk.value = this.intensity;
    for (const r of this.records) {
      r.mesh.material = this.mode === "ink" ? r.toon : r.standard;
      r.outline.visible =
        this.mode === "ink" && this.outline > 0 && this.intensity > 0;
    }
    let directional = 0;
    for (const r of this.lights) {
      r.light.intensity =
        this.mode === "original"
          ? r.power
          : r.light.isHemisphereLight
            ? 0.25
            : [1.35, 0.16, 0.3][directional++ % 3];
    }
    this.renderer.setClearColor(this.background);
    this.renderer.toneMapping =
      this.mode === "ink" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }
  resize() {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    this.uniforms.uViewport.value.copy(size);
  }
  dispose() {
    this.outlineMaterial.dispose();
    this.gradient.dispose();
    for (const r of this.records) {
      r.toon.dispose();
      if (r.standard !== r.original) r.standard.dispose();
      r.mesh.remove(r.outline);
      r.mesh.material = r.original;
    }
  }
}
