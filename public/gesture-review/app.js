import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createProceduralHead} from '../3d-character-viewer/surprised-mild-local-30/procedural-head.js';
import {Rehearsal,applyApproved,clamp} from './performance.js';
const $=id=>document.getElementById(id),names={kick:'Kick',snare:'Snare',clap:'Clap',percussion:'Other percussion'},exprNames={rest:'Default grin · approved rest',neutral:'Neutral',angry:'Angry',surprised:'Surprised A'};
if(new URL(location.href).searchParams.has('capture'))document.body.classList.add('capture');
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setClearColor(0x191d24);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.01,100),orbit=new OrbitControls(camera,$('scene'));orbit.enableDamping=false;orbit.minDistance=1.2;orbit.maxDistance=18;
scene.add(new THREE.HemisphereLight(0xffffff,0x555555,1.5));for(const [power,pos]of [[2.4,[3,5,5]],[1.2,[-4,2,3]],[2,[2,4,-5]]]){const l=new THREE.DirectionalLight(0xffffff,power);l.position.set(...pos);scene.add(l);}
const clay=new THREE.MeshStandardMaterial({color:0xaaa59d,roughness:.9});scene.overrideMaterial=clay;
let dirty=true,base='rest',mode='expression',category='kick',paused=true,anchor=0,origin=performance.now(),speed=1,applied='',lastControllerMs=0,renderMs=0,character;
const model=new Rehearsal();const time=()=>paused?anchor:anchor+(performance.now()-origin)/1000*speed;
function seek(t){anchor=t;origin=performance.now();}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize($('stage').clientWidth,$('stage').clientHeight,false);camera.aspect=$('stage').clientWidth/$('stage').clientHeight;camera.updateProjectionMatrix();dirty=true;}
new ResizeObserver(resize).observe($('stage'));resize();
function view(name){const dir={front:[0,0,1],three:[.75,.1,1],side:[1,0,0]}[name];orbit.target.set(0,.28,-.1);camera.position.set(...dir).normalize().multiplyScalar(camera.aspect<.8?6.5:5.4).add(orbit.target);orbit.update();dirty=true;}
view('front');orbit.addEventListener('change',()=>dirty=true);document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('clay').onchange=()=>{scene.overrideMaterial=$('clay').checked?clay:null;dirty=true;};
function measured(fn){const start=performance.now();const result=fn();lastControllerMs=performance.now()-start;dirty=true;return result;}
function stop(){model.clear();paused=true;seek(0);mode='expression';applied='';$('pause').textContent='Resume';}
function selectExpression(name){stop();base=name;measured(()=>name==='rest'?character.expressionChannels.rest():character.expressionChannels.preset(name));$('current').textContent=exprNames[name];document.querySelectorAll('[data-expression]').forEach(b=>b.classList.toggle('selected',b.dataset.expression===name));}
for(const b of document.querySelectorAll('[data-expression]'))b.onclick=()=>selectExpression(b.dataset.expression);
function blend(){stop();base='blend';const [from,to]=$('pair').value.split(','),weight=+$('blend').value/100;measured(()=>character.expressionChannels.blend(from,to,weight));$('current').textContent=`${exprNames[from]} → ${exprNames[to]} · ${Math.round(weight*100)}%`;$('blend-label').textContent=$('current').textContent;document.querySelectorAll('[data-expression]').forEach(b=>b.classList.remove('selected'));}
$('blend').oninput=blend;$('pair').onchange=()=>character&&blend();
function updateMapping(){const m=model.mapping[category];for(const [key,scale,unit]of [['amount',100,'%'],['attack',1000,' ms'],['release',1000,' ms']]){const id=key==='amount'?'strength':key;$(id).value=Math.round(m[key]*scale);$(id+'-value').textContent=Math.round(m[key]*scale)+unit;}$('gesture-description').textContent={kick:'Medium opening · fast return',snare:'Stronger opening · sharper attack',clap:'Small opening · brief articulation',percussion:'Moderate opening · slower return'}[category];$('preview').textContent='Preview '+names[category];document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',b.dataset.category===category));}
for(const b of document.querySelectorAll('[data-category]'))b.onclick=()=>{category=b.dataset.category;updateMapping();};
for(const [id,key,scale,unit]of [['strength','amount',100,'%'],['attack','attack',1000,' ms'],['release','release',1000,' ms']])$(id).oninput=()=>{model.mapping[category][key]=Number($(id).value)/scale;$(id+'-value').textContent=$(id).value+unit;};
function start(categories,spacing=.55){if(base==='blend')selectExpression('rest');model.schedule(categories,spacing);seek(0);paused=false;mode='rehearsal';applied='';$('pause').textContent='Pause';$('current').textContent='Rehearsal over '+exprNames[base];}
$('preview').onclick=()=>start([category]);$('sequence').onclick=()=>start(['kick','snare','clap','percussion']);$('triple').onclick=()=>start([category,category,category],.45);
$('slow').onchange=()=>{const t=time();speed=$('slow').checked?.15:1;seek(t);};$('pause').onclick=()=>{const t=time();paused=!paused;seek(t);$('pause').textContent=paused?'Resume':'Pause';};
$('scrub').oninput=()=>{paused=true;seek(+$('scrub').value/1000);$('pause').textContent='Resume';};$('reset').onclick=()=>selectExpression('rest');
function sampleAt(t){paused=true;seek(t);mode='rehearsal';const s=model.sample(t);measured(()=>applyApproved(character,base,s.amount));applied=`${base}:${s.amount}`;return s;}
updateMapping();
try{character=await createProceduralHead();scene.add(character.root);selectExpression('rest');$('status').textContent='Approved rig a8af356 · no custom facial channel combinations';document.querySelectorAll('button:disabled,input:disabled').forEach(b=>b.disabled=false);}catch(e){$('status').textContent='Head could not load: '+e.message;throw e;}
function draw(){requestAnimationFrame(draw);const t=time();if(mode==='rehearsal'){const s=model.sample(t),key=`${base}:${s.amount}`;if(key!==applied){const route=measured(()=>applyApproved(character,base,s.amount));applied=key;$('route').textContent=JSON.stringify(route);}}
$('time').textContent=t.toFixed(3)+' s';if(!paused)$('scrub').value=Math.min(2500,t*1000);if(dirty){const before=performance.now();renderer.render(scene,camera);renderMs=performance.now()-before;dirty=false;}$('timing').textContent=`Controller ${lastControllerMs.toFixed(1)} ms · render submission ${renderMs.toFixed(1)} ms (GPU completion is separate)`;}
requestAnimationFrame(draw);
window.gestureReview={character,model,renderer,scene,camera,orbit,view,selectExpression,sampleAt,blend(from,to,t){stop();base='blend';measured(()=>character.expressionChannels.blend(from,to,t));},setBase:name=>selectExpression(name),get state(){return {base,mode,time:time(),paused,controllerMs:lastControllerMs,renderSubmissionMs:renderMs};}};
