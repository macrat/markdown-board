const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'markdown-board.db');

/**
 * Open a new database connection with standard configuration.
 * Creates the data directory if it does not exist.
 * @returns {import('better-sqlite3').Database}
 */
function openDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

module.exports = { DB_DIR, DB_PATH, openDatabase };
