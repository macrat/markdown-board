#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaborative editing
 * Simple relay server that broadcasts all messages to other clients in the same room
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.WS_PORT || 1234;

// Store connections for each room
const rooms = new Map();

const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (conn, req) => {
  const roomName = req.url?.slice(1) || 'default';
  
  // Add connection to room
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(conn);
  
  console.log(`Client connected to room: ${roomName} (${rooms.get(roomName).size} clients)`);
  
  // Store room name on connection for cleanup
  conn.roomName = roomName;
  
  conn.on('message', (message) => {
    // Broadcast message to all other clients in the same room
    const roomConnections = rooms.get(roomName);
    if (roomConnections) {
      roomConnections.forEach((client) => {
        if (client !== conn && client.readyState === WebSocket.OPEN) {
          client.send(message, { binary: true });
        }
      });
    }
  });
  
  conn.on('close', () => {
    const roomConnections = rooms.get(roomName);
    if (roomConnections) {
      roomConnections.delete(conn);
      console.log(`Client disconnected from room: ${roomName} (${roomConnections.size} clients remaining)`);
      
      // Clean up empty rooms
      if (roomConnections.size === 0) {
        rooms.delete(roomName);
        console.log(`Room ${roomName} cleaned up`);
      }
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


