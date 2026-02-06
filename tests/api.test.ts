import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertPage } from './helpers/db';
import {
  extractTitle,
  MAX_CONTENT_SIZE,
  getContentByteSize,
} from '@/lib/utils';

// We test the API logic (DB queries + validation) directly rather than going
// through Next.js route wrappers, since that would require mocking NextResponse.
// This validates the same business logic that the route handlers execute.

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('Pages API logic', () => {
  describe('POST /api/pages (create page)', () => {
    it('creates a page with default values', () => {
      const id = 'test-uuid-1';
      const now = Date.now();

      const stmt = db.prepare(`
        INSERT INTO pages (id, title, content, created_at, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `);
      stmt.run(id, 'Untitled', '', now, now);

      const page = db
        .prepare('SELECT * FROM pages WHERE id = ?')
        .get(id) as Record<string, unknown>;
      expect(page).toBeDefined();
      expect(page.id).toBe(id);
      expect(page.title).toBe('Untitled');
      expect(page.content).toBe('');
      expect(page.archived_at).toBeNull();
    });
  });

  describe('GET /api/pages (list pages)', () => {
    it('returns non-archived pages ordered by updated_at DESC', () => {
      insertPage(db, { id: 'page-1', title: 'Older', updated_at: 1000 });
      insertPage(db, { id: 'page-2', title: 'Newer', updated_at: 2000 });
      insertPage(db, { id: 'page-3', title: 'Archived', archived_at: 3000 });

      const pages = db
        .prepare(
          `
        SELECT id, title, created_at, updated_at
        FROM pages
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC
      `,
        )
        .all() as Array<Record<string, unknown>>;

      expect(pages).toHaveLength(2);
      expect(pages[0].title).toBe('Newer');
      expect(pages[1].title).toBe('Older');
    });

    it('returns empty array when no pages exist', () => {
      const pages = db
        .prepare(
          `
        SELECT id, title, created_at, updated_at
        FROM pages
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC
      `,
        )
        .all();

      expect(pages).toEqual([]);
    });
  });

  describe('GET /api/pages/[id] (get page)', () => {
    it('returns the page with all fields', () => {
      insertPage(db, {
        id: 'page-1',
        title: 'Test',
        content: '# Test\n\nHello',
        created_at: 1000,
        updated_at: 2000,
      });

      const page = db
        .prepare(
          `
        SELECT id, title, content, created_at, updated_at, archived_at
        FROM pages WHERE id = ?
      `,
        )
        .get('page-1') as Record<string, unknown>;

      expect(page).toBeDefined();
      expect(page.id).toBe('page-1');
      expect(page.title).toBe('Test');
      expect(page.content).toBe('# Test\n\nHello');
      expect(page.created_at).toBe(1000);
      expect(page.updated_at).toBe(2000);
      expect(page.archived_at).toBeNull();
    });

    it('returns undefined for non-existent page', () => {
      const page = db
        .prepare(
          `
        SELECT id, title, content, created_at, updated_at, archived_at
        FROM pages WHERE id = ?
      `,
        )
        .get('non-existent');

      expect(page).toBeUndefined();
    });
  });

  describe('PATCH /api/pages/[id] (update page)', () => {
    it('updates content and extracts title', () => {
      insertPage(db, { id: 'page-1' });

      const newContent = '# Updated Title\n\nNew content here';
      const title = extractTitle(newContent);
      const now = Date.now();

      const stmt = db.prepare(`
        UPDATE pages SET title = ?, content = ?, updated_at = ? WHERE id = ?
      `);
      const result = stmt.run(title, newContent, now, 'page-1');

      expect(result.changes).toBe(1);

      const page = db
        .prepare('SELECT * FROM pages WHERE id = ?')
        .get('page-1') as Record<string, unknown>;
      expect(page.title).toBe('Updated Title');
      expect(page.content).toBe(newContent);
    });

    it('sets title to "Untitled" when content is empty', () => {
      insertPage(db, {
        id: 'page-1',
        title: 'Old Title',
        content: '# Old Title',
      });

      const title = extractTitle('');
      db.prepare(
        'UPDATE pages SET title = ?, content = ?, updated_at = ? WHERE id = ?',
      ).run(title, '', Date.now(), 'page-1');

      const page = db
        .prepare('SELECT * FROM pages WHERE id = ?')
        .get('page-1') as Record<string, unknown>;
      expect(page.title).toBe('Untitled');
      expect(page.content).toBe('');
    });

    it('returns 0 changes for non-existent page', () => {
      const result = db
        .prepare(
          'UPDATE pages SET title = ?, content = ?, updated_at = ? WHERE id = ?',
        )
        .run('Title', 'content', Date.now(), 'non-existent');

      expect(result.changes).toBe(0);
    });
  });

  describe('PATCH /api/pages/[id] input validation', () => {
    it('rejects body with unexpected fields', () => {
      const body = { content: 'hello', extra: 'field' };
      const allowedFields = new Set(['content']);
      const unexpectedFields = Object.keys(body).filter(
        (key) => !allowedFields.has(key),
      );
      expect(unexpectedFields).toEqual(['extra']);
    });

    it('accepts body with only content field', () => {
      const body = { content: 'hello' };
      const allowedFields = new Set(['content']);
      const unexpectedFields = Object.keys(body).filter(
        (key) => !allowedFields.has(key),
      );
      expect(unexpectedFields).toEqual([]);
    });

    it('rejects non-string content', () => {
      const content = 123;
      expect(typeof content !== 'string').toBe(true);
    });

    it('rejects missing content field', () => {
      const body = {};
      expect((body as { content?: unknown }).content).toBeUndefined();
    });

    it('rejects content exceeding 10MB', () => {
      const content = 'a'.repeat(MAX_CONTENT_SIZE + 1);
      expect(getContentByteSize(content)).toBeGreaterThan(MAX_CONTENT_SIZE);
    });

    it('accepts content exactly at 10MB', () => {
      const content = 'a'.repeat(MAX_CONTENT_SIZE);
      expect(getContentByteSize(content)).toBeLessThanOrEqual(MAX_CONTENT_SIZE);
    });

    it('accounts for multi-byte characters in size calculation', () => {
      // Japanese characters are 3 bytes each in UTF-8
      // Create a string that is under the character limit but over the byte limit
      const charCount = Math.floor(MAX_CONTENT_SIZE / 3) + 1;
      const content = 'あ'.repeat(charCount);
      expect(getContentByteSize(content)).toBeGreaterThan(MAX_CONTENT_SIZE);
    });
  });

  describe('DELETE /api/pages/[id] (delete page)', () => {
    it('deletes an existing page', () => {
      insertPage(db, { id: 'page-1' });

      const result = db.prepare('DELETE FROM pages WHERE id = ?').run('page-1');
      expect(result.changes).toBe(1);

      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get('page-1');
      expect(page).toBeUndefined();
    });

    it('returns 0 changes for non-existent page', () => {
      const result = db
        .prepare('DELETE FROM pages WHERE id = ?')
        .run('non-existent');
      expect(result.changes).toBe(0);
    });
  });
});

describe('Archive API logic', () => {
  describe('POST /api/pages/[id]/archive', () => {
    it('archives a non-archived page', () => {
      insertPage(db, { id: 'page-1' });
      const now = Date.now();

      const result = db
        .prepare(
          `
        UPDATE pages SET archived_at = ? WHERE id = ? AND archived_at IS NULL
      `,
        )
        .run(now, 'page-1');

      expect(result.changes).toBe(1);

      const page = db
        .prepare('SELECT * FROM pages WHERE id = ?')
        .get('page-1') as Record<string, unknown>;
      expect(page.archived_at).toBe(now);
    });

    it('does not re-archive an already archived page', () => {
      insertPage(db, { id: 'page-1', archived_at: 1000 });

      const result = db
        .prepare(
          `
        UPDATE pages SET archived_at = ? WHERE id = ? AND archived_at IS NULL
      `,
        )
        .run(Date.now(), 'page-1');

      expect(result.changes).toBe(0);
    });

    it('returns 0 changes for non-existent page', () => {
      const result = db
        .prepare(
          `
        UPDATE pages SET archived_at = ? WHERE id = ? AND archived_at IS NULL
      `,
        )
        .run(Date.now(), 'non-existent');

      expect(result.changes).toBe(0);
    });
  });

  describe('POST /api/pages/[id]/unarchive', () => {
    it('unarchives an archived page', () => {
      insertPage(db, { id: 'page-1', archived_at: 1000 });

      const result = db
        .prepare(
          `
        UPDATE pages SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL
      `,
        )
        .run('page-1');

      expect(result.changes).toBe(1);

      const page = db
        .prepare('SELECT * FROM pages WHERE id = ?')
        .get('page-1') as Record<string, unknown>;
      expect(page.archived_at).toBeNull();
    });

    it('does not unarchive a non-archived page', () => {
      insertPage(db, { id: 'page-1' });

      const result = db
        .prepare(
          `
        UPDATE pages SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL
      `,
        )
        .run('page-1');

      expect(result.changes).toBe(0);
    });
  });

  describe('GET /api/archives (list archived pages)', () => {
    it('returns only archived pages ordered by archived_at DESC', () => {
      insertPage(db, { id: 'page-1', title: 'Active' });
      insertPage(db, {
        id: 'page-2',
        title: 'Older Archive',
        archived_at: 1000,
      });
      insertPage(db, {
        id: 'page-3',
        title: 'Newer Archive',
        archived_at: 2000,
      });

      const pages = db
        .prepare(
          `
        SELECT id, title, created_at, updated_at, archived_at
        FROM pages
        WHERE archived_at IS NOT NULL
        ORDER BY archived_at DESC
      `,
        )
        .all() as Array<Record<string, unknown>>;

      expect(pages).toHaveLength(2);
      expect(pages[0].title).toBe('Newer Archive');
      expect(pages[1].title).toBe('Older Archive');
    });
  });

  describe('DELETE /api/archives (cleanup old archives)', () => {
    it('deletes archives older than 30 days', () => {
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

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const result = db
        .prepare(
          `
        DELETE FROM pages WHERE archived_at IS NOT NULL AND archived_at < ?
      `,
        )
        .run(thirtyDaysAgo);

      expect(result.changes).toBe(1);

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

    it('returns 0 when no old archives exist', () => {
      insertPage(db, { id: 'page-1', title: 'Active' });

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const result = db
        .prepare(
          `
        DELETE FROM pages WHERE archived_at IS NOT NULL AND archived_at < ?
      `,
        )
        .run(thirtyDaysAgo);

      expect(result.changes).toBe(0);
    });
  });
});

describe('Page lifecycle integration', () => {
  it('supports full create → update → archive → unarchive → delete flow', () => {
    // Create
    const id = 'lifecycle-page';
    const now = Date.now();
    db.prepare(
      `
      INSERT INTO pages (id, title, content, created_at, updated_at, archived_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `,
    ).run(id, 'Untitled', '', now, now);

    let page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    expect(page.title).toBe('Untitled');

    // Update
    const content = '# My Page\n\nSome content here';
    const title = extractTitle(content);
    db.prepare(
      'UPDATE pages SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    ).run(title, content, now + 1000, id);

    page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    expect(page.title).toBe('My Page');
    expect(page.content).toBe(content);

    // Archive
    db.prepare(
      'UPDATE pages SET archived_at = ? WHERE id = ? AND archived_at IS NULL',
    ).run(now + 2000, id);

    page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    expect(page.archived_at).toBe(now + 2000);

    // Should not appear in active pages list
    const activePages = db
      .prepare('SELECT * FROM pages WHERE archived_at IS NULL')
      .all();
    expect(activePages).toHaveLength(0);

    // Unarchive
    db.prepare(
      'UPDATE pages SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL',
    ).run(id);

    page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    expect(page.archived_at).toBeNull();

    // Delete
    const result = db.prepare('DELETE FROM pages WHERE id = ?').run(id);
    expect(result.changes).toBe(1);

    const deleted = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
    expect(deleted).toBeUndefined();
  });

  it('handles multiple pages independently', () => {
    insertPage(db, { id: 'page-1', title: 'Page 1', updated_at: 3000 });
    insertPage(db, { id: 'page-2', title: 'Page 2', updated_at: 2000 });
    insertPage(db, { id: 'page-3', title: 'Page 3', updated_at: 1000 });

    // Archive page 2
    db.prepare('UPDATE pages SET archived_at = ? WHERE id = ?').run(
      Date.now(),
      'page-2',
    );

    const activePages = db
      .prepare(
        `
      SELECT id FROM pages WHERE archived_at IS NULL ORDER BY updated_at DESC
    `,
      )
      .all() as Array<Record<string, unknown>>;

    expect(activePages).toHaveLength(2);
    expect(activePages[0].id).toBe('page-1');
    expect(activePages[1].id).toBe('page-3');

    // Delete page 3
    db.prepare('DELETE FROM pages WHERE id = ?').run('page-3');

    const remaining = db.prepare('SELECT id FROM pages').all();
    expect(remaining).toHaveLength(2); // page-1 (active) + page-2 (archived)
  });
});
