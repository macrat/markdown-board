import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, insertPage } from './helpers/db';
import { extractTitleFromProsemirrorJSON } from '@/lib/utils';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('Special character persistence in SQLite', () => {
  it('stores and retrieves ASCII special characters', () => {
    const title = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
    insertPage(db, { id: 'special-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('special-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves math symbols', () => {
    const title = '∑∏∫∂∞≈≠≤≥±×÷';
    insertPage(db, { id: 'math-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('math-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves arrow symbols', () => {
    const title = '←→↑↓↔↕⇐⇒⇑⇓';
    insertPage(db, { id: 'arrow-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('arrow-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves currency symbols', () => {
    const title = '$€£¥₹₽';
    insertPage(db, { id: 'currency-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('currency-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves emoji', () => {
    const title = '😀😃😄😁🎉🎊🎈🎁';
    insertPage(db, { id: 'emoji-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('emoji-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves Japanese text', () => {
    const title = 'こんにちは世界';
    insertPage(db, { id: 'ja-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('ja-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves Arabic text', () => {
    const title = 'مرحبا بالعالم';
    insertPage(db, { id: 'ar-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('ar-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves Hebrew text', () => {
    const title = 'שלום עולם';
    insertPage(db, { id: 'he-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('he-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves Chinese text', () => {
    const title = '你好世界';
    insertPage(db, { id: 'zh-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('zh-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves Russian text', () => {
    const title = 'Привет мир';
    insertPage(db, { id: 'ru-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('ru-1') as { title: string };

    expect(page.title).toBe(title);
  });

  it('stores and retrieves mixed script title', () => {
    const title = 'Hello 🌍 こんにちは 你好';
    insertPage(db, { id: 'mixed-1', title });

    const page = db
      .prepare('SELECT title FROM pages WHERE id = ?')
      .get('mixed-1') as { title: string };

    expect(page.title).toBe(title);
  });
});

describe('Title extraction with HTML-like content', () => {
  it('treats HTML-like tags as plain text in title', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Text with <div> and <script> tags' },
          ],
        },
      ],
    };

    expect(extractTitleFromProsemirrorJSON(json)).toBe(
      'Text with <div> and <script> tags',
    );
  });

  it('handles mixed HTML-like tags and emoji', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '<img> 🌍 Test' }],
        },
      ],
    };

    expect(extractTitleFromProsemirrorJSON(json)).toBe('<img> 🌍 Test');
  });
});
