// Safe routes only: protected jaw-only channel OR existing approved preset blend.
// No raw grin/cheek/eyelid combinations, buffers, bindings or geometry here.
export const DEFAULTS=Object.freeze({
 kick:{amount:.60,attack:.055,release:.20},
 snare:{amount:.80,attack:.040,release:.18},
 clap:{amount:.22,attack:.045,release:.12},
 percussion:{amount:.42,attack:.090,release:.27},
});
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function ease(x){x=clamp(x);return x*x*x*(10+x*(-15+6*x));}
export function envelope(age,attack,release){if(age<0||age>=attack+release)return 0;return age<attack?ease(age/attack):1-ease((age-attack)/release);}
export class Rehearsal{
 constructor(){this.mapping=structuredClone(DEFAULTS);this.events=[];}
 clear(){this.events=[];}
 schedule(categories,spacing=.55){this.clear();this.events=categories.map((category,i)=>({id:i,category,time:i*spacing,...this.mapping[category]}));}
 sample(time){
  // Maximum envelope avoids additive jaw/cheek inflation on overlaps.
  let amount=0;const active=[];
  for(const e of this.events){const weight=e.amount*envelope(time-e.time,e.attack,e.release);if(weight>0){active.push({category:e.category,weight});amount=Math.max(amount,weight);}}
  return {time,amount:clamp(amount),active};
 }
}
export function applyApproved(character,base,amount){
 amount=clamp(amount);
 if(base==='rest'){character.deformation.set(.4*amount);return {route:'f6f7a88 jaw only',jawOpen:.4*amount};}
 if(!['neutral','angry','surprised'].includes(base))throw Error('Choose an approved named expression before rehearsing');
 if(amount===0){character.expressionChannels.preset(base);return {route:base,amount:0};}
 // Reuse ONLY the approved pairwise interpolation. No independent channel edits.
 const target=base==='surprised'?'neutral':'surprised';
 character.expressionChannels.blend(base,target,amount,{eased:false});
 return {route:`approved ${base} → ${target}`,amount};
}
