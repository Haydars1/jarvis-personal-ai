import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECU_JOB_STATES,
  isEcuJobState,
  createEcuJobRecord,
} from '../src/application/ecu/models.js';
import {
  assertEcuJobTransition,
  canTransitionEcuJob,
} from '../src/application/ecu/state-machine.js';

test('defines stable ECU job states', () => {
  assert.deepEqual(Object.values(ECU_JOB_STATES), [
    'QUEUED',
    'DISPATCHED',
    'RUNNING',
    'NEEDS_REVIEW',
    'READY',
    'FAILED',
  ]);
  assert.equal(isEcuJobState('READY'), true);
  assert.equal(isEcuJobState('ready'), false);
});

test('allows only legal ECU job transitions', () => {
  assert.equal(canTransitionEcuJob('QUEUED', 'DISPATCHED'), true);
  assert.equal(canTransitionEcuJob('DISPATCHED', 'RUNNING'), true);
  assert.equal(canTransitionEcuJob('RUNNING', 'NEEDS_REVIEW'), true);
  assert.equal(canTransitionEcuJob('RUNNING', 'READY'), true);
  assert.equal(canTransitionEcuJob('RUNNING', 'FAILED'), true);
  assert.equal(canTransitionEcuJob('NEEDS_REVIEW', 'QUEUED'), true);
  assert.equal(canTransitionEcuJob('FAILED', 'QUEUED'), true);
  assert.equal(canTransitionEcuJob('READY', 'RUNNING'), false);
  assert.equal(canTransitionEcuJob('QUEUED', 'READY'), false);
});

test('assertEcuJobTransition rejects illegal transitions', () => {
  assert.throws(
    () => assertEcuJobTransition('QUEUED', 'READY'),
    /Illegal ECU job transition: QUEUED -> READY/,
  );
});

test('createEcuJobRecord creates a queued immutable-origin job model', () => {
  const job = createEcuJobRecord({
    id: 'job_1',
    artifactHash: 'abc123',
    operation: 'analyze',
    createdAt: 100,
  });

  assert.deepEqual(job, {
    id: 'job_1',
    artifactHash: 'abc123',
    operation: 'analyze',
    state: 'QUEUED',
    runFingerprint: null,
    modelVersion: null,
    result: null,
    error: null,
    createdAt: 100,
    updatedAt: 100,
  });
});
