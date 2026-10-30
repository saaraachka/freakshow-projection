import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createProceduralHead as createExpressionHead} from '../3d-character-viewer/surprised-mild-local-30/procedural-head.js';
const $=id=>document.getElementById(id),clay=new THREE.MeshStandardMaterial({color:0xaaa59d,roughness:.9});
const catalog={fed4cd1:{module:'../3d-character-viewer/baseline-fed4cd1/procedural-head.js',title:'Surface cleanup + angry brow',commit:'fed4cd183f3dafdd3d086e09f260322a80ec74b6'},'3b89be9':{module:'../3d-character-viewer/baseline-3b89be9/procedural-head.js',title:'Earlier carved-curl sculpt',commit:'3b89be9'}};
const panels={};let reference='fed4cd1',selected=null,syncing=false,viewName='front',dirty=true;
for(const id of ['original','expression','gesture']){
 const renderer=new THREE.WebGLRenderer({canvas:$(id),antialias:true});renderer.setClearColor(0x191d24);renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const scene=new THREE.Scene();scene.overrideMaterial=clay;scene.add(new THREE.HemisphereLight(0xffffff,0x555555,1.5));for(const [power,pos]of [[2.4,[3,5,5]],[1.2,[-4,2,3]],[2,[2,4,-5]]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(...pos);scene.add(light);}
 const camera=new THREE.PerspectiveCamera(37,1,.01,100),orbit=new OrbitControls(camera,$(id));orbit.enableDamping=false;orbit.minDistance=1.4;orbit.maxDistance=18;
 panels[id]={renderer,scene,camera,orbit,character:null};
 orbit.addEventListener('change',()=>{if(syncing)return;syncing=true;for(const [other,p]of Object.entries(panels)){if(other===id)continue;p.camera.position.copy(camera.position);p.orbit.target.copy(orbit.target);p.orbit.update();}syncing=false;dirty=true;});
}
function resize(){for(const [id,p]of Object.entries(panels)){const stage=$(id).parentElement;p.renderer.setSize(stage.clientWidth,stage.clientHeight,false);p.camera.aspect=stage.clientWidth/stage.clientHeight;p.camera.updateProjectionMatrix();}dirty=true;}
function setView(name=viewName){viewName=name;const close=$('close').checked,target=new THREE.Vector3(0,close?-.20:.28,close?.25:-.1),dir=new THREE.Vector3(...({front:[0,0,1],three:[.75,.1,1],side:[1,0,0]})[name]);const aspect=panels.original.camera.aspect,distance=(close?3.3:5.4)/Math.min(1,aspect/.96);syncing=true;for(const p of Object.values(panels)){p.orbit.target.copy(target);p.camera.position.copy(dir).normalize().multiplyScalar(distance).add(target);p.orbit.update();}syncing=false;dirty=true;}
function draw(){if(!dirty)return;for(const p of Object.values(panels))p.renderer.render(p.scene,p.camera);dirty=false;}
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{setView(button.dataset.view);draw();};$('reset-camera').onclick=()=>{setView('front');draw();};$('close').onchange=()=>{setView();draw();};$('clay').onchange=()=>{for(const p of Object.values(panels))p.scene.overrideMaterial=$('clay').checked?clay:null;dirty=true;draw();};
new ResizeObserver(()=>{resize();draw();}).observe(document.querySelector('main'));resize();setView();
async function original(key){const module=await import(catalog[key].module);return module.createProceduralHead();}
// Both later defaults intentionally reproduce their actual existing loader/reset.
// No gesture controller is imported and no facial parameters are invented here.
async function laterDefault(){const c=await createExpressionHead();c.expressionChannels.rest();return c;}
try{
 for(const [id,load]of [['original',()=>original(reference)],['expression',laterDefault],['gesture',laterDefault]]){$('status').textContent=`Loading ${id} preserved model…`;const c=await load();panels[id].character=c;panels[id].scene.add(c.root);dirty=true;draw();}
 $('status').textContent='Static review ready · rotate or zoom any head to match all three';
}catch(e){$('status').textContent='A preserved model could not load: '+e.message;throw e;}
$('reference').onchange=async()=>{const key=$('reference').value;$('reference').disabled=true;try{const c=await original(key);const p=panels.original;p.scene.remove(p.character.root);p.character=c;p.scene.add(c.root);reference=key;selected=null;$('original-title').textContent=catalog[key].title;$('selection').textContent='Reference changed. Choose an appearance to record a new review nomination.';$('export').disabled=true;document.querySelectorAll('article').forEach(a=>a.classList.remove('chosen'));dirty=true;draw();}catch(e){$('status').textContent=e.message;}finally{$('reference').disabled=false;}};
function nominate(column){selected={version:1,column,source:column==='original'?catalog[reference].commit:column==='expression'?'a8af356':'f17f295',reference,pose:'static-default',approval:'nomination-only',camera:{position:panels.original.camera.position.toArray(),target:panels.original.orbit.target.toArray()},appliedToProduction:false};document.querySelectorAll('article').forEach(a=>a.classList.toggle('chosen',a.dataset.column===column));$('selection').textContent=`Selected ${column==='original'?'A ('+reference+')':column==='expression'?'B (expression rest)':'C (current default)'} for review. Nothing has been applied to another viewer.`;$('export').disabled=false;try{localStorage.setItem('freakshow-visual-target-nomination-v1',JSON.stringify(selected));}catch{}}
for(const b of document.querySelectorAll('[data-choose]'))b.onclick=()=>nominate(b.dataset.choose);
$('export').onclick=()=>{if(!selected)return;const url=URL.createObjectURL(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='freakshow-static-visual-target.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('audit').textContent='Local-17 rest asset is byte-identical to the expression rig’s current rest asset. B and C therefore match by design. A loads the preserved static wide-grin source, not a new expression.';
window.sculptComparison={panels,setView(name){setView(name);draw();},draw(){dirty=true;draw();},get selection(){return selected;},get reference(){return reference;}};
// Rendering pauses while the static scene is unchanged. Orbit events mark it dirty.
function frame(){requestAnimationFrame(frame);draw();}requestAnimationFrame(frame);
