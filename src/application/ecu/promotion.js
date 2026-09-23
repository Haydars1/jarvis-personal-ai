const REQUIRED_METRICS=['accuracy','macro_f1','unknown_precision','calibration_error'];

function hasFiniteBenchmarkMetrics(metrics, { requireEvaluationCount = false } = {}) {
  if (!metrics || typeof metrics !== 'object') return false;
  if (REQUIRED_METRICS.some(key => !Number.isFinite(Number(metrics[key])))) return false;
  if (requireEvaluationCount && !Number.isFinite(Number(metrics.evaluation_count))) return false;
  return true;
}

export function ecuBenchmarkScore(metrics = {}) {
  if (!hasFiniteBenchmarkMetrics(metrics)) return 0;
  const b=value=>Math.max(0,Math.min(1,Number(value)));
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
  if(!hasFiniteBenchmarkMetrics(candidateMetrics,{requireEvaluationCount:true})){
    return {promote:false,reason:'INVALID_BENCHMARK_METRICS',candidateScore:ecuBenchmarkScore(candidateMetrics)};
  }
  if(productionMetrics && !hasFiniteBenchmarkMetrics(productionMetrics)){
    return {promote:false,reason:'INVALID_PRODUCTION_BENCHMARK_METRICS',candidateScore:ecuBenchmarkScore(candidateMetrics),productionScore:ecuBenchmarkScore(productionMetrics)};
  }
  const evaluationCount=Number(candidateMetrics.evaluation_count);
  if(evaluationCount<minEvaluationCount){
    return {promote:false,reason:'INSUFFICIENT_HELDOUT_DATA',candidateScore:ecuBenchmarkScore(candidateMetrics)};
  }
  if(!productionMetrics){
    const ok=
      Number(candidateMetrics.accuracy)>=firstModelFloors.accuracy &&
      Number(candidateMetrics.macro_f1)>=firstModelFloors.macro_f1 &&
      Number(candidateMetrics.unknown_precision)>=firstModelFloors.unknown_precision &&
      Number(candidateMetrics.calibration_error)<=firstModelFloors.calibration_error;
    return {
      promote:ok,
      reason:ok?'FIRST_MODEL_SAFETY_FLOORS_PASSED':'FIRST_MODEL_SAFETY_FLOORS_FAILED',
      candidateScore:ecuBenchmarkScore(candidateMetrics),
      productionScore:null,
    };
  }

  const productionScore=ecuBenchmarkScore(productionMetrics);
  const candidateScore=ecuBenchmarkScore(candidateMetrics);
  if(Number(candidateMetrics.unknown_precision)+safetyTolerance<Number(productionMetrics.unknown_precision)){
    return {promote:false,reason:'SAFETY_METRIC_REGRESSION',candidateScore,productionScore};
  }
  if(Number(candidateMetrics.calibration_error)>Number(productionMetrics.calibration_error)+safetyTolerance){
    return {promote:false,reason:'SAFETY_METRIC_REGRESSION',candidateScore,productionScore};
  }
  if(candidateScore<=productionScore){
    return {promote:false,reason:'BENCHMARK_NOT_BETTER',candidateScore,productionScore};
  }
  return {promote:true,reason:'BENCHMARK_IMPROVED',candidateScore,productionScore};
}
