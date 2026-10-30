import {JAW_PIVOT,jawPose,jawWeight} from './mouth-kinematics.js';
/** Numeric hidden cage only: no donor BufferGeometry, Mesh, or scene node. */
export async function createHiddenCageDriver(character){
 const response=await fetch(new URL('./hidden-cage-map.json.gz',import.meta.url));
 if(!response.ok)throw Error('Hidden cage map unavailable');
 const map=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
 const regions=map.mouthRegions, motions=map.mouthPoseDeltas;
 const smooth=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
 const cage=new Float32Array(map.cagePosition),weights=new Float32Array(map.cageJawWeight),indices=new Uint32Array(map.triangles),bary=new Float32Array(map.barycentric),offset=new Float32Array(map.restOffset),soft=new Float32Array(map.softTissueWeight);
 const g=character.face.geometry,rest=g.attributes.position.array.slice(),normalRest=g.attributes.normal.array.slice();
 const sections=Array.from({length:160},()=>[]);
 for(let i=0;i<regions.lipStation.length;i++)if(regions.lipStation[i]>=0&&regions.lipStation[i]<160)sections[regions.lipStation[i]].push(i);
 const bone=character.root.getObjectByName('HingedLowerDentalArch');let amount=0;
 function move(x,y,z,w,pose){
  const a=w*pose.angle,c=Math.cos(a),s=Math.sin(a),dy=y-JAW_PIVOT[1],dz=z-JAW_PIVOT[2]+.005*w;
  return [x,y+dy*(c-1)-dz*s+w*pose.down,z+dy*s+dz*(c-1)-w*(pose.back-.005)];
 }
 function set(value=0){
  amount=Math.max(0,Math.min(.40,typeof value==='number'?value:value.jaw??0));
  const pose=jawPose(1-amount,amount),activation=smooth(amount,.10,.30);
  if(amount===0){
   g.attributes.position.array.set(rest);g.attributes.normal.array.set(normalRest);
   character.face.morphTargetInfluences.fill(0);character.face.morphTargetInfluences[0]=1;
  }else{
   character.face.morphTargetInfluences.fill(0);
   const moved=cage.slice();
   for(let j=0;j<weights.length;j++)moved.set(move(cage[j*3],cage[j*3+1],cage[j*3+2],weights[j],pose),j*3);
   // Real donor pose-unit residuals; skeletal jaw rotation was removed
   // during extraction. These assist lips, not the working Local-17 mandible.
   const gains={JawDrop:.10,LipsKiss:.025,UpperLipUp:.035,lowerLipDown:.020,MouthLeftPullDown:.015,MouthRightPullDown:.015};
   for(const [name,gain]of Object.entries(gains)){
    const field=motions[name];for(let k=0;k<moved.length;k++)moved[k]+=activation*gain*field[k];
   }
   const p=g.attributes.position.array,n=g.attributes.normal.array;
   for(let i=0;i<rest.length/3;i++){
    const k=i*3,x=rest[k],y=rest[k+1],z=rest[k+2];
    if(y>-.19){p.set(rest.subarray(k,k+3),k);n.set(normalRest.subarray(k,k+3),k);continue;}
    const rigid=jawWeight(x,y,z),jaw=move(x,y,z,rigid,pose),mix=soft[i];
    let delta=[0,0,0],w=0;
    if(mix>1e-5){
     for(let j=0;j<3;j++){
      const id=indices[k+j],b=bary[k+j];w+=b*weights[id];
      for(let axis=0;axis<3;axis++)delta[axis]+=b*(moved[id*3+axis]-cage[id*3+axis]);
     }
     // Retain each visible point's own rest offset. Transport its orientation
     // rather than copying the donor's surface or flattening lip thickness.
     const a=w*pose.angle,c=Math.cos(a),s=Math.sin(a),oy=offset[k+1],oz=offset[k+2];
     delta[1]+=oy*(c-1)-oz*s;delta[2]+=oy*s+oz*(c-1);
    }
    for(let axis=0;axis<3;axis++)p[k+axis]=rest[k+axis]+(1-mix)*(jaw[axis]-rest[k+axis])+mix*delta[axis];
    // Separate edge controls from vermilion flesh; the original lip volume
    // remains the asset. Corrections are zero through 10% and at rest.
    const upper=regions.upperInner[i],lower=regions.lowerInner[i];
    const curve=Math.max(0,1-(x/.35)**2);
    p[k+1]+=activation*(.006*upper*curve-.003*lower*curve);
    p[k+2]-=activation*(.008*upper+.010*lower)*(.3+.7*(x/.35)**2);
    p[k+2]-=.012*activation*regions.vestibule[i];
    // A rigid local commissure trajectory blends through adjacent flesh,
    // replacing the notched seam between independent lip correspondences.
    const corner=activation*regions.commissure[i];
    if(corner>0){
     const q=move(x,y,z,.32,pose);q[0]-=Math.sign(x)*.006*activation;q[1]-=.003*activation;q[2]-=.005*activation;
     for(let axis=0;axis<3;axis++)p[k+axis]=(1-corner)*p[k+axis]+corner*q[axis];
    }
    const a=((1-corner)*((1-mix)*rigid+mix*w)+corner*.32)*pose.angle,c=Math.cos(a),s=Math.sin(a);
    n[k]=normalRest[k];n[k+1]=normalRest[k+1]*c-normalRest[k+2]*s;n[k+2]=normalRest[k+1]*s+normalRest[k+2]*c;
   }
  }
  if(amount>.10){
   const p=g.attributes.position.array,n=g.attributes.normal.array;
   // Per-station rigid movement preserves a lip cross-section's rest volume.
   // Smooth only the opening-time delta, never the rest/Cupid sculpt.
   for(let station=1;station<160;station++){
    if(station===80||!sections[station].length)continue;
    const upper=station<80,edge=sections[station].reduce((a,b)=>regions.lipRadial[a]<regions.lipRadial[b]?a:b);
    const k=edge*3,ex=rest[k],ey=rest[k+1],ez=rest[k+2];
    const lateral=Math.min(1,Math.abs(ex)/.342),center=1-lateral*lateral;
    const lipWeight=.32+.56*smooth(Math.abs(Math.sin(2*Math.PI*station/160)),.05,.35);
    const q=upper?[ex,ey+.0015*activation*center,ez-.005*activation*lateral*lateral]:move(ex,ey,ez,lipWeight,pose);
    if(!upper){q[1]-=.007*activation*center;q[2]-=.004*activation*lateral*lateral;}
    const a=upper?0:lipWeight*pose.angle,c=Math.cos(a),sn=Math.sin(a);
    for(const id of sections[station]){
     const j=id*3,dx=rest[j]-ex,dy=rest[j+1]-ey,dz=rest[j+2]-ez;
     const target=[q[0]+dx,q[1]+c*dy-sn*dz,q[2]+sn*dy+c*dz];
     // The preserved commissure field retains ownership near each corner.
     const blend=activation*(1-regions.commissure[id]);
     for(let axis=0;axis<3;axis++)p[j+axis]=(1-blend)*p[j+axis]+blend*target[axis];
     const nx=normalRest[j],ny=normalRest[j+1]*c-normalRest[j+2]*sn,nz=normalRest[j+1]*sn+normalRest[j+2]*c;
     n[j]=(1-blend)*n[j]+blend*nx;n[j+1]=(1-blend)*n[j+1]+blend*ny;n[j+2]=(1-blend)*n[j+2]+blend*nz;
     const length=Math.hypot(n[j],n[j+1],n[j+2])||1;n[j]/=length;n[j+1]/=length;n[j+2]/=length;
    }
   }
  }
  // Skeleton remains the saved Local-17 implementation; the cage assists skin.
  bone.rotation.x=pose.angle;bone.position.set(JAW_PIVOT[0],JAW_PIVOT[1]+pose.down,JAW_PIVOT[2]-pose.back);
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();
  return {jaw:amount};
 }
 set(0);
 return {set,reset:()=>set(0),get state(){return {jaw:amount,donorRendered:false}},metadata:map.metadata};
}
