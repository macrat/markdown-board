#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaborative editing
 * Handles real-time synchronization between multiple clients
 */

const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const syncProtocol = require('lib0/dist/encoding.cjs');
const decoding = require('lib0/dist/decoding.cjs');

const PORT = process.env.WS_PORT || 1234;

// Store Y.Doc instances and state vectors for each room
const docs = new Map();
const connections = new Map();

// Get or create a Y.Doc for a room
function getDoc(roomName) {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
    
    // Listen for updates and broadcast them
    doc.on('update', (update, origin) => {
      const conns = connections.get(roomName) || [];
      const encoder = syncProtocol.createEncoder();
      syncProtocol.writeVarUint(encoder, 0); // messageSync
      syncProtocol.writeVarUint8Array(encoder, update);
      const message = syncProtocol.toUint8Array(encoder);
      
      conns.forEach((conn) => {
        if (conn !== origin && conn.readyState === WebSocket.OPEN) {
          conn.send(message, { binary: true });
        }
      });
    });
  }
  return doc;
}

const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (conn, req) => {
  const roomName = req.url?.slice(1) || 'default';
  const doc = getDoc(roomName);
  
  // Add connection to room
  if (!connections.has(roomName)) {
    connections.set(roomName, []);
  }
  connections.get(roomName).push(conn);
  
  console.log(`Client connected to room: ${roomName} (${connections.get(roomName).length} clients)`);
  
  // Send initial state
  const encoder = syncProtocol.createEncoder();
  syncProtocol.writeVarUint(encoder, 0); // messageSync  
  syncProtocol.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(doc));
  conn.send(syncProtocol.toUint8Array(encoder), { binary: true });
  
  conn.on('message', (message) => {
    try {
      const uint8Array = new Uint8Array(message);
      const decoder = decoding.createDecoder(uint8Array);
      const messageType = decoding.readVarUint(decoder);
      
      if (messageType === 0) {
        // Sync message - apply update
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(doc, update, conn);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  conn.on('close', () => {
    const conns = connections.get(roomName) || [];
    const index = conns.indexOf(conn);
    if (index !== -1) {
      conns.splice(index, 1);
    }
    console.log(`Client disconnected from room: ${roomName} (${conns.length} clients remaining)`);
    
    // Clean up empty rooms
    if (conns.length === 0) {
      connections.delete(roomName);
      docs.delete(roomName);
      console.log(`Room ${roomName} cleaned up`);
    }
  });
  
  conn.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT);

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    server.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);


