import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

export const DB_DIR = path.join(process.cwd(), 'data');
export const DB_PATH = path.join(DB_DIR, 'markdown-board.db');

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
  db.pragma('foreign_keys = ON');
  return db;
}
