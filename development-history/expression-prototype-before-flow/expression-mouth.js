import * as THREE from '../../character-3d/vendor/three.module.js';
import { facialSolidField, oralCavityField, sampleColumn, mouthLine, skinColor } from './implicit-skin.js?sculpt=9';
const clamp=THREE.MathUtils.clamp,smooth=THREE.MathUtils.smoothstep;
function front(x,y){
 const c=sampleColumn(x,y);let lo=-.35,hi=1.05,last=hi,found=false;
 for(let z=hi;z>=lo;z-=.035){if(facialSolidField(x,y,z,c)<0){lo=z;hi=last;found=true;break;}last=z;}
 if(!found)return null;
 for(let k=0;k<16;k++){const m=(lo+hi)/2;if(facialSolidField(x,y,m,c)>0)hi=m;else lo=m;}
 return (lo+hi)/2;
}
function angryRim(theta){
 const at=r=>{const x=.665*Math.cos(theta)*r,y=mouthLine(x)+.125*Math.sin(theta)*r,z=front(x,y);return {p:new THREE.Vector3(x,y,z??.4),f:z===null?1:oralCavityField(x,y,z)};};
 let lo=.45,hi=1.38;
 for(let k=0;k<20;k++){const m=(lo+hi)/2;if(at(m).f<0)lo=m;else hi=m;}
 return at((lo+hi)/2+.001).p;
}
export function rebuildExpressionMouth(g){
 const old=g.attributes.position.array,idx=g.index.array,N=old.length/3,cut=new Uint8Array(idx.length/3),edges=new Map();
 for(let t=0;t<idx.length;t+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=old[idx[t+k]*3]/3;y+=old[idx[t+k]*3+1]/3;z+=old[idx[t+k]*3+2]/3;}if(Math.abs(x)<.78&&y>-.91&&y<-.215&&z>-.18)cut[t/3]=1;}
 for(let pass=0;pass<12;pass++){
  edges.clear();for(let t=0;t<idx.length;t+=3)if(!cut[t/3])for(let k=0;k<3;k++){const a=idx[t+k],b=idx[t+(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
  const count=new Map();for(const[a,b]of edges.values()){count.set(a,(count.get(a)||0)+1);count.set(b,(count.get(b)||0)+1);}const bad=new Set([...count].filter(([,n])=>n!==2).map(([v])=>v));if(!bad.size)break;
  if(pass===11)throw Error('Mouth boundary did not resolve');for(let t=0;t<idx.length;t+=3)if([idx[t],idx[t+1],idx[t+2]].some(i=>bad.has(i)))cut[t/3]=1;
 }
 const adjacent=new Map();for(const[a,b]of edges.values()){if(!adjacent.has(a))adjacent.set(a,[]);if(!adjacent.has(b))adjacent.set(b,[]);adjacent.get(a).push(b);adjacent.get(b).push(a);}
 const unused=new Set(adjacent.keys()),loops=[];
 while(unused.size){const start=unused.values().next().value,loop=[];let a=start,prev=-1;do{loop.push(a);unused.delete(a);const b=adjacent.get(a).find(v=>v!==prev);prev=a;a=b;if(loop.length>3000)throw Error('Invalid mouth loop');}while(a!==start);loops.push(loop);}
 if(loops.length!==2)throw Error('Expected two connected mouth boundaries, got '+loops.length);
 loops.sort((a,b)=>b.length-a.length);
 const outer=loops[0],rear=loops[1];
 const angle=(id,cy=-.51)=>Math.atan2(old[id*3+1]-cy,old[id*3]);
 const order=loop=>{let winding=0;for(let i=0;i<loop.length;i++){const a=angle(loop[i]),b=angle(loop[(i+1)%loop.length]);winding+=Math.atan2(Math.sin(b-a),Math.cos(b-a));}if(winding<0)loop.reverse();let first=0;for(let i=1;i<loop.length;i++)if(angle(loop[i])<angle(loop[first]))first=i;return [...loop.slice(first),...loop.slice(0,first)];};
 const boundary=order(outer),back=order(rear),count=192;
 const arrays=[Array.from(old),...g.morphAttributes.position.map(a=>Array.from(a.array))];
 const colors=Array.from(g.attributes.color.array),indices=[];
 for(let t=0;t<idx.length;t+=3)if(!cut[t/3])indices.push(idx[t],idx[t+1],idx[t+2]);
 const records=[],inner=[],outerRings=[];
 for(let j=0;j<count;j++){
  const theta=-Math.PI+2*Math.PI*j/count,rim=angryRim(theta);
  const neutral=new THREE.Vector3(.56*Math.cos(theta),-.435+.014*Math.sin(theta)+.018*Math.cos(theta)**2,.52);
  const surprised=new THREE.Vector3(.31*Math.cos(theta),-.535+.23*Math.sin(theta),.52);
  records.push({theta,rims:[rim,neutral,surprised]});
 }
 const add=(points,color)=>{const id=arrays[0].length/3;for(let k=0;k<3;k++)arrays[k].push(...points[k].toArray());colors.push(...color.toArray());return id;};
 const sampleBoundary=(loop,theta,pose)=>{
   let best=null,bestRadius=-Infinity;
   for(let j=0;j<loop.length;j++){
     const k=(j+1)%loop.length,a=angle(loop[j]),delta=Math.atan2(Math.sin(angle(loop[k])-a),Math.cos(angle(loop[k])-a));
     let offset=Math.atan2(Math.sin(theta-a),Math.cos(theta-a));
     if(Math.abs(delta)<1e-9||offset/delta<0||offset/delta>1)continue;
     const q=new THREE.Vector3().fromArray(arrays[pose],loop[j]*3).lerp(new THREE.Vector3().fromArray(arrays[pose],loop[k]*3),offset/delta);
     const radius=Math.hypot(q.x,q.y+.51);if(radius>bestRadius){best=q;bestRadius=radius;}
   }
   if(!best){let closest=0;for(let j=1;j<loop.length;j++)if(Math.abs(Math.atan2(Math.sin(angle(loop[j])-theta),Math.cos(angle(loop[j])-theta)))<Math.abs(Math.atan2(Math.sin(angle(loop[closest])-theta),Math.cos(angle(loop[closest])-theta))))closest=j;best=new THREE.Vector3().fromArray(arrays[pose],loop[closest]*3);}
   return best;
 };
 const rings=14;
 for(let r=0;r<=rings;r++){
  const t=.97*(1-r/rings),ring=[];
  for(let j=0;j<count;j++){
   const {theta,rims}=records[j],points=[];
   for(let pose=0;pose<3;pose++){
    const outside=sampleBoundary(boundary,theta,pose),q=rims[pose].clone().lerp(outside,t);
    if(pose===0){const z=front(q.x,q.y);q.z=z===null?q.z:z;if(t>.8)q.z=THREE.MathUtils.lerp(q.z,outside.z,smooth(t,.8,1));}
    else {
     const edge=smooth(t,0,1);q.z=THREE.MathUtils.lerp(rims[pose].z,outside.z,edge)+.035*Math.sin(Math.PI*t);
     const lip=(Math.sin(theta)>0?.025:.038)*Math.exp(-1 * ((t-.07)/.07)**2)*(1-Math.exp(-t*80));q.z+=lip;
    }
    points.push(q);
   }
   ring.push(add(points,skinColor(...points[0].toArray())));
  }
  outerRings.push(ring);
 }
 const connect=(a,b,reverse=false)=>{for(let j=0;j<count;j++){const k=(j+1)%count;const tris=[a[j],a[k],b[j],a[k],b[k],b[j]];if(reverse)for(let n=0;n<6;n+=3)[tris[n],tris[n+1]]=[tris[n+1],tris[n]];indices.push(...tris);}};
 // CCW in x/y; the annulus runs from the outer boundary inward.
 const zipper=(a,b)=>{let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&(j===b.length||(i+1)/a.length<(j+1)/b.length)){indices.push(a[i%a.length],a[(i+1)%a.length],b[j%b.length]);i++;}else{indices.push(a[i%a.length],b[(j+1)%b.length],b[j%b.length]);j++;}}};
 zipper(boundary,outerRings[0]);
 for(let r=0;r<rings;r++)connect(outerRings[r],outerRings[r+1]);
 const rim=outerRings.at(-1);inner.push(rim);
 // Parameterize the rear loop by angle; preserve the actual cavity boundary.
 const backAngles=back.map(id=>angle(id));
 const backAt=(theta,pose)=>{
  let j=0;while(j<back.length-1&&backAngles[j+1]<theta)j++;
  const next=(j+1)%back.length,a=backAngles[j],b=next?backAngles[next]:backAngles[0]+Math.PI*2;
  let th=theta;if(th<a)th+=Math.PI*2;const t=clamp((th-a)/(b-a),0,1);
  return new THREE.Vector3().fromArray(arrays[pose],back[j]*3).lerp(new THREE.Vector3().fromArray(arrays[pose],back[next]*3),t);
 };
 for(let r=1;r<=5;r++){
  const t=r/6,ring=[];
  for(let j=0;j<count;j++){
   const points=[];for(let pose=0;pose<3;pose++){
    const q=records[j].rims[pose].clone().lerp(backAt(records[j].theta,pose),t);
    // A curved vestibule retains depth behind the lip; no flat mouth card.
    q.z-=.055*Math.sin(Math.PI*t);points.push(q);
   }
   ring.push(add(points,new THREE.Color(0x3a242b)));
  }
  connect(inner.at(-1),ring);inner.push(ring);
 }
 // Join two unequal closed loops without duplicate seams or T-junctions.
 const last=inner.at(-1);let a=0,b=0;
 while(a<count||b<back.length){if(a<count&&(b===back.length||(a+1)/count<(b+1)/back.length)){indices.push(last[a%count],last[(a+1)%count],back[b%back.length]);a++;}else{indices.push(last[a%count],back[(b+1)%back.length],back[b%back.length]);b++;}}
 // Orient the stitched surface consistently before generating normals.
 const incidence=new Map();for(let t=0;t<indices.length;t+=3)for(let k=0;k<3;k++){const a=indices[t+k],b=indices[t+(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(!incidence.has(key))incidence.set(key,[]);incidence.get(key).push({face:t/3,forward:a<b});}
 const adjacency=Array.from({length:indices.length/3},()=>[]);let badEdges=0;
 for(const pair of incidence.values()){if(pair.length!==2){badEdges++;continue;}const[a,b]=pair;adjacency[a.face].push([b.face,a.forward===b.forward]);adjacency[b.face].push([a.face,a.forward===b.forward]);}
 const flip=new Int8Array(adjacency.length).fill(-1);let contradictions=0;
 for(let start=0;start<flip.length;start++){if(flip[start]>=0)continue;flip[start]=0;const stack=[start];while(stack.length){const a=stack.pop();for(const[b,opposite]of adjacency[a]){const desired=flip[a]^(opposite?1:0);if(flip[b]<0){flip[b]=desired;stack.push(b);}else if(flip[b]!==desired)contradictions++;}}}
 if(badEdges||contradictions)throw Error(`Invalid mouth stitching: ${badEdges} open/non-manifold edges, ${contradictions} orientation conflicts`);
 for(let t=0;t<indices.length;t+=3)if(flip[t/3])[indices[t],indices[t+1]]=[indices[t+1],indices[t]];
 const used=new Map(),compact=arrays.map(()=>[]),cc=[],ii=[];
 for(const oldId of indices){if(!used.has(oldId)){used.set(oldId,used.size);for(let k=0;k<3;k++)compact[k].push(...arrays[k].slice(oldId*3,oldId*3+3));cc.push(...colors.slice(oldId*3,oldId*3+3));}ii.push(used.get(oldId));}
 const result=new THREE.BufferGeometry();result.setIndex(ii);result.setAttribute('position',new THREE.Float32BufferAttribute(compact[0],3));result.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));result.computeVertexNormals();
 const filterNormals=geometry=>{
 const links=Array.from({length:geometry.attributes.position.count},()=>new Set());const ix=geometry.index.array;
 for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++){const a=ix[t+k],b=ix[t+(k+1)%3];links[a].add(b);links[b].add(a);}
 let n=geometry.attributes.normal.array;const v=new THREE.Vector3(),w=new THREE.Vector3();
 for(let pass=0;pass<5;pass++){const next=n.slice();for(let i=0;i<links.length;i++){v.fromArray(n,i*3).multiplyScalar(.55);for(const j of links[i])v.addScaledVector(w.fromArray(n,j*3),.45/links[i].size);v.normalize().toArray(next,i*3);}n=next;}geometry.setAttribute('normal',new THREE.BufferAttribute(n,3));
 };
 filterNormals(result);
 const normalBase=result.attributes.normal.clone();
 for(const[oldId,id]of used)if(oldId<N)for(let k=0;k<3;k++)normalBase.array[id*3+k]=g.attributes.normal.array[oldId*3+k];result.morphAttributes.position=[];result.morphAttributes.normal=[];
 for(let k=1;k<3;k++){const temp=result.clone();temp.morphAttributes={};temp.setAttribute('position',new THREE.Float32BufferAttribute(compact[k],3));temp.computeVertexNormals();filterNormals(temp);for(const[oldId,id]of used)if(oldId<N)for(let axis=0;axis<3;axis++)temp.attributes.normal.array[id*3+axis]=g.morphAttributes.normal[k-1].array[oldId*3+axis];result.morphAttributes.position.push(temp.attributes.position.clone());result.morphAttributes.normal.push(temp.attributes.normal.clone());temp.dispose();}
 result.setAttribute('normal',normalBase);result.userData={...g.userData,mouthTopology:{outer:count,rear:back.length,rings,technique:'stitched anatomical lip loops and enclosed vestibule'}};result.computeBoundingBox();result.computeBoundingSphere();return result;
}
