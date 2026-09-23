import { ECU_JOB_STATES, isEcuJobState } from './models.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  [ECU_JOB_STATES.QUEUED]: new Set([ECU_JOB_STATES.DISPATCHED, ECU_JOB_STATES.FAILED]),
  [ECU_JOB_STATES.DISPATCHED]: new Set([ECU_JOB_STATES.RUNNING, ECU_JOB_STATES.FAILED]),
  [ECU_JOB_STATES.RUNNING]: new Set([
    ECU_JOB_STATES.NEEDS_REVIEW,
    ECU_JOB_STATES.READY,
    ECU_JOB_STATES.FAILED,
  ]),
  [ECU_JOB_STATES.NEEDS_REVIEW]: new Set([ECU_JOB_STATES.QUEUED, ECU_JOB_STATES.FAILED]),
  [ECU_JOB_STATES.READY]: new Set(),
  [ECU_JOB_STATES.FAILED]: new Set([ECU_JOB_STATES.QUEUED]),
});

export function canTransitionEcuJob(from, to) {
  if (!isEcuJobState(from) || !isEcuJobState(to)) return false;
  return ALLOWED_TRANSITIONS[from].has(to);
}

export function assertEcuJobTransition(from, to) {
  if (!canTransitionEcuJob(from, to)) {
    throw new Error(`Illegal ECU job transition: ${from} -> ${to}`);
  }
  return true;
}
