'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { calculateUsageEventDeltas } = require('../../src/hub/usage-events');

function snapshot(totalTokens) {
  return {
    deviceId: 'sync-device',
    updatedAt: '2026-07-18T00:00:00.000Z',
    allTime: {
      totalTokens,
      clients: { codex: totalTokens },
      models: { 'gpt-5': totalTokens },
      clientModels: { codex: { 'gpt-5': totalTokens } }
    }
  };
}

test('sync payloads without all-time sessions use explicit snapshot aggregate ids', () => {
  const { candidates, events } = calculateUsageEventDeltas(null, snapshot(42));
  assert.equal(candidates[0].sessionId, 'snapshot:codex:gpt-5');
  assert.equal(events[0].totalTokens, 42);
});

test('client-model aggregate cost is allocated once rather than twice', () => {
  const record = {
    deviceId: 'cost-device',
    allTime: {
      totalTokens: 100,
      models: { 'gpt-5': 100 },
      modelCosts: { 'gpt-5': 10 },
      clientModels: { codex: { 'gpt-5': 40 }, claude: { 'gpt-5': 60 } },
      clientModelCosts: { codex: { 'gpt-5': 4 }, claude: { 'gpt-5': 6 } }
    }
  };
  const { candidates } = calculateUsageEventDeltas(null, record);
  assert.deepEqual(candidates.map((candidate) => candidate.payloadCostUsd).sort((a, b) => a - b), [4, 6]);
});

// Qoder bills in credits and publishes an exact per-request figure, so the ledger
// has to carry credits at the same grain it already keys rows on:
// (client, session, model). Anything coarser would have to split a client total
// across rows it cannot attribute.

test('a session candidate takes credits from its own model split, not a ratio', () => {
  const record = {
    deviceId: 'credit-device',
    updatedAt: '2026-09-01T00:00:00.000Z',
    allTime: {
      totalTokens: 300,
      clients: { qoder: 300 },
      clientCredits: { qoder: 3 },
      models: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 },
      clientModels: { qoder: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 } },
      clientModelCredits: { qoder: { 'Qwen3.7-Plus': 2.5, 'GLM-4.7-Flash': 0.5 } },
      sessions: {
        'qoder:s1': {
          client: 'qoder',
          sessionId: 's1',
          totalTokens: 300,
          credits: 3,
          modelCredits: { 'Qwen3.7-Plus': 2.5, 'GLM-4.7-Flash': 0.5 },
          models: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 }
        }
      }
    }
  };

  const { candidates } = calculateUsageEventDeltas(null, record);
  const byModel = Object.fromEntries(candidates.map((candidate) => [candidate.model, candidate.credits]));

  // Model keys come back normalized (lower-cased) from the device-record pass.
  assert.deepEqual(byModel, { 'qwen3.7-plus': 2.5, 'glm-4.7-flash': 0.5 },
    'each row reports the credits the adapter attributed to that model');
  // A token-fraction split would have given 2 and 1 here, which is a guess.
  assert.notEqual(byModel['qwen3.7-plus'], 3 * (200 / 300));
});

test('a session with only a total falls back to the token fraction it already uses for cost', () => {
  const record = {
    deviceId: 'legacy-session-device',
    allTime: {
      totalTokens: 300,
      sessions: {
        'qoder:s1': {
          client: 'qoder',
          sessionId: 's1',
          totalTokens: 300,
          credits: 3,
          models: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 }
        }
      }
    }
  };

  const { candidates } = calculateUsageEventDeltas(null, record);
  const byModel = Object.fromEntries(candidates.map((candidate) => [candidate.model, candidate.credits]));

  assert.equal(byModel['qwen3.7-plus'], 2);
  assert.equal(byModel['glm-4.7-flash'], 1);
});

test('a snapshot candidate without all-time sessions takes the client-model credit map', () => {
  const record = {
    deviceId: 'sync-credit-device',
    updatedAt: '2026-09-01T00:00:00.000Z',
    allTime: {
      totalTokens: 300,
      models: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 },
      clientModels: { qoder: { 'Qwen3.7-Plus': 200, 'GLM-4.7-Flash': 100 } },
      clientModelCredits: { qoder: { 'Qwen3.7-Plus': 2.5, 'GLM-4.7-Flash': 0.5 } }
    }
  };

  const { candidates } = calculateUsageEventDeltas(null, record);
  assert.deepEqual(
    candidates.map((candidate) => [candidate.model, candidate.credits]).sort(),
    [['glm-4.7-flash', 0.5], ['qwen3.7-plus', 2.5]]
  );
});

test('a model shared by a credentialed and a non-credentialed client gets no invented credits', () => {
  // No clientModelCredits for claude: the model-level total must not be handed
  // out as a share, because credits are metered per provider.
  const record = {
    deviceId: 'mixed-device',
    allTime: {
      totalTokens: 100,
      models: { 'shared-model': 100 },
      modelCosts: { 'shared-model': 10 },
      clientModels: { qoder: { 'shared-model': 50 }, claude: { 'shared-model': 50 } },
      clientModelCredits: { qoder: { 'shared-model': 4 } }
    }
  };

  const { candidates } = calculateUsageEventDeltas(null, record);
  const credits = candidates.map((candidate) => candidate.credits).sort((a, b) => a - b);

  assert.deepEqual(credits, [0, 4]);
});

test('the per-client snapshot fallback credits the whole bucket once', () => {
  const record = {
    deviceId: 'client-only-device',
    allTime: {
      totalTokens: 500,
      clients: { qoder: 500 },
      clientCredits: { qoder: 12.5 }
    }
  };

  const { candidates } = calculateUsageEventDeltas(null, record);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sessionId, 'snapshot:qoder:unknown');
  assert.equal(candidates[0].credits, 12.5);
});

test('a credit-only increase still produces an event, and a reset never goes negative', () => {
  const base = {
    deviceId: 'reset-device',
    allTime: {
      totalTokens: 100,
      clients: { qoder: 100 },
      clientCredits: { qoder: 5 }
    }
  };
  // Same token count, more credits: an earlier build would have dropped the row.
  const { events } = calculateUsageEventDeltas(base, {
    ...base,
    allTime: { totalTokens: 100, clients: { qoder: 100 }, clientCredits: { qoder: 7.5 } }
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].credits, 2.5);
  assert.equal(events[0].totalTokens, 0);

  const reset = calculateUsageEventDeltas(base, {
    ...base,
    allTime: { totalTokens: 10, clients: { qoder: 10 }, clientCredits: { qoder: 1 } }
  });
  assert.ok(reset.events.every((event) => event.credits >= 0), 'a counter reset restarts the baseline');
  assert.equal(reset.events[0].credits, 1);
});
