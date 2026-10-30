// Local review only. Presets retain the approved jaw channel and shared skin.
const ready=setInterval(()=>{
 const a=window.assetViewer,c=a?.character?.expressionChannels;if(!c)return;clearInterval(ready);
 const panel=document.createElement('aside');panel.style.cssText='position:fixed;right:12px;bottom:12px;background:#19212f;color:white;padding:12px;z-index:1000;max-width:300px';
 panel.innerHTML='<strong>Local mild Surprised</strong><p><button data-p="neutral">Neutral</button> <button data-p="angry">Angry</button> <button data-p="surprised">Surprised</button></p><label>Blend <select id="mild-pair"><option value="neutral,angry">Neutral → Angry</option><option value="neutral,surprised">Neutral → Surprised</option><option value="angry,surprised">Angry → Surprised</option></select><input id="mild-blend" type="range" min="0" max="100" value="0"></label><p id="mild-readout">Selected A: jaw 38%, no lip pursing</p>';
 document.body.append(panel);
 const draw=()=>a.renderer.render(a.scene,a.camera);
 panel.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{c.preset(b.dataset.p);draw();});
 const slider=panel.querySelector('input'),pair=panel.querySelector('select');
 const update=()=>{const [from,to]=pair.value.split(',');c.blend(from,to,+slider.value/100);panel.querySelector('#mild-readout').textContent=`${from} → ${to}: ${slider.value}% (smooth easing)`;draw();};
 slider.oninput=update;pair.onchange=update;
},100);
