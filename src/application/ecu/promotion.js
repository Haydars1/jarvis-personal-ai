export function ecuBenchmarkScore(metrics = {}) {
  const b=value=>Math.max(0,Math.min(1,Number(value||0)));
  return Math.max(0,Math.min(1,
    .35*b(metrics.accuracy)+
    .35*b(metrics.macro_f1)+
    .20*b(metrics.unknown_precision)+
    .10*(1-b(metrics.calibration_error))
  ));
}

export function decideEcuModelPromotion(productionMetrics, candidateMetrics = {}, {
  safetyTolerance=.01,
  minEvaluationCount=4,
  firstModelFloors={
    accuracy:.80,
    macro_f1:.70,
    unknown_precision:.80,
    calibration_error:.20,
  },
} = {}) {
  const evaluationCount=Number(candidateMetrics.evaluation_count||0);
  if(evaluationCount<minEvaluationCount){
    return {promote:false,reason:'INSUFFICIENT_HELDOUT_DATA',candidateScore:ecuBenchmarkScore(candidateMetrics)};
  }
  if(!productionMetrics){
    const ok=
      Number(candidateMetrics.accuracy||0)>=firstModelFloors.accuracy &&
      Number(candidateMetrics.macro_f1||0)>=firstModelFloors.macro_f1 &&
      Number(candidateMetrics.unknown_precision||0)>=firstModelFloors.unknown_precision &&
      Number(candidateMetrics.calibration_error??1)<=firstModelFloors.calibration_error;
    return {
      promote:ok,
      reason:ok?'FIRST_MODEL_SAFETY_FLOORS_PASSED':'FIRST_MODEL_SAFETY_FLOORS_FAILED',
      candidateScore:ecuBenchmarkScore(candidateMetrics),
      productionScore:null,
    };
  }

  const productionScore=ecuBenchmarkScore(productionMetrics);
  const candidateScore=ecuBenchmarkScore(candidateMetrics);
  if(Number(candidateMetrics.unknown_precision||0)+safetyTolerance<Number(productionMetrics.unknown_precision||0)){
    return {promote:false,reason:'SAFETY_METRIC_REGRESSION',candidateScore,productionScore};
  }
  if(Number(candidateMetrics.calibration_error??1)>Number(productionMetrics.calibration_error??1)+safetyTolerance){
    return {promote:false,reason:'SAFETY_METRIC_REGRESSION',candidateScore,productionScore};
  }
  if(candidateScore<=productionScore){
    return {promote:false,reason:'BENCHMARK_NOT_BETTER',candidateScore,productionScore};
  }
  return {promote:true,reason:'BENCHMARK_IMPROVED',candidateScore,productionScore};
}
