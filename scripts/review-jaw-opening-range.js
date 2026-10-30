import {chromium} from 'playwright';import {mkdir,writeFile,readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const folder='artifacts/hidden-cage-range-26';await mkdir(folder,{recursive:true});
const reference=JSON.parse(await readFile('public/3d-character-viewer/review/inner-mouth-arc-local/capture.json')).reference;
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/public/3d-character-viewer/hidden-cage-range-26/index.html');await Promise.race([page.waitForFunction(()=>window.assetViewer?.modelState.loaded,null,{timeout:90000}),new Promise((_,reject)=>page.once('pageerror',reject))]);
 const checkRest=async()=>page.evaluate(async()=>{
  assetViewer.character.deformation.reset();const g=assetViewer.character.face.geometry;
  async function hash(a){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(v=>v.toString(16).padStart(2,'0')).join('')}
  return {position:await hash(g.attributes.position.array),normal:await hash(g.attributes.normal.array),index:await hash(g.index.array)};
 });
 const checks=[await checkRest()];
 await page.evaluate(()=>{document.querySelector('header').hidden=true;document.querySelector('#metrics').hidden=true;document.querySelectorAll('body>p').forEach(p=>p.hidden=true);assetViewer.orbit.enableDamping=false;});
 for(const jaw of [.30,.35,.40]){
  const label=String(jaw*100);await page.evaluate(jaw=>assetViewer.character.deformation.set(jaw),jaw);
  for(const [view,dir]of Object.entries({front:[0,0,1],three:[.75,.1,1],side:[1,0,0]})){
   await page.evaluate(dir=>{const a=assetViewer;a.setClay(true);a.orbit.target.set(0,-.47,.05);a.orbit.minDistance=.5;a.camera.position.set(...dir).normalize().multiplyScalar(2.85).add(a.orbit.target);a.orbit.update();a.renderer.render(a.scene,a.camera)},dir);
   await page.waitForTimeout(80);await page.locator('canvas').screenshot({path:`${folder}/${label}-${view}.png`});
  }
  checks.push(await checkRest());
 }
 for(const check of checks)for(const key of ['position','normal','index'])if(check[key]!==reference[key])throw Error('Rest mismatch: '+key);
 await writeFile(`${folder}/capture.json`,JSON.stringify({errors,restBufferChecks:checks,reference,poses:[.30,.35,.40]},null,2));
 if(errors.length)throw Error(errors.join('\n'));console.log('Nine requested range views saved; rest buffers exact before and after each pose.');
}finally{await browser.close()}
