// Acceptance stage: drives the running release candidate through the frontend's nginx, so every
// request crosses web -> API exactly as a browser's would. Needs the acceptance stack running
// (`make acceptance` starts it); BASE_URL defaults to its frontend port.
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';

async function call(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('the UI is served', async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Full-Stack CRUD Application/);
});

test('the API is reachable through the frontend proxy', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('a user registers, logs in and runs the full CRUD cycle', async () => {
  const username = `acceptance_${Date.now()}`;

  const registered = await call('POST', '/api/auth/register', { username, password: 'Secret123!' });
  assert.equal(registered.status, 201);

  const login = await call('POST', '/api/auth/login', { username, password: 'Secret123!' });
  assert.equal(login.status, 200);
  const { token } = login.body;
  assert.ok(token, 'login returns a token');

  const name = `item ${username}`;
  const created = await call('POST', '/api/items', { name }, token);
  assert.equal(created.status, 201);
  assert.equal(created.body.name, name);

  const afterCreate = await call('GET', '/api/items', undefined, token);
  assert.ok(afterCreate.body.some((item) => item.id === created.body.id));

  const deleted = await call('DELETE', `/api/items/${created.body.id}`, undefined, token);
  assert.equal(deleted.status, 200);

  const afterDelete = await call('GET', '/api/items', undefined, token);
  assert.ok(!afterDelete.body.some((item) => item.id === created.body.id));
});

test('the GUI offers the math puzzle button', async () => {
  const html = await (await fetch(`${BASE_URL}/`)).text();
  assert.match(html, /id="puzzle-btn"/);
});

test('a player gets a puzzle, answers it once and sees the solution', async () => {
  const created = await call('POST', '/api/puzzles', { difficulty: 'medium' });
  assert.equal(created.status, 201);
  assert.ok(created.body.question);
  assert.equal(created.body.answer, undefined, 'the answer stays on the server');

  const verdict = await call('POST', `/api/puzzles/${created.body.id}/answer`, { answer: -1 });
  assert.equal(verdict.status, 200);
  assert.equal(verdict.body.correct, false); // answers are never negative
  assert.ok(Number.isInteger(verdict.body.solution));
  assert.ok(verdict.body.explanation);

  // The revealed solution would be correct, but the puzzle is closed after one attempt.
  const replay = await call('POST', `/api/puzzles/${created.body.id}/answer`, { answer: verdict.body.solution });
  assert.equal(replay.status, 404);
});

test('invalid input is rejected', async () => {
  assert.equal((await call('POST', '/api/auth/login', {})).status, 400);
  assert.equal((await call('POST', '/api/items', { name: '' })).status, 400);
  assert.equal((await call('DELETE', '/api/items/999999999')).status, 404);
});
