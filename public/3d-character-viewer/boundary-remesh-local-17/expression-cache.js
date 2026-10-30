import * as THREE from "../../character-3d/vendor/three.module.js";
export async function loadExpressionCache(){
 const response=await fetch(new URL("./boundary-neutral.json.gz",import.meta.url));
 if(!response.ok)throw Error("Static boundary remesh unavailable: "+response.status);
 const data=await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json();
 const g=new THREE.BufferGeometry();
 g.setIndex(new THREE.Uint32BufferAttribute(data.index,1));
 for(const name of ["position","normal","color"])g.setAttribute(name,new THREE.Float32BufferAttribute(data[name],3));
 // Static gate only. Keep controller-compatible slots without implementing
 // any mouth deformation or reusing rejected volume correctives.
 g.morphAttributes.position=Array.from({length:3},()=>g.attributes.position.clone());
 g.morphAttributes.normal=Array.from({length:3},()=>g.attributes.normal.clone());
 g.morphTargetsRelative=false;
 g.userData={perioralTopology:data.metadata,expressionCacheHash:"boundary-neutral-local-17"};
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}
