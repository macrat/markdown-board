/**
 * Periodic cleanup of archived pages older than 30 days.
 * Designed to be started from the WebSocket server process.
 */

import type Database from 'better-sqlite3';

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Delete archived pages older than 30 days from the given database,
 * including their associated yjs_updates records.
 */
export function cleanupOldArchives(db: Database.Database): number {
  const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;

  // Find pages to delete first, then delete yjs_updates and pages in a transaction
  const deleteOldArchives = db.transaction(() => {
    const pages = db
      .prepare(
        'SELECT id FROM pages WHERE archived_at IS NOT NULL AND archived_at < ?',
      )
      .all(thirtyDaysAgo) as { id: string }[];

    if (pages.length === 0) return 0;

    const deleteYjs = db.prepare('DELETE FROM yjs_updates WHERE doc_name = ?');
    for (const page of pages) {
      deleteYjs.run(page.id);
    }

    const result = db
      .prepare(
        'DELETE FROM pages WHERE archived_at IS NOT NULL AND archived_at < ?',
      )
      .run(thirtyDaysAgo);
    return result.changes;
  });

  return deleteOldArchives();
}

/**
 * Run a single cleanup cycle using the provided DB factory.
 * Opens a connection, runs cleanup, then closes the connection.
 * Errors are caught and logged without crashing the process.
 */
export function runCleanupCycle(openDb: () => Database.Database): void {
  let db: Database.Database | undefined;
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
 */
export function startPeriodicCleanup(
  openDb: () => Database.Database,
): NodeJS.Timeout {
  console.log('[cleanup] Starting periodic archive cleanup (every 1 hour)');
  runCleanupCycle(openDb);
  return setInterval(() => runCleanupCycle(openDb), ONE_HOUR_MS);
}
