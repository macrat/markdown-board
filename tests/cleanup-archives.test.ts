import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertPage } from './helpers/db';

const {
  cleanupOldArchives,
  runCleanupCycle,
  startPeriodicCleanup,
  THIRTY_DAYS_MS,
} = require('../server/cleanup-archives'); // eslint-disable-line @typescript-eslint/no-require-imports

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('cleanupOldArchives', () => {
  it('deletes archived pages older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    insertPage(db, {
      id: 'old-archive',
      title: 'Old',
      archived_at: thirtyOneDaysAgo,
    });
    insertPage(db, {
      id: 'recent-archive',
      title: 'Recent',
      archived_at: tenDaysAgo,
    });
    insertPage(db, { id: 'active-page', title: 'Active' });

    const deleted = cleanupOldArchives(db);

    expect(deleted).toBe(1);

    // Recent archive should still exist
    const recent = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get('recent-archive');
    expect(recent).toBeDefined();

    // Active page should still exist
    const active = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get('active-page');
    expect(active).toBeDefined();

    // Old archive should be deleted
    const old = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get('old-archive');
    expect(old).toBeUndefined();
  });

  it('deletes multiple old archives at once', () => {
    const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const fiftyDaysAgo = Date.now() - 50 * 24 * 60 * 60 * 1000;

    insertPage(db, {
      id: 'old-1',
      title: 'Old 1',
      archived_at: fortyDaysAgo,
    });
    insertPage(db, {
      id: 'old-2',
      title: 'Old 2',
      archived_at: fiftyDaysAgo,
    });

    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(2);

    const remaining = db.prepare('SELECT * FROM pages').all();
    expect(remaining).toHaveLength(0);
  });

  it('returns 0 when no old archives exist', () => {
    insertPage(db, { id: 'active', title: 'Active' });

    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(0);
  });

  it('returns 0 when database is empty', () => {
    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(0);
  });

  it('does not delete archives exactly at the 30-day boundary', () => {
    const exactlyThirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;

    insertPage(db, {
      id: 'boundary-archive',
      title: 'Boundary',
      archived_at: exactlyThirtyDaysAgo,
    });

    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(0);

    const page = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get('boundary-archive');
    expect(page).toBeDefined();
  });

  it('does not affect non-archived pages regardless of age', () => {
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

    insertPage(db, {
      id: 'old-active',
      title: 'Old Active',
      created_at: sixtyDaysAgo,
      updated_at: sixtyDaysAgo,
    });

    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(0);

    const page = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get('old-active');
    expect(page).toBeDefined();
  });

  it('also deletes associated yjs_updates records', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

    insertPage(db, {
      id: 'old-archive',
      title: 'Old',
      archived_at: thirtyOneDaysAgo,
    });

    // Add yjs_updates for the page
    db.prepare(
      'INSERT INTO yjs_updates (doc_name, clock, value) VALUES (?, ?, ?)',
    ).run('old-archive', 0, Buffer.from([0, 0]));
    db.prepare(
      'INSERT INTO yjs_updates (doc_name, clock, value) VALUES (?, ?, ?)',
    ).run('old-archive', 1, Buffer.from([1, 1]));

    // Also add yjs_updates for a page that should NOT be deleted
    insertPage(db, { id: 'active-page', title: 'Active' });
    db.prepare(
      'INSERT INTO yjs_updates (doc_name, clock, value) VALUES (?, ?, ?)',
    ).run('active-page', 0, Buffer.from([2, 2]));

    const deleted = cleanupOldArchives(db);
    expect(deleted).toBe(1);

    // yjs_updates for old archive should be gone
    const oldUpdates = db
      .prepare('SELECT * FROM yjs_updates WHERE doc_name = ?')
      .all('old-archive');
    expect(oldUpdates).toHaveLength(0);

    // yjs_updates for active page should remain
    const activeUpdates = db
      .prepare('SELECT * FROM yjs_updates WHERE doc_name = ?')
      .all('active-page');
    expect(activeUpdates).toHaveLength(1);
  });
});

describe('runCleanupCycle', () => {
  it('logs deletion count when old archives are deleted', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    insertPage(db, {
      id: 'old-archive',
      title: 'Old',
      archived_at: thirtyOneDaysAgo,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runCleanupCycle(() => db);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[cleanup] Deleted 1 archived page(s) older than 30 days',
    );
    consoleSpy.mockRestore();
  });

  it('logs message when no old archives exist', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runCleanupCycle(() => db);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[cleanup] No old archived pages to delete',
    );
    consoleSpy.mockRestore();
  });

  it('catches and logs errors without crashing', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const brokenFactory = () => {
      throw new Error('DB connection failed');
    };

    expect(() => runCleanupCycle(brokenFactory)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[cleanup] Failed to clean up old archives:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('startPeriodicCleanup', () => {
  it('runs cleanup immediately and sets up interval', () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const intervalId = startPeriodicCleanup(() => createTestDb());

    expect(consoleSpy).toHaveBeenCalledWith(
      '[cleanup] Starting periodic archive cleanup (every 1 hour)',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[cleanup] No old archived pages to delete',
    );

    clearInterval(intervalId);
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('runs cleanup again after one hour', () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Factory creates a fresh DB each cycle (runCleanupCycle closes it after use)
    const intervalId = startPeriodicCleanup(() => createTestDb());
    consoleSpy.mockClear();

    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[cleanup] No old archived pages to delete',
    );

    clearInterval(intervalId);
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });
});
