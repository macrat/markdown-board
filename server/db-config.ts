import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

export const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), 'data', 'markdown-board.db');
export const DB_DIR = path.dirname(DB_PATH);

/**
 * Open a new database connection with standard configuration.
 * Creates the data directory if it does not exist.
 */
export function openDatabase(): Database.Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}
