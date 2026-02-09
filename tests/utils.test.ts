import { describe, it, expect } from 'vitest';
import { extractTitleFromProsemirrorJSON } from '@/lib/utils';

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
    it('returns "Untitled" when first node is a paragraph', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Just a paragraph' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Untitled');
    });

    it('returns "Untitled" when first node is a code block', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'code_block',
            content: [{ type: 'text', text: 'code here' }],
          },
        ],
      };
      expect(extractTitleFromProsemirrorJSON(json)).toBe('Untitled');
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
