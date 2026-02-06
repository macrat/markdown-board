import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertPage } from './helpers/db';

const {
  cleanupOldArchives,
  THIRTY_DAYS_MS,
} = require('../server/cleanup-archives'); // eslint-disable-line @typescript-eslint/no-require-imports

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

afterEach(() => {
  db.close();
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
    // An archive exactly 30 days old should NOT be deleted
    // (the condition is archived_at < thirtyDaysAgo, meaning strictly older)
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
});

describe('startPeriodicCleanup', () => {
  it('runs cleanup immediately and sets up interval', () => {
    vi.useFakeTimers();

    // Mock the module to avoid actual DB access
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startPeriodicCleanup } = require('../server/cleanup-archives');
    const intervalId = startPeriodicCleanup();

    // Should have logged the startup message and a cleanup result
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[cleanup] Starting periodic archive cleanup'),
    );

    clearInterval(intervalId);
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });
});
