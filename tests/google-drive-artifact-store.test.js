import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleDriveBackend } from '../src/infrastructure/ecu/google-drive-artifact-store.js';

test('requires complete Google Drive credentials', () => {
  assert.throws(() => createGoogleDriveBackend({clientId:'x'}), /GOOGLE_DRIVE_CREDENTIALS_REQUIRED/);
});
test('Google Drive backend exposes object-store contract', () => {
  const backend=createGoogleDriveBackend({clientId:'id',clientSecret:'secret',refreshToken:'refresh'});
  assert.equal(typeof backend.head,'function'); assert.equal(typeof backend.put,'function'); assert.equal(typeof backend.get,'function');
});
