import Database from 'better-sqlite3';

export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
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
  return db;
}

export function insertPage(
  db: Database.Database,
  page: {
    id: string;
    title?: string;
    created_at?: number;
    updated_at?: number;
    archived_at?: number | null;
  },
) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO pages (id, title, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    page.id,
    page.title ?? 'Untitled',
    page.created_at ?? now,
    page.updated_at ?? now,
    page.archived_at ?? null,
  );
}
