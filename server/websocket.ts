#!/usr/bin/env -S npx tsx

/**
 * WebSocket server for Yjs collaborative editing
 * Uses the official @y/websocket-server implementation
 * with SQLite-backed Yjs persistence and debounced title sync.
 */

import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';

// Import y-websocket server utilities
import {
  setupWSConnection,
  setPersistence,
  type WSSharedDoc,
} from '@y/websocket-server/utils';
import { startPeriodicCleanup } from './cleanup-archives';
import { openDatabase } from './db-config';
import { YjsSqlitePersistence } from './yjs-sqlite-persistence';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import { createDebouncer } from 'lib0/eventloop';
import { extractTitleFromProsemirrorJSON } from './extract-title';

// NEXT_PUBLIC_ prefix: single source of truth shared with the client (useCollabEditor.ts).
// A separate WS_PORT would risk port mismatch between client and server.
const PORT = process.env.NEXT_PUBLIC_WS_PORT || 1234;
const TITLE_SYNC_DEBOUNCE_MS = 3000;
const TITLE_SYNC_MAX_WAIT_MS = 10000;

// Open a persistent DB connection for the WebSocket server process
const db = openDatabase();

// Minimal schema duplicated from lib/db.ts because this process starts
// independently and may run before Next.js initializes its own DB connection.
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
type DebounceFn = (cb: (() => void) | null) => void;
const titleDebouncers = new Map<string, DebounceFn>();

// Strict local types for isDocEmpty/hasText traversal.
// extract-title.ts intentionally uses Record<string, unknown> to accept
// untyped output from yDocToProsemirrorJSON without casts at call sites.
interface ProseMirrorNode {
  type: string;
  text?: string;
  content?: ProseMirrorNode[];
}

interface ProseMirrorJSON {
  content?: ProseMirrorNode[];
}

function hasText(nodes: ProseMirrorNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      if (node.text.trim().length > 0) return true;
    }
    if (node.content && hasText(node.content)) return true;
  }
  return false;
}

function isDocEmpty(json: ProseMirrorJSON): boolean {
  const content = json?.content;
  if (!content || content.length === 0) return true;

  for (const node of content) {
    if (node.content && hasText(node.content)) return false;
  }
  return true;
}

/**
 * Sync title and updated_at to pages table.
 */
function syncTitleToDb(docName: string, ydoc: Y.Doc): void {
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
  provider: null,
  bindState: async (docName: string, ydoc: WSSharedDoc) => {
    // 1. Load stored updates from SQLite
    const persistedYdoc = persistence.getYDoc(docName);

    const currentState = Y.encodeStateAsUpdate(persistedYdoc);
    // Empty state is 2 bytes [0, 0]
    if (currentState.length > 2) {
      Y.applyUpdate(ydoc, currentState);
    }
    persistedYdoc.destroy();

    // 2. Store incremental updates
    ydoc.on('update', (update: Uint8Array) => {
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

  writeState: async (docName: string, ydoc: WSSharedDoc) => {
    // 1. Cancel pending debounced sync by replacing it with a no-op
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

const wss = new WebSocketServer({ server });

console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (conn, req) => {
  const roomName =
    new URL(req.url || '/', 'http://localhost').pathname.slice(1) || 'default';
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
