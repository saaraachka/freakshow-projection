import { rebuildExpressionMouth } from "./expression-mouth.js?expressions=10";
import { fairSurface } from "./sculpt-fairing.js?sculpt=9";
import * as THREE from 'three';
import { eyeLandmark, mouthLine, facialSolidField, sampleColumn } from './implicit-skin.js?sculpt=9';
import { cranialPoint } from './cranial-refinement.js?sculpt=9';
const smooth=THREE.MathUtils.smoothstep, clamp=THREE.MathUtils.clamp;
const gaussian=v=>Math.exp(-v*v);
export function normalizedWeights(anger=0,surprise=0) {
  anger=clamp(Number(anger)||0,0,1);surprise=clamp(Number(surprise)||0,0,1);
  const sum=Math.max(1,anger+surprise);
  return {anger:anger/sum,surprise:surprise/sum,neutral:1-(anger+surprise)/sum};
}
// Detail-preserving harmonic cage. Material-space lip/lid/brow constraints
// drive displacement on the ORIGINAL connected skin graph. Skull, nose, ears,
// cheekbones and jaw supply anatomical anchors; no whole-face scale warp.
function buildTargets(g) {
  const p=g.attributes.position,n=g.attributes.normal,ix=g.index.array,N=p.count;
  const links=Array.from({length:N},()=>new Set());
  for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++){const a=ix[t+k],b=ix[t+(k+1)%3];links[a].add(b);links[b].add(a);}
  const offsets=new Uint32Array(N+1);let total=0;
  for(let i=0;i<N;i++){offsets[i]=total;total+=links[i].size;}offsets[N]=total;
  const neighbors=new Uint32Array(total);for(let i=0;i<N;i++)neighbors.set([...links[i]],offsets[i]);
  function hinge(x,y,z,angle,back=0){const dy=y+0.12,dz=z+0.42;return new THREE.Vector3(x,-0.12+dy*Math.cos(angle)-dz*Math.sin(angle),-0.42+dy*Math.sin(angle)+dz*Math.cos(angle)-back);}
  const sourceGeom=fairSurface(g.clone(),{pairs:0,limit:0});const sourceNormals=sourceGeom.attributes.normal.array;
  const positions=[],normals=[],reports=[];
  for(const pose of ['neutral','surprised']) {
    const surprise=pose==='surprised',strength=new Float64Array(N),rhs=Array.from({length:3},()=>new Float64Array(N));
    for(let i=0;i<N;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.abs(x),targets=[];
      const add=(w,q)=>{if(w>0.0001)targets.push([w,q]);};
      // Fixed bone envelope, crown, temporal attachment and actual nose.
      const locked=y>0.94 || a>0.80 || z<-0.12 || (Math.abs(x)<0.23 && y>-.18 && y<.18 && z>.4);
      if(locked)add(35,new THREE.Vector3(x,y,z));
      const cheekBone=gaussian((a-.67)/.13)*gaussian((y+.02)/.16)*smooth(z,.08,.25);
      add(4*cheekBone,new THREE.Vector3(x,y,z));
      const jawWeight=1-smooth(y,-.91,-.74);
      add(12*jawWeight,hinge(x,y,z,surprise?.20:-.14,surprise?0:.045));
      // Fleshy rim, not teeth: move existing lip tissue into a rounded opening.
      const line=mouthLine(x),rel=y-line,q=Math.hypot(x/.665,rel/.125);
      const lip=smooth(z,.10,.28)*(1-smooth(a,.64,.71))*(1-smooth(Math.abs(q-1.1),.18,.46))*(1-smooth(y,-.19,-.13));
      const tx=x*(surprise?.49:.87),ty=(surprise?-.535:-.435+.025*(x/.665)**2)+rel*(surprise?1.85:.105);
      const lipDepth=surprise?.51:.48;
      const tz=(z+lipDepth+Math.sqrt((z-lipDepth)**2+.0001))/2;
      // Mouth is handled by continuous anatomical loops below.
      // A broad maxillary soft-tissue anchor prevents the upper lip pulling
      // the nose down while preserving a deformable philtrum.
      const muzzle=gaussian((y+.19)/.055)*gaussian(x/.45)*smooth(z,.25,.4);
      add(3*muzzle,new THREE.Vector3(x,y,z));
      const sign=x<0?-1:1,e=eyeLandmark(sign),dx=x-e.x,ey=y-e.y-e.tilt*dx;
      const eq=Math.hypot(dx/e.width,ey/e.height);
      const lid=(1-smooth(Math.abs(eq-1.1),.08,.36))*smooth(z,.26,.36);
      add(35*lid,new THREE.Vector3(x,y+ey*(surprise?.68:.08),z));
      const browY=cranialPoint(x,.445+.52*(a-.35),z).y;
      const brow=smooth(z,.25,.4)*smooth(a,.10,.19)*(1-smooth(a,.59,.72))*gaussian((y-browY)/.052);
      const by=surprise?.53+.05*gaussian((a-.37)/.24):.47+.05*(a-.35);
      add(25*brow,new THREE.Vector3(x,y+by-browY,z));
      let w=.0001;const v=[0,0,0];
      for(const [weight,target]of targets){w+=weight*5;v[0]+=weight*5*(target.x-x);v[1]+=weight*5*(target.y-y);v[2]+=weight*5*(target.z-z);}
      strength[i]=w;for(let k=0;k<3;k++)rhs[k][i]=v[k];
    }
    // Jacobi-preconditioned conjugate gradients solve the sparse Laplacian.
    // The same operator handles all three displacement coordinates.
    const degree=Float64Array.from({length:N},(_,i)=>offsets[i+1]-offsets[i]);
    const diagonal=Float64Array.from({length:N},(_,i)=>degree[i]*degree[i]+degree[i]+strength[i]);
    const work=new Float64Array(N);
    const laplace=(v,out)=>{for(let i=0;i<N;i++){let a=degree[i]*v[i];for(let k=offsets[i];k<offsets[i+1];k++)a-=v[neighbors[k]];out[i]=a;}};
    const multiply=(v,out)=>{laplace(v,work);laplace(work,out);for(let i=0;i<N;i++)out[i]+=strength[i]*v[i];};
    const dot=(a,b)=>{let sum=0;for(let i=0;i<N;i++)sum+=a[i]*b[i];return sum;};
    const displacement=[];let iterations=0;
    for(let axis=0;axis<3;axis++){
      const out=new Float64Array(N),r=rhs[axis].slice(),z=Float64Array.from(r,(v,i)=>v/diagonal[i]),d=z.slice(),ad=new Float64Array(N);
      let rz=dot(r,z),initial=Math.sqrt(dot(r,r));
      for(let step=0;step<850 && initial>1e-12;step++){
        multiply(d,ad);const alpha=rz/dot(d,ad);
        for(let i=0;i<N;i++){out[i]+=alpha*d[i];r[i]-=alpha*ad[i];}
        iterations=Math.max(iterations,step+1);
        if(Math.sqrt(dot(r,r))/initial<1e-6)break;
        for(let i=0;i<N;i++)z[i]=r[i]/diagonal[i];const next=dot(r,z),beta=next/rz;
        for(let i=0;i<N;i++)d[i]=z[i]+beta*d[i];rz=next;
      }
      displacement.push(out);
    }
    const data=p.array.slice();for(let i=0;i<N;i++)for(let k=0;k<3;k++)data[i*3+k]+=displacement[k][i];
    const temp=g.clone();temp.morphAttributes={};temp.setAttribute('position',new THREE.BufferAttribute(data,3));
    fairSurface(temp,{pairs:8,limit:0.009,normalPasses:4,weight:(x,y,z)=>smooth(z,.05,.25)*(1-smooth(Math.abs(x),.73,.83))*(1-smooth(y,.85,.99))});
    // Retain the approved analytic shading detail while transporting the
    // change in the actual mesh normals caused by the cage deformation.
    const transported=new Float32Array(n.array.length),v=new THREE.Vector3(),sourceNormal=new THREE.Vector3(),targetNormal=new THREE.Vector3(),rotation=new THREE.Quaternion();
    for(let i=0;i<N;i++){
      sourceNormal.fromArray(sourceNormals,i*3);targetNormal.fromBufferAttribute(temp.attributes.normal,i);
      rotation.setFromUnitVectors(sourceNormal,targetNormal);
      v.fromBufferAttribute(n,i).applyQuaternion(rotation).normalize().toArray(transported,i*3);
    }
    // Filter only the moved tissue's normals; fixed cranial anatomy stays exact.
    let smoothNormals=transported;
    for(let pass=0;pass<4;pass++){
      const next=smoothNormals.slice();
      for(let i=0;i<N;i++){
        const motion=Math.hypot(displacement[0][i],displacement[1][i],displacement[2][i]);
        const mix=.4*smooth(motion,.002,.02);if(!mix)continue;
        v.fromArray(smoothNormals,i*3).multiplyScalar(1-mix);targetNormal.set(0,0,0);
        for(let k=offsets[i];k<offsets[i+1];k++)targetNormal.add(sourceNormal.fromArray(smoothNormals,neighbors[k]*3));
        v.addScaledVector(targetNormal,mix/(offsets[i+1]-offsets[i])).normalize().toArray(next,i*3);
      }
      smoothNormals=next;
    }
    positions.push(temp.attributes.position.clone());normals.push(new THREE.BufferAttribute(smoothNormals,3));reports.push({pose,iterations,vertices:N});temp.dispose();
  }
  sourceGeom.dispose();g.morphAttributes.position=positions;g.morphAttributes.normal=normals;g.morphTargetsRelative=false;g.userData.expressionReports=reports;g.computeBoundingBox();g.computeBoundingSphere();
}

export function createExpressionSystem(character) {
  buildTargets(character.face.geometry);
  const oldGeometry=character.face.geometry;character.face.geometry=rebuildExpressionMouth(oldGeometry);oldGeometry.dispose();
  character.face.updateMorphTargets();
  const lowerJaw=new THREE.Group();lowerJaw.name='HingedLowerDentalArch';
  const pivot=new THREE.Vector3(0,-0.12,-0.42);lowerJaw.position.copy(pivot);character.root.add(lowerJaw);
  // Rigid enamel crowns keep their exact shape and identity. Gingiva and tongue
  // follow the same lower jaw; upper crowns and palate remain on the maxilla.
  const lower=[];
  character.root.traverse(o=>{if(o.isMesh && /^(Lower_|LowerScalloped|Lingual|Tongue)/.test(o.name))lower.push(o);});
  for(const mesh of lower) {lowerJaw.attach(mesh);}
  let current=normalizedWeights(1,0),target={...current},demoStart=null;
  function apply(weights) {
    current=normalizedWeights(weights.anger,weights.surprise);
    character.face.morphTargetInfluences[0]=current.neutral;
    character.face.morphTargetInfluences[1]=current.surprise;
    lowerJaw.rotation.x=current.surprise*0.20-current.neutral*0.14;
    lowerJaw.position.z=pivot.z-current.neutral*0.045;
  }
  apply(current);
  function set(weights,{immediate=false}={}) {demoStart=null;target=normalizedWeights(weights.anger,weights.surprise);if(immediate)apply(target);}
  const demoDuration=12;
  function sampleDemo(seconds) {
    const t=clamp(seconds,0,demoDuration),leg=Math.min(3,Math.floor(t/3)),u=clamp((t-leg*3-0.45)/2.1,0,1),blend=u*u*u*(u*(u*6-15)+10);
    const poses=[normalizedWeights(0,0),normalizedWeights(1,0),normalizedWeights(0,0),normalizedWeights(0,1),normalizedWeights(0,0)];
    return normalizedWeights(THREE.MathUtils.lerp(poses[leg].anger,poses[leg+1].anger,blend),THREE.MathUtils.lerp(poses[leg].surprise,poses[leg+1].surprise,blend));
  }
  return {
    set,apply, sampleDemo,demoDuration,
    play(now=performance.now()){demoStart=now;},stop(){demoStart=null;target={...current};},
    update(dt,now) {
      if(demoStart!==null) {const elapsed=(now-demoStart)/1000;apply(sampleDemo(elapsed));if(elapsed>=demoDuration){demoStart=null;target={...current};}return true;}
      const error=Math.abs(current.anger-target.anger)+Math.abs(current.surprise-target.surprise);
      if(error<0.0001){if(error)apply(target);return false;}
      const alpha=1-Math.exp(-Math.min(dt,0.05)/0.16);
      apply({anger:THREE.MathUtils.lerp(current.anger,target.anger,alpha),surprise:THREE.MathUtils.lerp(current.surprise,target.surprise,alpha)});return true;
    },
    get state(){return {...current,target:{...target},demo:demoStart!==null};},
    lowerJaw,
  };
}
