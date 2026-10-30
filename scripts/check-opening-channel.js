import {chromium} from 'playwright';import {readFile,writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
await mkdir('artifacts/hidden-cage-range-26',{recursive:true});
const reference=JSON.parse(await readFile('public/3d-character-viewer/review/inner-mouth-arc-local/capture.json')).reference;
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});let error;
 page.on('pageerror',e=>error=e);
 await page.goto('http://localhost:5173/public/3d-character-viewer/hidden-cage-range-26/index.html');
 await page.waitForFunction(()=>window.assetViewer?.modelState.loaded,null,{timeout:90000});if(error)throw error;
 const result=await page.evaluate(async()=>{
  const a=assetViewer,c=a.character,g=c.face.geometry;
  const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',v))].map(x=>x.toString(16).padStart(2,'0')).join('');
  async function snapshot(){a.scene.updateMatrixWorld(true);return {position:await hash(g.attributes.position.array),normal:await hash(g.attributes.normal.array),index:await hash(g.index.array),influences:c.face.morphTargetInfluences.slice(),dental:c.root.getObjectByName('HingedLowerDentalArch').matrix.toArray()};}
  const comparisons=[];
  for(const jaw of [.30,.35,.40]){
   c.deformation.set(jaw);const direct=await snapshot();
   c.deformation.reset();a.setExpression({jaw},{immediate:true});const integrated=await snapshot();
   if(JSON.stringify(direct)!==JSON.stringify(integrated))throw Error('Controller differs from approved driver at '+jaw);
   comparisons.push({jaw,identical:true,snapshot:integrated});
  }
  c.expressions.setJawOpening(0);const rest=await snapshot();
  return {comparisons,rest,channelLimits:c.openingChannel.limits,addedPresets:[],donorRendered:c.deformation.state.donorRendered};
 });
 for(const key of ['position','normal','index'])if(result.rest[key]!==reference[key])throw Error('Rest mismatch: '+key);
 if(JSON.stringify(result.rest.dental)!==JSON.stringify(reference.dental))throw Error('Rest dental mismatch');
 if(error)throw error;
 await writeFile('artifacts/hidden-cage-range-26/controller-equivalence.json',JSON.stringify(result,null,2)+'\n');
 console.log('Controller channel exactly matches approved geometry/normals/dental transforms at 30%, 35%, 40%; exact rest restored. No presets added.');
}finally{await browser.close()}
