// CRUD rules for items and an in-memory store. Pure logic: no HTTP, no database,
// so it is covered by fast unit tests in the commit stage.
const { ValidationError } = require('./errors');

const MAX_NAME_LENGTH = 255;

function validateItem(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new ValidationError('Item name is required');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`Item name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return { name };
}

function createItemStore(seed = []) {
  let items = seed.map((item) => ({ ...item }));
  let nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;

  return {
    list() {
      return items.map((item) => ({ ...item }));
    },

    create(input) {
      const { name } = validateItem(input);
      const item = { id: nextId++, name };
      items.push(item);
      return { ...item };
    },

    // Returns false when no item has this id.
    remove(id) {
      const before = items.length;
      items = items.filter((item) => item.id !== id);
      return items.length < before;
    },
  };
}

module.exports = { validateItem, createItemStore, MAX_NAME_LENGTH };
