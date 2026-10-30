import * as THREE from 'three';
import {mouthLine} from '../3d-character-viewer/baseline-fed4cd1/implicit-skin.js';
// Skeletal coordinate reused from the protected jaw work. No Local-17 skin,
// bindings, dental seat offset, donor data or corrective shape is reused.
export const PIVOT=[0,-.025,-.235];
const smooth=(v,a,b)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
export function weight(x,y,z){
 const line=mouthLine(x);
 let w=smooth(line+.065-y,0,.18);
 const corner=Math.exp(-1*((Math.abs(x)-.635)/.105)**2-((y-line)/.095)**2-((z-.39)/.22)**2);
 w=w*(1-corner)+.30*corner;
 return w*(1-smooth(Math.abs(x),.73,.84))*smooth(z,-.55,-.32)*(1-smooth(y,-.20,-.14));
}
export function bindSmallJaw(character){
 const g=character.face.geometry,p=g.attributes.position.array,n=g.attributes.normal.array,rest=p.slice(),restN=n.slice(),w=new Float32Array(p.length/3),grad=new Float32Array(p.length),eps=.0001;
 for(let i=0;i<w.length;i++){const k=i*3,q=[rest[k],rest[k+1],rest[k+2]];w[i]=weight(...q);if(w[i]===0)continue;for(let j=0;j<3;j++){const a=q.slice(),b=q.slice();a[j]+=eps;b[j]-=eps;grad[k+j]=(weight(...a)-weight(...b))/(2*eps);}}
 const lower=[];character.root.traverse(o=>{if(o.isMesh&&/^(Lower_|LowerScalloped|Tongue)/.test(o.name))lower.push({mesh:o,position:o.position.clone(),quaternion:o.quaternion.clone()});});
 const quaternion=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);let degrees=0;
 function set(value){degrees=Math.max(0,Math.min(3,Number(value)||0));const theta=degrees*Math.PI/180;
  if(theta===0){p.set(rest);n.set(restN);}else for(let i=0;i<w.length;i++){
   const k=i*3;if(w[i]===0){p.set(rest.subarray(k,k+3),k);n.set(restN.subarray(k,k+3),k);continue;}
   const dy=rest[k+1]-PIVOT[1],dz=rest[k+2]-PIVOT[2],a=theta*w[i],c=Math.cos(a),s=Math.sin(a);
   p[k]=rest[k];p[k+1]=PIVOT[1]+c*dy-s*dz;p[k+2]=PIVOT[2]+s*dy+c*dz;
   // Transport original normals with the analytic deformation Jacobian.
   // No normal recomputation or smoothing of stationary facial tissue.
   const uy=-s*dy-c*dz,uz=c*dy-s*dz,gx=theta*grad[k],gy=theta*grad[k+1],gz=theta*grad[k+2];
   const xy=gx*uy,xz=gx*uz,yy=c+gy*uy,yz=s+gy*uz,zy=-s+gz*uy,zz=c+gz*uz;
   const nx=restN[k],ny=restN[k+1],nz=restN[k+2];
   const ox=nx*(yy*zz-yz*zy)+ny*(zy*xz-zz*xy)+nz*(xy*yz-xz*yy),oy=ny*zz-nz*yz,oz=-ny*zy+nz*yy,L=Math.hypot(ox,oy,oz)||1;
   n[k]=ox/L;n[k+1]=oy/L;n[k+2]=oz/L;
  }
  quaternion.setFromAxisAngle(axis,theta);
  for(const item of lower){if(theta===0){item.mesh.position.copy(item.position);item.mesh.quaternion.copy(item.quaternion);}else{item.mesh.position.copy(item.position).sub(new THREE.Vector3(...PIVOT)).applyQuaternion(quaternion).add(new THREE.Vector3(...PIVOT));item.mesh.quaternion.copy(quaternion).multiply(item.quaternion);}}
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();return degrees;
 }
 set(0);return {set,get degrees(){return degrees;},weights:w,rest,restNormals:restN};
}
