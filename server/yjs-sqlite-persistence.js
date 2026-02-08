const Y = require('yjs');

/**
 * SQLite-based persistence for Yjs documents
 * Stores Yjs binary updates in SQLite database
 */
class SqlitePersistence {
  /**
   * @param {import('better-sqlite3').Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;
    this._initialize();
  }

  /**
   * Initialize database schema for Yjs persistence
   * @private
   */
  _initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS yjs_updates (
        doc_name TEXT NOT NULL,
        clock INTEGER NOT NULL,
        value BLOB NOT NULL,
        PRIMARY KEY (doc_name, clock)
      );
      CREATE INDEX IF NOT EXISTS idx_yjs_updates_doc_name ON yjs_updates(doc_name);
    `);
  }

  /**
   * Get a Yjs document from persistence
   * @param {string} docName - Document name/ID
   * @returns {Promise<Y.Doc>} - Restored Yjs document
   */
  async getYDoc(docName) {
    const ydoc = new Y.Doc();

    // Get all updates for this document
    const stmt = this.db.prepare(`
      SELECT value FROM yjs_updates
      WHERE doc_name = ?
      ORDER BY clock ASC
    `);

    const updates = stmt.all(docName);

    // Apply all updates to reconstruct the document
    updates.forEach((row) => {
      Y.applyUpdate(ydoc, row.value);
    });

    return ydoc;
  }

  /**
   * Store a Yjs update
   * @param {string} docName - Document name/ID
   * @param {Uint8Array} update - Binary update data
   */
  storeUpdate(docName, update) {
    // Get next clock value for this document
    const clockStmt = this.db.prepare(`
      SELECT COALESCE(MAX(clock), -1) + 1 as next_clock
      FROM yjs_updates
      WHERE doc_name = ?
    `);
    const { next_clock } = clockStmt.get(docName);

    // Store the update
    const insertStmt = this.db.prepare(`
      INSERT INTO yjs_updates (doc_name, clock, value)
      VALUES (?, ?, ?)
    `);
    insertStmt.run(docName, next_clock, Buffer.from(update));
  }

  /**
   * Clear all updates for a document (optional cleanup)
   * @param {string} docName - Document name/ID
   */
  clearDocument(docName) {
    const stmt = this.db.prepare(`
      DELETE FROM yjs_updates WHERE doc_name = ?
    `);
    stmt.run(docName);
  }
}

module.exports = { SqlitePersistence };
