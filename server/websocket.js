#!/usr/bin/env node

/**
 * WebSocket server for Yjs collaborative editing
 * Uses the official @y/websocket-server implementation
 * with SQLite-backed Yjs persistence and debounced title sync.
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
const { YjsSqlitePersistence } = require('./yjs-sqlite-persistence');
const { yDocToProsemirrorJSON } = require('y-prosemirror');
const { createDebouncer } = require('lib0/eventloop');
const { extractTitleFromProsemirrorJSON } = require('./extract-title');

const PORT = process.env.NEXT_PUBLIC_WS_PORT || 1234;
const TITLE_SYNC_DEBOUNCE_MS = 3000;
const TITLE_SYNC_MAX_WAIT_MS = 10000;

// Open a persistent DB connection for the WebSocket server process
const db = openDatabase();

// Ensure pages table exists (in case WS server starts before Next.js)
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    archived_at INTEGER
  );
`);

const persistence = new YjsSqlitePersistence(db);

// Per-document debouncer map for title sync
const titleDebouncers = new Map();

/**
 * Check if a ProseMirror JSON document is empty (no meaningful content).
 * @param {Record<string, unknown>} json - ProseMirror JSON
 * @returns {boolean}
 */
function isDocEmpty(json) {
  const content = json?.content;
  if (!content || content.length === 0) return true;

  function hasText(nodes) {
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string') {
        if (node.text.trim().length > 0) return true;
      }
      if (node.content && hasText(node.content)) return true;
    }
    return false;
  }

  for (const node of content) {
    if (node.content && hasText(node.content)) return false;
  }
  return true;
}

/**
 * Sync title and updated_at to pages table.
 */
function syncTitleToDb(docName, ydoc) {
  try {
    const json = yDocToProsemirrorJSON(ydoc, 'prosemirror');
    const title = extractTitleFromProsemirrorJSON(json);
    const now = Date.now();

    db.prepare('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      now,
      docName,
    );
  } catch (error) {
    console.error(`[persistence] Failed to sync title for ${docName}:`, error);
  }
}

// Configure Yjs persistence
setPersistence({
  bindState: async (docName, ydoc) => {
    // 1. Load stored updates from SQLite
    const persistedYdoc = persistence.getYDoc(docName);

    const currentState = Y.encodeStateAsUpdate(persistedYdoc);
    // Empty state is 2 bytes [0, 0]
    if (currentState.length > 2) {
      Y.applyUpdate(ydoc, currentState);
    }
    persistedYdoc.destroy();

    // 2. Store incremental updates
    ydoc.on('update', (update) => {
      persistence.storeUpdate(docName, update);
    });

    // 3. Debounced title sync
    const debounce = createDebouncer(
      TITLE_SYNC_DEBOUNCE_MS,
      TITLE_SYNC_MAX_WAIT_MS,
    );
    titleDebouncers.set(docName, debounce);

    ydoc.on('update', () => {
      debounce(() => {
        syncTitleToDb(docName, ydoc);
      });
    });

    console.log(`[persistence] Loaded state for room: ${docName}`);
  },

  writeState: async (docName, ydoc) => {
    // 1. Cancel pending debounced sync
    const debounce = titleDebouncers.get(docName);
    if (debounce) {
      debounce(null);
      titleDebouncers.delete(docName);
    }

    // 2. Check if the document is empty; if so, delete the page
    try {
      const json = yDocToProsemirrorJSON(ydoc, 'prosemirror');
      const title = extractTitleFromProsemirrorJSON(json);
      if (title === 'Untitled' && isDocEmpty(json)) {
        const deleteTransaction = db.transaction(() => {
          db.prepare('DELETE FROM yjs_updates WHERE doc_name = ?').run(docName);
          db.prepare('DELETE FROM pages WHERE id = ?').run(docName);
        });
        deleteTransaction();
        console.log(`[persistence] Deleted empty page: ${docName}`);
        return;
      }
    } catch (error) {
      console.error(
        `[persistence] Failed to check emptiness for ${docName}:`,
        error,
      );
    }

    // 3. Final title sync (immediate)
    syncTitleToDb(docName, ydoc);

    // 4. Compact stored updates
    persistence.compactDocument(docName);

    console.log(`[persistence] Wrote state for room: ${docName}`);
  },
});

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
