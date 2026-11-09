const test = require('node:test');
const assert = require('node:assert/strict');
const { validateItem, createItemStore, MAX_NAME_LENGTH } = require('../../src/items');
const { ValidationError } = require('../../src/errors');

test('validateItem trims the name', () => {
  assert.deepEqual(validateItem({ name: '  Valid Item  ' }), { name: 'Valid Item' });
});

test('validateItem rejects missing, blank and non-string names', () => {
  for (const input of [undefined, {}, { name: '' }, { name: '   ' }, { name: 42 }]) {
    assert.throws(() => validateItem(input), ValidationError);
  }
});

test('validateItem rejects names longer than the column allows', () => {
  assert.throws(() => validateItem({ name: 'x'.repeat(MAX_NAME_LENGTH + 1) }), /at most/);
});

test('store creates items with increasing ids after the seed', () => {
  const store = createItemStore([{ id: 7, name: 'seed' }]);
  const a = store.create({ name: 'a' });
  const b = store.create({ name: 'b' });
  assert.equal(a.id, 8);
  assert.equal(b.id, 9);
  assert.deepEqual(
    store.list().map((item) => item.name),
    ['seed', 'a', 'b'],
  );
});

test('store does not save invalid items', () => {
  const store = createItemStore();
  assert.throws(() => store.create({ name: '' }), ValidationError);
  assert.deepEqual(store.list(), []);
});

test('store removes by id and reports unknown ids', () => {
  const store = createItemStore([{ id: 1, name: 'one' }]);
  assert.equal(store.remove(1), true);
  assert.equal(store.remove(1), false);
  assert.deepEqual(store.list(), []);
});

test('list returns copies, so callers cannot change stored items', () => {
  const store = createItemStore([{ id: 1, name: 'one' }]);
  store.list()[0].name = 'changed';
  assert.equal(store.list()[0].name, 'one');
});
