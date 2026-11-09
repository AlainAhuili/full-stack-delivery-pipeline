// Component tests: the real HTTP app on a random local port, no Docker or database.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../../src/app');
const { createItemStore } = require('../../src/items');
const { createPuzzleStore, generatePuzzle } = require('../../src/puzzle');

let server;
let baseUrl;

// Every puzzle comes from the same fixed random sequence, so its answer is known in advance.
const fixedRng = () => {
  let i = 0;
  const values = [0.1, 0.9, 0.3, 0.7, 0.5];
  return () => values[i++ % values.length];
};

test.beforeEach(async () => {
  server = http.createServer(
    createApp({
      store: createItemStore([{ id: 1, name: 'seed' }]),
      puzzles: createPuzzleStore({ rng: fixedRng() }),
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterEach(() => new Promise((resolve) => server.close(resolve)));

function call(method, path, body) {
  return fetch(baseUrl + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

test('health check answers ok', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('register and login validate the payload', async () => {
  assert.equal((await call('POST', '/api/auth/register', { username: 'u', password: 'p' })).status, 201);
  assert.equal((await call('POST', '/api/auth/register', { username: 'u' })).status, 400);

  const login = await call('POST', '/api/auth/login', { username: 'u', password: 'p' });
  assert.equal(login.status, 200);
  assert.ok((await login.json()).token);
  assert.equal((await call('POST', '/api/auth/login', {})).status, 400);
});

test('items can be created, listed and deleted', async () => {
  const created = await call('POST', '/api/items', { name: 'New item' });
  assert.equal(created.status, 201);
  const item = await created.json();

  const listed = await (await call('GET', '/api/items')).json();
  assert.deepEqual(
    listed.map((i) => i.name),
    ['seed', 'New item'],
  );

  assert.equal((await call('DELETE', `/api/items/${item.id}`)).status, 200);
  assert.equal((await call('DELETE', `/api/items/${item.id}`)).status, 404);
});

test('a puzzle is created without its answer and solved once', async () => {
  const created = await call('POST', '/api/puzzles', { difficulty: 'medium' });
  assert.equal(created.status, 201);
  const puzzle = await created.json();
  assert.match(puzzle.id, /^[0-9a-f-]{36}$/);
  assert.ok(puzzle.question);
  assert.equal(puzzle.answer, undefined);

  const expected = generatePuzzle('medium', fixedRng()).answer;
  const answered = await call('POST', `/api/puzzles/${puzzle.id}/answer`, { answer: expected });
  assert.equal(answered.status, 200);
  assert.deepEqual(
    { ...(await answered.json()), explanation: undefined },
    { correct: true, solution: expected, explanation: undefined },
  );

  const again = await call('POST', `/api/puzzles/${puzzle.id}/answer`, { answer: expected });
  assert.equal(again.status, 404);
});

test('puzzle input is validated', async () => {
  assert.equal((await call('POST', '/api/puzzles', { difficulty: 'impossible' })).status, 400);
  const { id } = await (await call('POST', '/api/puzzles', {})).json();
  assert.equal((await call('POST', `/api/puzzles/${id}/answer`, { answer: 'six' })).status, 400);
  assert.equal(
    (await call('POST', '/api/puzzles/00000000-0000-0000-0000-000000000000/answer', { answer: 1 })).status,
    404,
  );
});

test('bad input gets 400, unknown routes 404, preflight 204', async () => {
  assert.equal((await call('POST', '/api/items', { name: '' })).status, 400);
  assert.equal((await call('POST', '/api/items', '{not json')).status, 400);
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('DELETE', '/api/items/abc')).status, 404);
  assert.equal((await call('OPTIONS', '/api/items')).status, 204);
});
