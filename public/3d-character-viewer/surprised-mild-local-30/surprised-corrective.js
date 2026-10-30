const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a));return t*t*t*(10+t*(-15+6*t));};
const G=v=>Math.exp(-v*v);
/** Surprised-only support. No rest, jaw, binding or dental modifications. */
export function surprisedUpperDelta(x,y,z,state){
 const front=smooth(z,.03,.25),lateral=1-smooth(Math.abs(x),.70,.80);
 const browShape=Math.exp(-(((Math.abs(x)-.35)/.34)**4));
 const height=(.070+.018*G((Math.abs(x)-.22)/.18))*state.browRaise;
 const brow=height*browShape*smooth(y,.32,.45)*(1-smooth(y,.50,.90))*front*lateral;
 let eyeY=0,eyeZ=0;
 for(const sign of [-1,1]){
  const cx=sign*.393,cy=sign<0?.292:.316,dx=x-cx,dy=y-cy;
  const horizontal=1-smooth(Math.abs(dx),.11,.18);
  if(!horizontal)continue;
  const upper=G((dy-.055)/.075)*smooth(dy,-.01,.035);
  const lower=G((dy+.045)/.060)*(1-smooth(dy,-.025,.015));
  const influence=horizontal*smooth(z,.17,.32);
  const movement=state.eyeOpen*influence*(.027*upper-.009*lower);
  eyeY+=movement;
  // Keep the existing margin-to-globe offset as the lid slides over the globe.
  const oldZ=.215+Math.sqrt(Math.max(.0001,.205**2-dx*dx-dy*dy));
  const newZ=.215+Math.sqrt(Math.max(.0001,.205**2-dx*dx-(dy+movement)**2));
  const contact=G((z-oldZ)/.085)*Math.min(1,upper+lower);
  eyeZ+=(newZ-oldZ)*contact;
 }
 return [0,brow+eyeY,eyeZ];
}
export function transportedUpperNormal(x,y,z,n,state){
 const e=.00025,cols=[];
 for(let axis=0;axis<3;axis++){
  const a=[x,y,z],b=a.slice();a[axis]+=e;b[axis]-=e;
  const da=surprisedUpperDelta(...a,state),db=surprisedUpperDelta(...b,state);
  cols.push(da.map((v,k)=>(v-db[k])/(2*e)+(k===axis?1:0)));
 }
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const C=[cross(cols[1],cols[2]),cross(cols[2],cols[0]),cross(cols[0],cols[1])];
 const q=[0,1,2].map(k=>n[0]*C[0][k]+n[1]*C[1][k]+n[2]*C[2][k]);const len=Math.hypot(...q)||1;return q.map(v=>v/len);
}
export function surprisedMouthDelta(x,y,z,i,state,map,kiss){
 if(y>=.03||y<=-.86||z<=.12||Math.abs(x)>=.79)return [0,0,0];
 const front=smooth(z,.12,.32),oral=Math.exp(-((x/.48)**4))*Math.exp(-(((y+.45)/.25)**4))*front;
 const right=G((x-.342)/.25),left=G((x+.342)/.25),level=G((y+.44)/.16)*front;
 const dx=(.025*state.grin-.13*state.commissureIn)*(right-left)*level;
 const cheek=G((Math.abs(x)-.47)/.20)*G((y+.31)/.18)*front;
 const station=map.mouthRegions.lipStation[i],lip=station>=0&&station<160;
 const side=lip?(Math.sin(2*Math.PI*station/160)>=0?1:-1):(y>-.447?1:-1);
 const shape=lip?Math.abs(Math.sin(2*Math.PI*station/160))**.8:Math.sqrt(Math.max(0,1-(x/.355)**2));
 const near=lip?1:oral*G((y+.45)/.18);
 return [
  dx+.12*state.lipRound*kiss[0]*oral,
  .010*state.grin*(right+left)*level+.022*state.cheekCompress*cheek+.035*state.lipRound*kiss[1]*oral+state.lipRound*near*shape*(side>0?.072:-.052),
  .006*state.cheekCompress*cheek+.12*state.lipRound*kiss[2]*oral+.024*state.lipRound*near*shape,
 ];
}
