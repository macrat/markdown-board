import type Database from 'better-sqlite3';
import { openDatabase } from '../server/db-config';

let _db: Database.Database | null = null;

export default function getDb(): Database.Database {
  if (_db) return _db;

  _db = openDatabase();

  // Initialize database schema
  _db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_pages_archived_at ON pages(archived_at);
    CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at);
    CREATE INDEX IF NOT EXISTS idx_pages_updated_at ON pages(updated_at);

    CREATE TABLE IF NOT EXISTS yjs_updates (
      doc_name TEXT NOT NULL,
      clock INTEGER NOT NULL,
      value BLOB NOT NULL,
      PRIMARY KEY (doc_name, clock)
    );
  `);

  // Migration: drop content column if it exists (from pre-Yjs schema)
  const hasContentColumn = _db
    .prepare(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('pages') WHERE name='content'",
    )
    .get() as { cnt: number };
  if (hasContentColumn.cnt > 0) {
    _db.exec('ALTER TABLE pages DROP COLUMN content');
  }

  return _db;
}
