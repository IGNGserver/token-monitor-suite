'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_CLIENT_ID_LENGTH,
  MAX_DEVICE_ID_LENGTH,
  MAX_MODEL_ID_LENGTH,
  MAX_SESSION_ID_LENGTH,
  validateDeviceRecordPayload
} = require('../../src/shared/wireValidation');

function validRecord() {
  return {
    deviceId: 'dev-a',
    allTime: {
      clients: { codex: 1 },
      models: { 'gpt-5': 1 },
      clientModels: { codex: { 'gpt-5': 1 } },
      sessions: {
        'codex:session-1': {
          client: 'codex',
          sessionId: 'session-1',
          models: { 'gpt-5': 1 },
          providers: { openai: 1 }
        }
      }
    }
  };
}

test('wire validation accepts identifiers at the existing SQL column limits', () => {
  const record = validRecord();
  record.deviceId = 'd'.repeat(MAX_DEVICE_ID_LENGTH);
  record.allTime.clients = { ['c'.repeat(MAX_CLIENT_ID_LENGTH)]: 1 };
  record.allTime.models = { ['m'.repeat(MAX_MODEL_ID_LENGTH)]: 1 };
  record.allTime.sessions = {
    fallback: {
      client: 'c'.repeat(MAX_CLIENT_ID_LENGTH),
      sessionId: 's'.repeat(MAX_SESSION_ID_LENGTH),
      models: { ['m'.repeat(MAX_MODEL_ID_LENGTH)]: 1 }
    }
  };
  assert.equal(validateDeviceRecordPayload(record), true);
});

test('wire validation rejects overlong identifiers instead of allowing SQL truncation failures or collisions', () => {
  const cases = [
    ['deviceId', { deviceId: 'd'.repeat(MAX_DEVICE_ID_LENGTH + 1) }, 'deviceId'],
    ['client key', { allTime: { clients: { ['c'.repeat(MAX_CLIENT_ID_LENGTH + 1)]: 1 } } }, 'allTime.clients key'],
    ['model key', { allTime: { models: { ['m'.repeat(MAX_MODEL_ID_LENGTH + 1)]: 1 } } }, 'allTime.models key'],
    ['session id', { allTime: { sessions: { item: { client: 'codex', sessionId: 's'.repeat(MAX_SESSION_ID_LENGTH + 1) } } } }, 'allTime.sessions session id']
  ];
  for (const [name, patch, field] of cases) {
    const record = { ...validRecord(), ...patch };
    assert.throws(
      () => validateDeviceRecordPayload(record),
      (error) => error.code === 'field_too_long' && error.field === field,
      name
    );
  }
});

test('wire validation bounds large maps and history rows', () => {
  const record = validRecord();
  record.allTime.clients = Object.fromEntries(Array.from({ length: 16 * 1024 + 1 }, (_, index) => [`client-${index}`, 1]));
  assert.throws(() => validateDeviceRecordPayload(record), (error) => error.code === 'too_many_entries');

  const historyRecord = validRecord();
  historyRecord.history = { daily: Array.from({ length: 4097 }, () => ({ date: '2026-08-01' })) };
  assert.throws(() => validateDeviceRecordPayload(historyRecord), (error) => error.code === 'too_many_entries');
});

// Every numeric period map has to appear in wireValidation's bounded lists: a map
// that is not listed is passed through completely unchecked, and a corrupted
// 1e300 reaching a DECIMAL(24,10) column fails the INSERT under strict mode and
// rolls back the whole ingest transaction — after which the device can never be
// stored again while it keeps resending that number. `clientCredits` is the
// newest such map, so this is what fails if a future per-client field is added to
// the period shape without also being added to the validator.
test('wire validation range-checks the per-client credit map', () => {
  const overflow = validRecord();
  overflow.allTime.clientCredits = { qoder: 1e300 };
  assert.throws(() => validateDeviceRecordPayload(overflow), (error) => error.code === 'invalid_payload');

  const overlongKey = validRecord();
  overlongKey.allTime.clientCredits = { [`qoder-${'x'.repeat(MAX_CLIENT_ID_LENGTH)}`]: 1 };
  assert.throws(() => validateDeviceRecordPayload(overlongKey), (error) => error.code === 'field_too_long');

  const oversized = validRecord();
  oversized.allTime.clientCredits = Object.fromEntries(
    Array.from({ length: 16 * 1024 + 1 }, (_, index) => [`client-${index}`, 1])
  );
  assert.throws(() => validateDeviceRecordPayload(oversized), (error) => error.code === 'too_many_entries');

  const valid = validRecord();
  valid.allTime.clientCredits = { qoder: 0.323132128 };
  assert.doesNotThrow(() => validateDeviceRecordPayload(valid),
    'a credit is a small positive float and must pass validation unchanged');
});

// `clientEstimated` is a boolean map, so it is not range-checked like the numeric
// ones — but its keys still have to fit the client-id column, or a device could
// push an overlong key through and get its own record truncated or collided.
test('wire validation bounds the per-client provenance map keys', () => {
  const overlongKey = validRecord();
  overlongKey.allTime.clientEstimated = { [`qoder-${'x'.repeat(MAX_CLIENT_ID_LENGTH)}`]: true };
  assert.throws(() => validateDeviceRecordPayload(overlongKey), (error) => error.code === 'field_too_long');

  const oversized = validRecord();
  oversized.allTime.clientEstimated = Object.fromEntries(
    Array.from({ length: 16 * 1024 + 1 }, (_, index) => [`client-${index}`, true])
  );
  assert.throws(() => validateDeviceRecordPayload(oversized), (error) => error.code === 'too_many_entries');

  const valid = validRecord();
  valid.allTime.clientEstimated = { qoder: true };
  assert.doesNotThrow(() => validateDeviceRecordPayload(valid));
});
