// Unit tests for the browser API client (src/app.js) with fetch and localStorage faked.
const test = require('node:test');
const assert = require('node:assert/strict');

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function respond(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let calls;
function stubFetch(...responses) {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return responses.shift();
  };
}

globalThis.localStorage = fakeStorage();
console.error = () => {}; // the client logs every failure; keep test output readable
const App = require('../../src/app');

test.beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

test('login stores the token and later requests send it', async () => {
  stubFetch(respond(200, { token: 'abc' }), respond(200, []));
  await App.login('dev', 'secret');
  assert.equal(App.getToken(), 'abc');

  await App.getItems();
  assert.equal(calls[1].url, '/api/items');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer abc');
});

test('requests go to the same-origin /api path', async () => {
  stubFetch(respond(201, {}));
  await App.register('dev', 'secret');
  assert.equal(calls[0].url, '/api/auth/register');
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: 'dev', password: 'secret' });
});

test('failed login surfaces the server message', async () => {
  stubFetch(respond(400, { error: 'Username and password are required' }));
  await assert.rejects(App.login('', ''), /required/);
  assert.equal(App.getToken(), null);
});

test('a 401 clears the token and returns null', async () => {
  App.setToken('expired');
  stubFetch(respond(401, {}));
  assert.equal(await App.getItems(), null);
  assert.equal(App.getToken(), null);
});

test('create and delete call the item endpoints', async () => {
  stubFetch(respond(201, { id: 3, name: 'x' }), respond(200, { success: true }));
  assert.deepEqual(await App.createItem('x'), { id: 3, name: 'x' });
  await App.deleteItem(3);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].url, '/api/items/3');
  assert.equal(calls[1].options.method, 'DELETE');
});
