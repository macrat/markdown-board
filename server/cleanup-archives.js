#!/usr/bin/env node

/**
 * Periodic cleanup of archived pages older than 30 days.
 * Designed to be started from the WebSocket server process.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Delete archived pages older than 30 days from the given database.
 * @param {import('better-sqlite3').Database} db
 * @returns {number} Number of deleted rows
 */
function cleanupOldArchives(db) {
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;
  const stmt = db.prepare(
    'DELETE FROM pages WHERE archived_at IS NOT NULL AND archived_at < ?',
  );
  const result = stmt.run(thirtyDaysAgo);
  return result.changes;
}

/**
 * Open the application database.
 * @returns {import('better-sqlite3').Database}
 */
function openDb() {
  const dbDir = path.join(process.cwd(), 'data');
  const dbPath = path.join(dbDir, 'markdown-board.db');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Run a single cleanup cycle: open DB, delete old archives, close DB.
 * Errors are caught and logged without crashing the process.
 */
function runCleanupCycle() {
  let db;
  try {
    db = openDb();
    const deleted = cleanupOldArchives(db);
    if (deleted > 0) {
      console.log(
        `[cleanup] Deleted ${deleted} archived page(s) older than 30 days`,
      );
    } else {
      console.log('[cleanup] No old archived pages to delete');
    }
  } catch (error) {
    console.error('[cleanup] Failed to clean up old archives:', error);
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore close errors
      }
    }
  }
}

/**
 * Start the periodic cleanup task.
 * Runs immediately on start and then every hour.
 * @returns {NodeJS.Timeout} The interval ID (for stopping in tests or shutdown)
 */
function startPeriodicCleanup() {
  console.log('[cleanup] Starting periodic archive cleanup (every 1 hour)');
  runCleanupCycle();
  return setInterval(runCleanupCycle, ONE_HOUR_MS);
}

module.exports = {
  cleanupOldArchives,
  startPeriodicCleanup,
  // Exported for testing
  THIRTY_DAYS_MS,
  ONE_HOUR_MS,
};
