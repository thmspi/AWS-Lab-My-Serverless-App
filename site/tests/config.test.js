import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectConfiguration, readRuntimeConfiguration } from '../src/config.js';


test('empty placeholders keep the game playable but AWS features disabled', () => {
  const result = inspectConfiguration({
    AWS_REGION: '__AWS_REGION__',
    USER_POOL_ID: '__USER_POOL_ID__',
    USER_POOL_CLIENT_ID: '__USER_POOL_CLIENT_ID__',
    API_BASE_URL: '__API_BASE_URL__',
  });

  assert.equal(result.authReady, false);
  assert.equal(result.apiReady, false);
  assert.deepEqual(result.missingAuth, ['AWS_REGION', 'USER_POOL_ID', 'USER_POOL_CLIENT_ID']);
});

test('Cognito can be enabled before the API', () => {
  const result = inspectConfiguration({
    AWS_REGION: 'us-east-1',
    USER_POOL_ID: 'us-east-1_example',
    USER_POOL_CLIENT_ID: 'client-id',
    API_BASE_URL: '',
  });

  assert.equal(result.authReady, true);
  assert.equal(result.apiReady, false);
});

test('API URL must be HTTPS', () => {
  const result = inspectConfiguration({
    AWS_REGION: 'us-east-1',
    USER_POOL_ID: 'us-east-1_example',
    USER_POOL_CLIENT_ID: 'client-id',
    API_BASE_URL: 'http://insecure.example.test/prod',
  });

  assert.equal(result.apiReady, false);
  assert.match(result.apiError, /HTTPS/);
});


test('runtime configuration is read from the precompiled global config file', () => {
  globalThis.DINO_CONFIG = {
    AWS_REGION: 'us-east-1',
    USER_POOL_ID: 'us-east-1_example',
    USER_POOL_CLIENT_ID: 'client-id',
    API_BASE_URL: 'https://api.example.test/prod/',
  };

  const result = readRuntimeConfiguration();

  assert.equal(result.apiReady, true);
  assert.equal(result.config.API_BASE_URL, 'https://api.example.test/prod');
  delete globalThis.DINO_CONFIG;
});
