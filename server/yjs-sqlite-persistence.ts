/**
 * Yjs SQLite persistence layer.
 * Stores incremental Yjs updates in yjs_updates table and supports
 * compaction (merging all updates into a single row).
 */

import type Database from 'better-sqlite3';
import * as Y from 'yjs';

/**
 * Ensure the yjs_updates table exists in the given database.
 */
export function ensureTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yjs_updates (
      doc_name TEXT NOT NULL,
      clock INTEGER NOT NULL,
      value BLOB NOT NULL,
      PRIMARY KEY (doc_name, clock)
    );
  `);
}

export class YjsSqlitePersistence {
  private db: Database.Database;
  private _storeStmt: Database.Statement;
  private _getStmt: Database.Statement;
  private _maxClockStmt: Database.Statement;
  private _deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
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
   */
  storeUpdate(docName: string, update: Uint8Array): void {
    const row = this._maxClockStmt.get(docName) as
      | {
          max_clock: number | null;
        }
      | undefined;
    const nextClock = row && row.max_clock !== null ? row.max_clock + 1 : 0;
    this._storeStmt.run(docName, nextClock, Buffer.from(update));
  }

  /**
   * Load all stored updates into a Y.Doc and return it.
   */
  getYDoc(docName: string): Y.Doc {
    const doc = new Y.Doc();
    const rows = this._getStmt.all(docName) as { value: Buffer }[];
    for (const row of rows) {
      Y.applyUpdate(doc, row.value);
    }
    return doc;
  }

  /**
   * Compact all updates for a document into a single merged update.
   * Runs inside a transaction (DELETE all + INSERT merged).
   */
  compactDocument(docName: string): void {
    const rows = this._getStmt.all(docName) as { value: Buffer }[];
    if (rows.length <= 1) return;

    const updates = rows.map((row) => row.value);

    let merged: Uint8Array;
    try {
      merged = Y.mergeUpdates(updates);
    } catch (error) {
      console.error(
        `[yjs-persistence] Failed to merge updates for "${docName}":`,
        error,
      );
      // Keep existing data as-is — the safest approach on corruption.
      // getYDoc applies updates individually, so reads are unaffected.
      // Compaction is an optimization; failure causes no functional issue.
      return;
    }

    const compact = this.db.transaction(() => {
      this._deleteStmt.run(docName);
      this._storeStmt.run(docName, 0, Buffer.from(merged));
    });
    compact();
  }

  /**
   * Delete all stored updates for a document.
   */
  clearDocument(docName: string): void {
    this._deleteStmt.run(docName);
  }
}
