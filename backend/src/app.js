// HTTP layer: routes requests to the auth and item logic. createApp() returns a plain Node
// request handler, so component tests can start it on a random port without Docker.
const { ValidationError } = require('./errors');
const { validateCredentials, issueToken } = require('./auth');

const MAX_BODY_BYTES = 64 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new ValidationError('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new ValidationError('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function createApp({ store }) {
  return async function handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const path = new URL(req.url, 'http://localhost').pathname;

    try {
      if (path === '/api/health' && req.method === 'GET') {
        return send(res, 200, { status: 'ok' });
      }

      if (path === '/api/auth/register' && req.method === 'POST') {
        validateCredentials(await readJsonBody(req));
        return send(res, 201, { success: true, message: 'User registered successfully!' });
      }

      if (path === '/api/auth/login' && req.method === 'POST') {
        const { username } = validateCredentials(await readJsonBody(req));
        return send(res, 200, { success: true, token: issueToken(username) });
      }

      if (path === '/api/items' && req.method === 'GET') {
        return send(res, 200, store.list());
      }

      if (path === '/api/items' && req.method === 'POST') {
        return send(res, 201, store.create(await readJsonBody(req)));
      }

      const match = path.match(/^\/api\/items\/(\d+)$/);
      if (match && req.method === 'DELETE') {
        const id = Number(match[1]);
        if (!store.remove(id)) {
          return send(res, 404, { error: `Item ${id} not found` });
        }
        return send(res, 200, { success: true, message: `Record ${id} deleted.` });
      }

      return send(res, 404, { error: 'Route not found' });
    } catch (error) {
      if (error instanceof ValidationError) {
        return send(res, 400, { error: error.message });
      }
      console.error('Unhandled request error:', error);
      if (!res.headersSent) {
        send(res, 500, { error: 'Internal Server Error' });
      }
    }
  };
}

module.exports = { createApp };
