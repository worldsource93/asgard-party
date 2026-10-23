import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../server/config.js';

test('production refuses ephemeral storage and invalid browser origins', () => {
  const valid = { NODE_ENV: 'production', DATABASE_URL: 'libsql://example.turso.io', DATABASE_AUTH_TOKEN: 'test-token', ALLOWED_ORIGINS: 'https://worldsource93.github.io' };
  assert.doesNotThrow(() => validateProductionConfig(valid));
  for (const overrides of [
    { DATABASE_URL: undefined }, { DATABASE_URL: 'file:local.db' },
    { DATABASE_AUTH_TOKEN: '' }, { ALLOWED_ORIGINS: '' },
    { ALLOWED_ORIGINS: 'https://worldsource93.github.io/asgard-party' },
    { ALLOWED_ORIGINS: 'http://worldsource93.github.io' },
  ]) assert.throws(() => validateProductionConfig({ ...valid, ...overrides }));
  assert.doesNotThrow(() => validateProductionConfig({}));
});
