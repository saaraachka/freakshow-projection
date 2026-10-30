/** First controller-integration step only. No Angry/Surprised presets. */
export function installOpeningExpressionChannel(character){
 const controller=character.expressions,driver=character.deformation;
 const legacySet=controller.set.bind(controller);
 const limits=Object.freeze([0,.40]);
 function setOpening(value){
  const amount=Number(value);
  if(!Number.isFinite(amount))throw new TypeError('Jaw opening must be finite');
  // The existing controller clears any old demo/pose request first. The
  // approved driver then owns the jaw channel and its exact zero/rest branch.
  legacySet({anger:0,surprise:0},{immediate:true});
  return driver.set(Math.max(limits[0],Math.min(limits[1],amount)));
 }
 controller.set=(weights,options)=>{
  if(weights&&Object.hasOwn(weights,'jaw'))return setOpening(weights.jaw);
  return legacySet(weights,options);
 };
 controller.setJawOpening=setOpening;
 const channel={set:setOpening,limits,get value(){return driver.state.jaw}};
 character.openingChannel=channel;
 return channel;
}
