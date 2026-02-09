/**
 * Yjs SQLite persistence layer.
 * Stores incremental Yjs updates in yjs_updates table and supports
 * compaction (merging all updates into a single row).
 */

const Y = require('yjs');

/**
 * Ensure the yjs_updates table exists in the given database.
 * @param {import('better-sqlite3').Database} db
 */
function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yjs_updates (
      doc_name TEXT NOT NULL,
      clock INTEGER NOT NULL,
      value BLOB NOT NULL,
      PRIMARY KEY (doc_name, clock)
    );
  `);
}

class YjsSqlitePersistence {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db;
    ensureTable(db);
    this._storeStmt = db.prepare(
      'INSERT INTO yjs_updates (doc_name, clock, value) VALUES (?, ?, ?)',
    );
    this._getStmt = db.prepare(
      'SELECT value FROM yjs_updates WHERE doc_name = ? ORDER BY clock ASC',
    );
    this._maxClockStmt = db.prepare(
      'SELECT MAX(clock) as max_clock FROM yjs_updates WHERE doc_name = ?',
    );
    this._deleteStmt = db.prepare('DELETE FROM yjs_updates WHERE doc_name = ?');
  }

  /**
   * Store a Yjs update for the given document.
   * @param {string} docName
   * @param {Uint8Array} update
   */
  storeUpdate(docName, update) {
    const row = this._maxClockStmt.get(docName);
    const nextClock = row && row.max_clock !== null ? row.max_clock + 1 : 0;
    this._storeStmt.run(docName, nextClock, Buffer.from(update));
  }

  /**
   * Load all stored updates into a Y.Doc and return it.
   * @param {string} docName
   * @returns {Y.Doc}
   */
  getYDoc(docName) {
    const doc = new Y.Doc();
    const rows = this._getStmt.all(docName);
    for (const row of rows) {
      Y.applyUpdate(doc, row.value);
    }
    return doc;
  }

  /**
   * Compact all updates for a document into a single merged update.
   * Runs inside a transaction (DELETE all + INSERT merged).
   * @param {string} docName
   */
  compactDocument(docName) {
    const rows = this._getStmt.all(docName);
    if (rows.length <= 1) return;

    const updates = rows.map((row) => row.value);
    const merged = Y.mergeUpdates(updates);

    const compact = this.db.transaction(() => {
      this._deleteStmt.run(docName);
      this._storeStmt.run(docName, 0, Buffer.from(merged));
    });
    compact();
  }

  /**
   * Delete all stored updates for a document.
   * @param {string} docName
   */
  clearDocument(docName) {
    this._deleteStmt.run(docName);
  }
}

module.exports = { YjsSqlitePersistence, ensureTable };
