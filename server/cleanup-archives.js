/**
 * Periodic cleanup of archived pages older than 30 days.
 * Designed to be started from the WebSocket server process.
 */

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
 * Run a single cleanup cycle using the provided DB factory.
 * Opens a connection, runs cleanup, then closes the connection.
 * Errors are caught and logged without crashing the process.
 * @param {() => import('better-sqlite3').Database} openDb - Factory function to open a database connection
 */
function runCleanupCycle(openDb) {
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
      } catch (closeError) {
        console.warn('[cleanup] Failed to close DB:', closeError);
      }
    }
  }
}

/**
 * Start the periodic cleanup task.
 * Runs immediately on start and then every hour.
 * @param {() => import('better-sqlite3').Database} openDb - Factory function to open a database connection
 * @returns {NodeJS.Timeout} The interval ID (for stopping in tests or shutdown)
 */
function startPeriodicCleanup(openDb) {
  console.log('[cleanup] Starting periodic archive cleanup (every 1 hour)');
  runCleanupCycle(openDb);
  return setInterval(() => runCleanupCycle(openDb), ONE_HOUR_MS);
}

module.exports = {
  cleanupOldArchives,
  startPeriodicCleanup,
  runCleanupCycle,
  THIRTY_DAYS_MS,
  ONE_HOUR_MS,
};
