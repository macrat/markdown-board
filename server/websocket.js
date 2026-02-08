#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaborative editing
 * Uses the official @y/websocket-server implementation with SQLite persistence
 */

const ws = require('ws');
const http = require('http');
const Y = require('yjs');

// Import y-websocket server utilities
const {
  setupWSConnection,
  setPersistence,
} = require('@y/websocket-server/utils');
const { startPeriodicCleanup } = require('./cleanup-archives');
const { openDatabase } = require('./db-config');
const { SqlitePersistence } = require('./yjs-sqlite-persistence');

const PORT = process.env.NEXT_PUBLIC_WS_PORT || 1234;

// Open database and set up Yjs persistence
const db = openDatabase();
const sqlitePersistence = new SqlitePersistence(db);

// Configure @y/websocket-server to use SQLite persistence
setPersistence({
  bindState: async (docName, ydoc) => {
    // First, restore persisted state from SQLite
    const persistedYdoc = await sqlitePersistence.getYDoc(docName);
    const persistedState = Y.encodeStateAsUpdate(persistedYdoc);

    // Apply persisted state to current document
    Y.applyUpdate(ydoc, persistedState);

    // Then store any new state that wasn't in persistence
    // (only if the current doc has content not in persisted state)
    const currentState = Y.encodeStateAsUpdate(ydoc);
    if (currentState.length > 0) {
      sqlitePersistence.storeUpdate(docName, currentState);
    }

    // Listen for future updates and persist them
    ydoc.on('update', (update) => {
      sqlitePersistence.storeUpdate(docName, update);
    });
  },
  writeState: async () => {
    // No-op: updates are already persisted incrementally
  },
});

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('WebSocket server for Yjs\n');
});

const wss = new ws.Server({ server });

console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);
console.log(`✓ Using SQLite for Yjs document persistence`);

wss.on('connection', (conn, req) => {
  const roomName = req.url?.slice(1) || 'default';
  console.log(`Client connected to room: ${roomName}`);

  setupWSConnection(conn, req, {
    // Add custom logging
    docName: roomName,
    gc: true, // Enable garbage collection
  });

  conn.on('close', () => {
    console.log(`Client disconnected from room: ${roomName}`);
  });
});

server.listen(PORT);

// Start periodic cleanup of old archived pages
const cleanupInterval = startPeriodicCleanup(openDatabase);

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down WebSocket server...');
  clearInterval(cleanupInterval);
  wss.clients.forEach((client) => {
    client.close();
  });
  wss.close(() => {
    server.close(() => {
      db.close();
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
