const test = require('node:test');
const assert = require('node:assert/strict');
const UserRepository = require('../../src/userRepository');

// A stand-in for pg's Pool that records queries instead of hitting PostgreSQL.
function fakePool(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows };
    },
  };
}

test('create inserts name and email as parameters and returns the new row', async () => {
  const row = { id: 1, name: 'Ada', email: 'ada@example.test', created_at: new Date() };
  const pool = fakePool([row]);
  const user = await new UserRepository(pool).create({ name: 'Ada', email: 'ada@example.test' });

  assert.deepEqual(user, row);
  assert.match(pool.calls[0].sql, /INSERT INTO users/);
  assert.deepEqual(pool.calls[0].values, ['Ada', 'ada@example.test']);
});

test('findAll returns every row ordered by id', async () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const pool = fakePool(rows);
  assert.deepEqual(await new UserRepository(pool).findAll(), rows);
  assert.match(pool.calls[0].sql, /ORDER BY id/);
});
