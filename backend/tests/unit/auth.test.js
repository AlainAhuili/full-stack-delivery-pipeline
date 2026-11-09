const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCredentials, issueToken } = require('../../src/auth');
const { ValidationError } = require('../../src/errors');

test('validateCredentials accepts a username and password and trims the username', () => {
  assert.deepEqual(validateCredentials({ username: ' dev_user ', password: 'secret' }), {
    username: 'dev_user',
    password: 'secret',
  });
});

test('validateCredentials rejects a missing username or password', () => {
  for (const input of [undefined, {}, { username: 'a' }, { password: 'b' }, { username: ' ', password: 'b' }]) {
    assert.throws(() => validateCredentials(input), ValidationError);
  }
});

test('issueToken returns a token tied to the username', () => {
  assert.match(issueToken('dev_user'), /dev_user$/);
});
