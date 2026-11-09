// Authentication rules. Users are not stored yet and the token is a placeholder: registration
// and login only validate the payload. Persisting users goes through userRepository.js and the
// password_hash column (migration 003) once it is implemented.
const { ValidationError } = require('./errors');

function validateCredentials(input) {
  const username = typeof input?.username === 'string' ? input.username.trim() : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!username || !password) {
    throw new ValidationError('Username and password are required');
  }
  return { username, password };
}

function issueToken(username) {
  return `ey-mock-session-token-for-${username}`;
}

module.exports = { validateCredentials, issueToken };
