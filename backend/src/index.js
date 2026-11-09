// Process entry point: wires the in-memory store into the HTTP app and starts listening.
const http = require('http');
const { createApp } = require('./app');
const { createItemStore } = require('./items');

const store = createItemStore([
  { id: 1, name: 'Database Record Cluster Alpha' },
  { id: 2, name: 'Automated Core Pipeline Asset' },
]);

const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(createApp({ store }));
server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

// Let `docker stop` end the process cleanly instead of waiting for the kill timeout.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
