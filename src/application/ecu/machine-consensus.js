export const MACHINE_STAGE1_LABELS=Object.freeze([
  'driver_wish',
  'torque_limiter',
  'boost_target',
  'rail_pressure',
]);

export function evaluateMachineHypothesisGroup(entries=[],{
  minPairs=8,
  minConfidence=0.94,
  minDirectionAgreement=0.90,
  maxP95Percent=25,
}={}){
  const unique=new Map();
  for(const raw of Array.isArray(entries)?entries:[]){
    const pairId=String(raw?.pairId||raw?.pair_id||'');
    const label=String(raw?.label||raw?.semanticLabel||raw?.semantic_label||'');
    const confidence=Number(raw?.confidence||0);
    const signed=Number(raw?.signed??raw?.medianSignedPercent??raw?.median_signed_percent??0);
    const p95=Number(raw?.p95??raw?.p95AbsPercent??raw?.p95_abs_percent??0);
    if(!pairId||!MACHINE_STAGE1_LABELS.includes(label))continue;
    if(!Number.isFinite(confidence)||confidence<minConfidence)continue;
    if(!Number.isFinite(signed)||signed===0)continue;
    if(!Number.isFinite(p95)||p95<=0||p95>maxP95Percent)continue;
    if(!unique.has(pairId))unique.set(pairId,{...raw,pairId,label,confidence,signed,p95});
  }
  const values=[...unique.values()];
  if(values.length<minPairs)return {promote:false,reason:'INSUFFICIENT_PAIRS',values,directionAgreement:0,averageConfidence:0};
  const positives=values.filter(item=>item.signed>0).length;
  const negatives=values.filter(item=>item.signed<0).length;
  const directionAgreement=Math.max(positives,negatives)/values.length;
  const averageConfidence=values.reduce((sum,item)=>sum+item.confidence,0)/values.length;
  if(directionAgreement<minDirectionAgreement)return {promote:false,reason:'DIRECTION_CONSENSUS_WEAK',values,directionAgreement,averageConfidence};
  if(averageConfidence<minConfidence)return {promote:false,reason:'CONFIDENCE_WEAK',values,directionAgreement,averageConfidence};
  return {promote:true,reason:'MACHINE_CONSENSUS_VERIFIED',values,directionAgreement,averageConfidence};
}
