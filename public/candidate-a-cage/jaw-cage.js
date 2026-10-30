import * as THREE from 'three';
import {mouthLine} from '../3d-character-viewer/baseline-fed4cd1/implicit-skin.js';
// Skeletal coordinate reused from the protected jaw work. No Local-17 skin,
// bindings, dental seat offset, donor data or corrective shape is reused.
export const PIVOT=[0,-.025,-.235];
const smooth=(v,a,b)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
const XS=Array.from({length:15},(_,i)=>-.84+i*.12),ZS=[-.65,-.40,-.15,.10,.40,.80];
/** Explicit Candidate-A-specific volume. Node rotations are the control data;
 * original render positions are never fitted to these node positions. */
export function buildCage(){
 const columns=XS.map(x=>{const center=mouthLine(x),half=Math.max(.045,.125*Math.sqrt(Math.max(0,1-(x/.665)**2)));return [.18,center+half+.07,center+half,center,center-half,center-half-.10,-.92,-1.15];});
 const nodes=[],edges=[],index=(i,j,k)=>(i*8+j)*ZS.length+k;
 for(let i=0;i<XS.length;i++)for(let j=0;j<8;j++)for(let k=0;k<ZS.length;k++){
  const x=XS[i],z=ZS[k],corner=Math.exp(-1*((Math.abs(x)-.635)/.10)**2);
  let influence=[0,0,0,.30,1,1,1,1][j];
  if(j===2)influence=.18*corner;
  if(j===4)influence=1-.55*corner;
  influence*= (1-smooth(Math.abs(x),.72,.84))*smooth(z,-.60,-.25);
  nodes.push({position:[x,columns[i][j],z],influence,role:['fixed-maxilla','maxillary-support','upper-lip','commissure-and-cavity','lower-lip','lower-cheek','chin','mandible'][j]});
  if(i)edges.push(index(i-1,j,k),index(i,j,k));if(j)edges.push(index(i,j-1,k),index(i,j,k));if(k)edges.push(index(i,j,k-1),index(i,j,k));
 }
 function columnValue(i,k,y){const row=columns[i];if(y>=row[0])return 0;if(y<=row[7])return nodes[index(i,7,k)].influence;let j=0;while(j<6&&y<row[j+1])j++;const t=smooth(row[j]-y,0,row[j]-row[j+1]),a=nodes[index(i,j,k)].influence,b=nodes[index(i,j+1,k)].influence;return a+(b-a)*t;}
 function influence(x,y,z){if(x<=XS[0]||x>=XS.at(-1)||z<=ZS[0]||y>=.18)return 0;const i=Math.min(XS.length-2,Math.floor((x-XS[0])/.12)),tx=smooth(x,XS[i],XS[i+1]);let k=0;while(k<ZS.length-2&&z>ZS[k+1])k++;const tz=smooth(z,ZS[k],ZS[k+1]);const a=columnValue(i,k,y)*(1-tx)+columnValue(i+1,k,y)*tx,b=columnValue(i,k+1,y)*(1-tx)+columnValue(i+1,k+1,y)*tx;return Math.max(0,Math.min(1,a+(b-a)*tz));}
 return {nodes,edges,influence,method:'C2 rotational-influence volume; original vertex rest offsets retained',cellCount:(XS.length-1)*7*(ZS.length-1)};
}
export function bindCandidateACage(character){
 const cage=buildCage(),weight=cage.influence;
 const g=character.face.geometry,p=g.attributes.position.array,n=g.attributes.normal.array,rest=p.slice(),restN=n.slice(),w=new Float32Array(p.length/3),grad=new Float32Array(p.length),eps=.0001;
 for(let i=0;i<w.length;i++){const k=i*3,q=[rest[k],rest[k+1],rest[k+2]];w[i]=weight(...q);if(w[i]===0)continue;for(let j=0;j<3;j++){const a=q.slice(),b=q.slice();a[j]+=eps;b[j]-=eps;grad[k+j]=(weight(...a)-weight(...b))/(2*eps);}}
 const lower=[];character.root.traverse(o=>{if(o.isMesh&&/^(Lower_|LowerScalloped|Tongue)/.test(o.name))lower.push({mesh:o,position:o.position.clone(),quaternion:o.quaternion.clone()});});
 const quaternion=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);let degrees=0;
 function set(value){degrees=Math.max(0,Math.min(6,Number(value)||0));const theta=degrees*Math.PI/180;
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
 set(0);return {set,get degrees(){return degrees;},weights:w,rest,restNormals:restN,cage};
}
