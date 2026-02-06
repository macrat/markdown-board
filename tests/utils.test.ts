import { describe, it, expect } from 'vitest';
import { extractTitle } from '@/lib/utils';

describe('extractTitle', () => {
  describe('empty/whitespace content', () => {
    it('returns "Untitled" for empty string', () => {
      expect(extractTitle('')).toBe('Untitled');
    });

    it('returns "Untitled" for whitespace-only content', () => {
      expect(extractTitle('   ')).toBe('Untitled');
    });

    it('returns "Untitled" for null-like falsy value', () => {
      expect(extractTitle(undefined as unknown as string)).toBe('Untitled');
    });

    it('returns "Untitled" when first line is empty and rest has content', () => {
      expect(extractTitle('\nSome content')).toBe('Untitled');
    });
  });

  describe('markdown headings', () => {
    it('extracts title from h1 heading', () => {
      expect(extractTitle('# My Heading Title')).toBe('My Heading Title');
    });

    it('extracts title from h2 heading', () => {
      expect(extractTitle('## Second Level')).toBe('Second Level');
    });

    it('extracts title from h3 heading', () => {
      expect(extractTitle('### Level 3 Heading')).toBe('Level 3 Heading');
    });

    it('extracts title from h4 heading', () => {
      expect(extractTitle('#### Level 4 Heading')).toBe('Level 4 Heading');
    });

    it('extracts title from h5 heading', () => {
      expect(extractTitle('##### Level 5 Heading')).toBe('Level 5 Heading');
    });

    it('extracts title from h6 heading', () => {
      expect(extractTitle('###### Level 6 Heading')).toBe('Level 6 Heading');
    });

    it('only uses the first line for title extraction', () => {
      expect(extractTitle('# First Heading\n## Second Heading')).toBe(
        'First Heading',
      );
    });

    it('returns "Untitled" for heading with only # and no text', () => {
      expect(extractTitle('#')).toBe('Untitled');
    });

    it('returns "Untitled" for heading with # and spaces only', () => {
      expect(extractTitle('#   ')).toBe('Untitled');
    });
  });

  describe('escaped headings', () => {
    it('preserves # symbol for escaped heading \\#', () => {
      expect(extractTitle('\\# hello')).toBe('# hello');
    });

    it('handles escaped heading with multiple #', () => {
      expect(extractTitle('\\## not a heading')).toBe('## not a heading');
    });

    it('returns "Untitled" for escaped heading with no text after', () => {
      expect(extractTitle('\\#')).toBe('#');
    });
  });

  describe('plain text', () => {
    it('returns the first line as title for plain text', () => {
      expect(extractTitle('Plain text title')).toBe('Plain text title');
    });

    it('returns first line when content has multiple lines', () => {
      expect(extractTitle('First line\nSecond line\nThird line')).toBe(
        'First line',
      );
    });

    it('trims whitespace from the first line', () => {
      expect(extractTitle('  Padded title  ')).toBe('Padded title');
    });
  });

  describe('special characters', () => {
    it('handles unicode characters', () => {
      expect(extractTitle('# こんにちは世界')).toBe('こんにちは世界');
    });

    it('handles emoji', () => {
      expect(extractTitle('# 🌍 Hello World')).toBe('🌍 Hello World');
    });

    it('handles special symbols in plain text', () => {
      expect(extractTitle('!@#$%^&*()')).toBe('!@#$%^&*()');
    });
  });
});
