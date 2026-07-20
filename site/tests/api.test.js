import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient } from '../src/api.js';


test('API client sends the Cognito ID token and no user identity in score body', async () => {
  const calls = [];
  const client = createApiClient({
    baseUrl: 'https://api.example.test/prod/',
    getIdToken: async () => 'verified-id-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ updated: true, bestScore: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.submitScore(42);

  assert.deepEqual(result, { updated: true, bestScore: 42 });
  assert.equal(calls[0].url, 'https://api.example.test/prod/me/score');
  assert.equal(calls[0].options.headers.Authorization, 'verified-id-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { score: 42 });
});

test('API client maps an HTTP error to a safe message', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.example.test/prod',
    getIdToken: async () => 'token',
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Score invalide.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ),
  });

  await assert.rejects(() => client.submitScore(-1), /Score invalide/);
});


test('API client rejects a non-HTTPS base URL', () => {
  assert.throws(
    () => createApiClient({ baseUrl: 'http://api.example.test', getIdToken: async () => 'token' }),
    /HTTPS/,
  );
});


test('API client requires an authenticated session before fetch', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    getIdToken: async () => null,
    fetchImpl: async () => assert.fail('fetch must not be called without a token'),
  });

  await assert.rejects(() => client.getLeaderboard(), /Connectez-vous/);
});


test('API client maps a network failure to a CORS-aware message', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    getIdToken: async () => 'token',
    fetchImpl: async () => { throw new TypeError('network down'); },
  });

  await assert.rejects(() => client.getPersonalScore(), /CORS/);
});
