#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaborative editing
 * Uses the official @y/websocket-server implementation
 */

const ws = require('ws');
const http = require('http');

// Import y-websocket server utilities
const { setupWSConnection } = require('@y/websocket-server/utils');

const PORT = process.env.WS_PORT || 1234;

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('WebSocket server for Yjs\n');
});

const wss = new ws.Server({ server });

console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (conn, req) => {
  const roomName = req.url?.slice(1) || 'default';
  console.log(`Client connected to room: ${roomName}`);
  
  setupWSConnection(conn, req, {
    // Add custom logging
    docName: roomName,
    gc: true // Enable garbage collection
  });
  
  conn.on('close', () => {
    console.log(`Client disconnected from room: ${roomName}`);
  });
});

server.listen(PORT);

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down WebSocket server...');
  wss.clients.forEach((client) => {
    client.close();
  });
  wss.close(() => {
    server.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

