import {surprisedUpperDelta,transportedUpperNormal,surprisedMouthDelta} from "./surprised-corrective.js";
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a));return t*t*t*(10+t*(-15+6*t));};
const gauss=x=>Math.exp(-x*x);
export const channelDefaults=Object.freeze({jawOpen:0,browAnger:0,browRaise:0,eyeOpen:0,grin:0,lipRound:0,commissureIn:0,cheekCompress:0,surprisedCorrective:0});
export const endpointPresets=Object.freeze({
 neutral:{...channelDefaults,eyeOpen:.12,grin:-.08,cheekCompress:-.12},
 angry:{...channelDefaults,jawOpen:.12,browAnger:1,eyeOpen:-.25,grin:1,cheekCompress:1},
 surprised:{...channelDefaults,jawOpen:.38,browRaise:1,eyeOpen:.90,grin:-.10,lipRound:0,commissureIn:0,cheekCompress:-.18,surprisedCorrective:1},
});
/** Endpoint prototype only; no easing/demo or midpoint work before visual gate. */
export async function createExpressionChannels(character){
 async function load(name){const r=await fetch(new URL(name,import.meta.url));if(!r.ok)throw Error('Expression reference unavailable');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();}
 const [upper,map]=await Promise.all([load('./expression-reference.json.gz'),load('./hidden-cage-map.json.gz')]);
 const g=character.face.geometry,rest=g.attributes.position.array.slice(),normalRest=g.attributes.normal.array.slice(),regions=map.mouthRegions;
 const kiss=map.mouthPoseDeltas.LipsKiss,tri=map.triangles,bary=map.barycentric;
 const kissField=new Float32Array(rest.length),upperIndex=new Map();
 for(let j=0;j<upper.indices.length;j++)upperIndex.set(upper.indices[j],j);
 for(let i=0;i<rest.length/3;i++)if(map.softTissueWeight[i]>1e-5)for(let j=0;j<3;j++)for(let k=0;k<3;k++)kissField[i*3+k]+=bary[i*3+j]*kiss[tri[i*3+j]*3+k];
 const sections=Array.from({length:160},()=>[]);for(let i=0;i<regions.lipStation.length;i++)if(regions.lipStation[i]>=0&&regions.lipStation[i]<160)sections[regions.lipStation[i]].push(i);
 const canines=[];
 character.root.updateMatrixWorld(true);
 character.root.traverse(o=>{
  if(!o.isMesh||!/^Upper_.*canine/.test(o.name))return;
  const a=o.geometry.attributes.position,box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<a.count;i++){
   const v=a.array.slice(i*3,i*3+3),m=o.matrixWorld.elements;
   const q=[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
   for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],q[k]);box.max[k]=Math.max(box.max[k],q[k]);}
  }
  canines.push(box);
 });
 let state={...channelDefaults};
 function set(values={}){
  state={...channelDefaults,...values};state.jawOpen=clamp(state.jawOpen,0,.40);
  state.browAnger=clamp(state.browAnger);state.browRaise=clamp(state.browRaise);state.eyeOpen=clamp(state.eyeOpen,-.35,1);
  state.grin=clamp(state.grin,-.25,1);state.cheekCompress=clamp(state.cheekCompress,-.25,1);state.lipRound=clamp(state.lipRound);state.commissureIn=clamp(state.commissureIn);
  // Protected f6f7a88 driver is always the starting solution. No rebind,
  // changed rest, replacement jaw or extra skeletal/dental transform.
  character.deformation.set(state.jawOpen);
  const expression=Object.entries(state).some(([k,v])=>k!=='jawOpen'&&v!==0);
  if(!expression)return {...state};
  character.face.morphTargetInfluences.fill(0);
  const base=g.attributes.position.array.slice(),baseN=g.attributes.normal.array.slice(),p=g.attributes.position.array,n=g.attributes.normal.array;
  for(let i=0;i<rest.length/3;i++){
   const k=i*3,x=rest[k],y=rest[k+1],z=rest[k+2],u=upperIndex.get(i);
   if(state.surprisedCorrective){
    const d=surprisedUpperDelta(x,y,z,state),mouth=surprisedMouthDelta(x,y,z,i,state,map,[kissField[k],kissField[k+1],kissField[k+2]]);
    for(let axis=0;axis<3;axis++)p[k+axis]+=d[axis]+mouth[axis];
    if(y>.08&&y<.90&&z>0&&Math.abs(x)<.80)n.set(transportedUpperNormal(x,y,z,[baseN[k],baseN[k+1],baseN[k+2]],state),k);
    continue;
   }
   if(u!==undefined){
    const j=u*3,bw=upper.browWeight[u],ew=upper.eyeWeight[u];
    for(let axis=0;axis<3;axis++){
     p[k+axis]+=state.browAnger*bw*upper.angerDelta[j+axis]+state.browRaise*bw*upper.raiseDelta[j+axis]+state.eyeOpen*ew*upper.raiseDelta[j+axis];
     n[k+axis]+=state.browAnger*bw*upper.angerNormal[j+axis]+state.browRaise*bw*upper.raiseNormal[j+axis]+state.eyeOpen*ew*upper.raiseNormal[j+axis];
    }
   }
   if(y<.03&&y>-.86&&z>.12&&Math.abs(x)<.79){
    const front=smooth(z,.12,.32),oral=Math.exp(-((x/.48)**4))*Math.exp(-(((y+.45)/.25)**4))*front;
    const right=gauss((x-.342)/.25),left=gauss((x+.342)/.25),level=gauss((y+.44)/.16)*front;
    const corner=(right-left)*level;
    p[k]+=(.045*state.grin-.18*state.commissureIn)*corner;
    p[k+1]+=.014*state.grin*(right+left)*level;
    const cheek=gauss((Math.abs(x)-.47)/.20)*gauss((y+.31)/.18)*front;
    p[k+1]+=.022*state.cheekCompress*cheek;p[k+2]+=.006*state.cheekCompress*cheek;
    for(let axis=0;axis<3;axis++)p[k+axis]+=(axis===1?.08:.30)*state.lipRound*kissField[k+axis]*oral;
    const lip=regions.lipStation[i],isLip=lip>=0&&lip<160;
    const side=isLip?(Math.sin(2*Math.PI*lip/160)>=0?1:-1):(y>-.447?1:-1);
    const center=Math.sqrt(Math.max(0,1-(x/.37)**2));
    const nearLip=isLip?1:oral*gauss((y+.45)/.17);
    p[k+1]+=state.lipRound*nearLip*center*(side>0?.045:-.030);
    p[k+2]+=state.lipRound*nearLip*.030*center;
    // Raise the grin edge with its supporting flesh, never tooth geometry.
    p[k+1]+=state.grin*nearLip*(side>0?.010:-.002)*center;
   }
   const len=Math.hypot(n[k],n[k+1],n[k+2])||1;n[k]/=len;n[k+1]/=len;n[k+2]/=len;
  }
  // The jaw-solved lip sections receive rigid expression offsets/rolls.
  // This retains their cross-sectional volume during inward corner motion.
  for(let station=1;station<160;station++){
   if(station===80||!sections[station].length)continue;
   const edge=sections[station].reduce((a,b)=>regions.lipRadial[a]<regions.lipRadial[b]?a:b),e=edge*3;
   const angle=state.lipRound*(state.surprisedCorrective?.04:.12)*Math.sin(2*Math.PI*station/160),c=Math.cos(angle),s=Math.sin(angle);
   const target=[p[e],p[e+1],p[e+2]];
   for(const id of sections[station]){
    const k=id*3,dx=base[k]-base[e],dy=base[k+1]-base[e+1],dz=base[k+2]-base[e+2];
    p[k]=target[0]+dx;p[k+1]=target[1]+c*dy-s*dz;p[k+2]=target[2]+s*dy+c*dz;
    n[k]=baseN[k];n[k+1]=c*baseN[k+1]-s*baseN[k+2];n[k+2]=s*baseN[k+1]+c*baseN[k+2];
   }
  }
  if(state.surprisedCorrective){
   // Keep lateral soft tissue physically in front of the fixed upper canine
   // envelope. Interior cavity walls are excluded; no tooth is hidden/moved.
   for(let i=0;i<rest.length/3;i++){
    const k=i*3;if(rest[k+2]<.30||regions.vestibule[i]>.01||rest[k+1]>-.27||rest[k+1]<-.62)continue;
    let lift=0;
    for(const b of canines){
     const wx=smooth(p[k],b.min[0]-.04,b.min[0]+.005)*(1-smooth(p[k],b.max[0]-.005,b.max[0]+.04));
     const wy=smooth(p[k+1],b.min[1]-.035,b.min[1]+.005)*(1-smooth(p[k+1],b.max[1]-.005,b.max[1]+.035));
     lift=Math.max(lift,wx*wy*Math.min(.040,Math.max(0,b.max[2]+.012-p[k+2])));
    }
    p[k+2]+=lift;
   }
  }
  // Expression additions never move protected nose, auricles or cranium.
  // Preserve the locked jaw result there, including its original normals.
  for(let i=0;i<rest.length/3;i++){
   const k=i*3,x=rest[k],y=rest[k+1],z=rest[k+2];
   const nose=Math.abs(x)<.27&&y>-.28&&y<.25&&z>.46;
   if(nose||Math.abs(x)>.80||z<0||y>.90){p.set(base.subarray(k,k+3),k);n.set(baseN.subarray(k,k+3),k);}
  }
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();return {...state};
 }
 // Evaluate both soft-tissue fields on the SAME protected intermediate jaw.
 // This avoids a binary corrective-mode switch during preset interpolation.
 function blend(from,to,t,{eased=true}={}){
  t=clamp(t);if(eased)t=t*t*t*(10+t*(-15+6*t));
  const a=endpointPresets[from],b=endpointPresets[to];if(!a||!b)throw Error('Unknown expression');
  if(t===0)return set(a);if(t===1)return set(b);
  const jaw=a.jawOpen+(b.jawOpen-a.jawOpen)*t;
  set({...a,jawOpen:jaw});const pa=g.attributes.position.array.slice(),na=g.attributes.normal.array.slice();
  set({...b,jawOpen:jaw});const p=g.attributes.position.array,n=g.attributes.normal.array;
  for(let k=0;k<p.length;k++)p[k]=pa[k]+t*(p[k]-pa[k]);
  for(let k=0;k<n.length;k+=3){let len=0;for(let j=0;j<3;j++){n[k+j]=na[k+j]+t*(n[k+j]-na[k+j]);len+=n[k+j]**2;}len=Math.sqrt(len)||1;for(let j=0;j<3;j++)n[k+j]/=len;}
  state=Object.fromEntries(Object.keys(channelDefaults).map(k=>[k,a[k]+t*(b[k]-a[k])]));
  g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;g.computeBoundingSphere();return {...state};
 }
 return {set,blend,preset:name=>set(endpointPresets[name]),rest:()=>set(channelDefaults),get state(){return {...state}}};
}
