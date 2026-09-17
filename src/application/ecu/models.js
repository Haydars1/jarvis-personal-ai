export const ECU_JOB_STATES = Object.freeze({
  QUEUED: 'QUEUED',
  DISPATCHED: 'DISPATCHED',
  RUNNING: 'RUNNING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  READY: 'READY',
  FAILED: 'FAILED',
});

const ECU_JOB_STATE_SET = new Set(Object.values(ECU_JOB_STATES));

export function isEcuJobState(value) {
  return ECU_JOB_STATE_SET.has(value);
}

export function createEcuJobRecord({ id, artifactHash, operation, createdAt = Date.now() }) {
  if (!id || !artifactHash || !operation) {
    throw new TypeError('id, artifactHash and operation are required');
  }

  return Object.freeze({
    id,
    artifactHash,
    operation,
    state: ECU_JOB_STATES.QUEUED,
    runFingerprint: null,
    modelVersion: null,
    result: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
  });
}
