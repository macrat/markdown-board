import { describe, it, expect } from 'vitest';
import {
  extractTitleFromProsemirrorJSON,
  formatRelativeTime,
} from '@/lib/utils';

describe('extractTitleFromProsemirrorJSON', () => {
  describe('empty/missing content', () => {
    it('returns "Untitled" for empty doc (no content)', () => {
      expect(
        extractTitleFromProsemirrorJSON({ type: 'doc', content: [] }),
      ).toBe('Untitled');
    });

    it('returns "Untitled" for doc without content array', () => {
      expect(extractTitleFromProsemirrorJSON({ type: 'doc' })).toBe('Untitled');
    });

    it('returns "Untitled" for null-like input', () => {
      expect(
        extractTitleFromProsemirrorJSON(
          null as unknown as Record<string, unknown>,
        ),
      ).toBe('Untitled');
    });
  });

  describe('heading nodes', () => {
    it('extracts title from h1 heading', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Title' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('My Title');
    });

    it('extracts title from h2 heading', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Second Level' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Second Level');
    });

    it('concatenates multiple text nodes within heading', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'World' },
            ],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Hello World');
    });

    it('only uses the first node for title extraction', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'First' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Second' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('First');
    });

    it('returns "Untitled" for heading with no text content', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Untitled');
    });

    it('returns "Untitled" for heading with whitespace-only text', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '   ' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Untitled');
    });
  });

  describe('non-heading first node', () => {
    it('extracts title from paragraph', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Just a paragraph' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Just a paragraph');
    });

    it('extracts title from code block', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'code_block',
            content: [{ type: 'text', text: 'code here' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('code here');
    });
  });

  describe('special characters', () => {
    it('handles unicode characters', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'こんにちは世界' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('こんにちは世界');
    });

    it('handles emoji', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '🌍 Hello World' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('🌍 Hello World');
    });
  });
});

describe('formatRelativeTime', () => {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const now = new Date('2026-02-09T12:00:00').getTime();

  it('returns "たった今" for future timestamps', () => {
    expect(formatRelativeTime(now + 1, now)).toBe('たった今');
    expect(formatRelativeTime(now + 5 * MINUTE, now)).toBe('たった今');
    expect(formatRelativeTime(now + DAY, now)).toBe('たった今');
  });

  it('returns "たった今" for less than 1 minute ago', () => {
    expect(formatRelativeTime(now, now)).toBe('たった今');
    expect(formatRelativeTime(now - 30_000, now)).toBe('たった今');
    expect(formatRelativeTime(now - 59_999, now)).toBe('たった今');
  });

  it('returns "◯分前" for 1-59 minutes ago', () => {
    expect(formatRelativeTime(now - MINUTE, now)).toBe('1分前');
    expect(formatRelativeTime(now - 5 * MINUTE, now)).toBe('5分前');
    expect(formatRelativeTime(now - 30 * MINUTE, now)).toBe('30分前');
    expect(formatRelativeTime(now - 59 * MINUTE, now)).toBe('59分前');
  });

  it('returns "◯時間前" for 1-23 hours ago', () => {
    expect(formatRelativeTime(now - HOUR, now)).toBe('1時間前');
    expect(formatRelativeTime(now - 3 * HOUR, now)).toBe('3時間前');
    expect(formatRelativeTime(now - 12 * HOUR, now)).toBe('12時間前');
    expect(formatRelativeTime(now - 23 * HOUR, now)).toBe('23時間前');
  });

  it('returns date format for 24+ hours ago', () => {
    expect(formatRelativeTime(now - DAY, now)).toBe('2月8日');
    expect(formatRelativeTime(now - 7 * DAY, now)).toBe('2月2日');
  });

  it('handles year boundary correctly', () => {
    const jan1 = new Date('2026-01-01T12:00:00').getTime();
    expect(formatRelativeTime(jan1 - 2 * DAY, jan1)).toBe('2025年12月30日');
  });
});
