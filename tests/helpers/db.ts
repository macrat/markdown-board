import Database from 'better-sqlite3';

export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_pages_archived_at ON pages(archived_at);
    CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at);
  `);
  return db;
}

export function insertPage(
  db: Database.Database,
  page: {
    id: string;
    title?: string;
    content?: string;
    created_at?: number;
    updated_at?: number;
    archived_at?: number | null;
  },
) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO pages (id, title, content, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    page.id,
    page.title ?? 'Untitled',
    page.content ?? '',
    page.created_at ?? now,
    page.updated_at ?? now,
    page.archived_at ?? null,
  );
}
