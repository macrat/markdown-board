import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as Y from 'yjs';

const { YjsSqlitePersistence } = require('../server/yjs-sqlite-persistence'); // eslint-disable-line @typescript-eslint/no-require-imports

let db: Database.Database;
let persistence: InstanceType<typeof YjsSqlitePersistence>;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  persistence = new YjsSqlitePersistence(db);
});

describe('YjsSqlitePersistence', () => {
  it('round-trips a Y.Doc through storeUpdate and getYDoc', () => {
    // Create a doc with content
    const doc = new Y.Doc();
    const text = doc.getText('test');
    text.insert(0, 'Hello, World!');

    // Store the state as an update
    const update = Y.encodeStateAsUpdate(doc);
    persistence.storeUpdate('doc-1', update);

    // Load it back
    const loaded = persistence.getYDoc('doc-1');
    const loadedText = loaded.getText('test');
    expect(loadedText.toString()).toBe('Hello, World!');

    doc.destroy();
    loaded.destroy();
  });

  it('accumulates multiple updates', () => {
    const doc = new Y.Doc();
    const text = doc.getText('test');

    // Apply updates incrementally
    doc.on('update', (update: Uint8Array) => {
      persistence.storeUpdate('doc-1', update);
    });

    text.insert(0, 'Hello');
    text.insert(5, ' World');

    // Load and verify
    const loaded = persistence.getYDoc('doc-1');
    expect(loaded.getText('test').toString()).toBe('Hello World');

    doc.destroy();
    loaded.destroy();
  });

  it('compacts multiple updates into one', () => {
    const doc = new Y.Doc();
    const text = doc.getText('test');

    doc.on('update', (update: Uint8Array) => {
      persistence.storeUpdate('doc-1', update);
    });

    text.insert(0, 'A');
    text.insert(1, 'B');
    text.insert(2, 'C');

    // Should have 3 updates
    const beforeCompact = db
      .prepare('SELECT COUNT(*) as cnt FROM yjs_updates WHERE doc_name = ?')
      .get('doc-1') as { cnt: number };
    expect(beforeCompact.cnt).toBe(3);

    // Compact
    persistence.compactDocument('doc-1');

    // Should have 1 update after compaction
    const afterCompact = db
      .prepare('SELECT COUNT(*) as cnt FROM yjs_updates WHERE doc_name = ?')
      .get('doc-1') as { cnt: number };
    expect(afterCompact.cnt).toBe(1);

    // Content should still be the same
    const loaded = persistence.getYDoc('doc-1');
    expect(loaded.getText('test').toString()).toBe('ABC');

    doc.destroy();
    loaded.destroy();
  });

  it('compaction is a no-op for single update', () => {
    const doc = new Y.Doc();
    doc.getText('test').insert(0, 'Solo');

    persistence.storeUpdate('doc-1', Y.encodeStateAsUpdate(doc));
    persistence.compactDocument('doc-1');

    const count = db
      .prepare('SELECT COUNT(*) as cnt FROM yjs_updates WHERE doc_name = ?')
      .get('doc-1') as { cnt: number };
    expect(count.cnt).toBe(1);

    doc.destroy();
  });

  it('compaction is a no-op for zero updates', () => {
    persistence.compactDocument('non-existent');
    // Should not throw
  });

  it('clearDocument removes all updates', () => {
    const doc = new Y.Doc();
    doc.getText('test').insert(0, 'to be cleared');

    persistence.storeUpdate('doc-1', Y.encodeStateAsUpdate(doc));
    persistence.clearDocument('doc-1');

    const loaded = persistence.getYDoc('doc-1');
    expect(loaded.getText('test').toString()).toBe('');

    doc.destroy();
    loaded.destroy();
  });

  it('getYDoc returns empty doc for unknown document', () => {
    const loaded = persistence.getYDoc('unknown');
    expect(loaded.getText('test').toString()).toBe('');
    loaded.destroy();
  });

  it('isolates documents by name', () => {
    const doc1 = new Y.Doc();
    doc1.getText('test').insert(0, 'Doc 1');
    persistence.storeUpdate('doc-1', Y.encodeStateAsUpdate(doc1));

    const doc2 = new Y.Doc();
    doc2.getText('test').insert(0, 'Doc 2');
    persistence.storeUpdate('doc-2', Y.encodeStateAsUpdate(doc2));

    const loaded1 = persistence.getYDoc('doc-1');
    const loaded2 = persistence.getYDoc('doc-2');

    expect(loaded1.getText('test').toString()).toBe('Doc 1');
    expect(loaded2.getText('test').toString()).toBe('Doc 2');

    doc1.destroy();
    doc2.destroy();
    loaded1.destroy();
    loaded2.destroy();
  });
});
