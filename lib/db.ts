const { openDatabase } = require('../server/db-config'); // eslint-disable-line @typescript-eslint/no-require-imports

const db = openDatabase();

// Initialize database schema
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
  CREATE INDEX IF NOT EXISTS idx_pages_updated_at ON pages(updated_at);
`);

export default db;
