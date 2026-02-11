import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent } from 'mdast';

/**
 * Milkdown uses remark (via @milkdown/preset-commonmark) to parse
 * CommonMark markdown into an AST, which is then converted to ProseMirror
 * nodes for rendering. These tests verify the parsing pipeline that
 * underpins the editor's markdown rendering.
 */
const parser = unified().use(remarkParse);

function parse(markdown: string): Root {
  return parser.parse(markdown);
}

function firstChild(root: Root): RootContent {
  return root.children[0];
}

describe('CommonMark markdown parsing', () => {
  describe('headings', () => {
    it('parses all heading levels (h1-h6)', () => {
      const md = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

      const ast = parse(md);
      const headings = ast.children.filter((c) => c.type === 'heading');

      expect(headings).toHaveLength(6);
      expect(headings[0]).toMatchObject({ type: 'heading', depth: 1 });
      expect(headings[1]).toMatchObject({ type: 'heading', depth: 2 });
      expect(headings[2]).toMatchObject({ type: 'heading', depth: 3 });
      expect(headings[3]).toMatchObject({ type: 'heading', depth: 4 });
      expect(headings[4]).toMatchObject({ type: 'heading', depth: 5 });
      expect(headings[5]).toMatchObject({ type: 'heading', depth: 6 });

      for (let i = 0; i < 6; i++) {
        const heading = headings[i];
        if (heading.type === 'heading') {
          const text = heading.children[0];
          expect(text).toMatchObject({
            type: 'text',
            value: `Heading ${i + 1}`,
          });
        }
      }
    });
  });

  describe('text formatting', () => {
    it('parses bold text', () => {
      const ast = parse('**bold text**');
      const para = firstChild(ast);
      expect(para.type).toBe('paragraph');
      if (para.type === 'paragraph') {
        expect(para.children[0]).toMatchObject({
          type: 'strong',
        });
        const strong = para.children[0];
        if (strong.type === 'strong') {
          expect(strong.children[0]).toMatchObject({
            type: 'text',
            value: 'bold text',
          });
        }
      }
    });

    it('parses italic text', () => {
      const ast = parse('*italic text*');
      const para = firstChild(ast);
      if (para.type === 'paragraph') {
        expect(para.children[0]).toMatchObject({
          type: 'emphasis',
        });
        const em = para.children[0];
        if (em.type === 'emphasis') {
          expect(em.children[0]).toMatchObject({
            type: 'text',
            value: 'italic text',
          });
        }
      }
    });
  });

  describe('lists', () => {
    it('parses unordered lists', () => {
      const ast = parse('- Item 1\n- Item 2\n- Item 3');
      const list = firstChild(ast);
      expect(list.type).toBe('list');
      if (list.type === 'list') {
        expect(list.ordered).toBeFalsy();
        expect(list.children).toHaveLength(3);
        for (let i = 0; i < 3; i++) {
          const item = list.children[i];
          expect(item.type).toBe('listItem');
          const para = item.children[0];
          if (para.type === 'paragraph') {
            expect(para.children[0]).toMatchObject({
              type: 'text',
              value: `Item ${i + 1}`,
            });
          }
        }
      }
    });

    it('parses ordered lists', () => {
      const ast = parse('1. First\n2. Second\n3. Third');
      const list = firstChild(ast);
      expect(list.type).toBe('list');
      if (list.type === 'list') {
        expect(list.ordered).toBe(true);
        expect(list.children).toHaveLength(3);
      }
    });

    it('parses nested lists', () => {
      const ast = parse('- Parent 1\n  - Child 1\n  - Child 2');
      const list = firstChild(ast);
      expect(list.type).toBe('list');
      if (list.type === 'list') {
        const parentItem = list.children[0];
        // Nested list is the second child of the parent listItem
        const nested = parentItem.children.find((c) => c.type === 'list');
        expect(nested).toBeDefined();
        if (nested && nested.type === 'list') {
          expect(nested.children).toHaveLength(2);
        }
      }
    });
  });

  describe('links', () => {
    it('parses markdown links', () => {
      const ast = parse('[Click here](https://example.com)');
      const para = firstChild(ast);
      if (para.type === 'paragraph') {
        const link = para.children[0];
        expect(link).toMatchObject({
          type: 'link',
          url: 'https://example.com',
        });
        if (link.type === 'link') {
          expect(link.children[0]).toMatchObject({
            type: 'text',
            value: 'Click here',
          });
        }
      }
    });
  });

  describe('code', () => {
    it('parses inline code', () => {
      const ast = parse('Use `console.log()` for debugging');
      const para = firstChild(ast);
      if (para.type === 'paragraph') {
        const code = para.children.find((c) => c.type === 'inlineCode');
        expect(code).toMatchObject({
          type: 'inlineCode',
          value: 'console.log()',
        });
      }
    });

    it('parses code blocks with language', () => {
      const ast = parse(
        '```javascript\nfunction hello() {\n  return "world";\n}\n```',
      );
      const code = firstChild(ast);
      expect(code).toMatchObject({
        type: 'code',
        lang: 'javascript',
      });
      if (code.type === 'code') {
        expect(code.value).toContain('function hello()');
      }
    });
  });

  describe('blockquotes', () => {
    it('parses blockquotes', () => {
      const ast = parse('> This is a quote\n> Second line of quote');
      const bq = firstChild(ast);
      expect(bq.type).toBe('blockquote');
      if (bq.type === 'blockquote') {
        const para = bq.children[0];
        if (para.type === 'paragraph') {
          const text = para.children
            .filter(
              (c): c is { type: 'text'; value: string } => c.type === 'text',
            )
            .map((c) => c.value)
            .join('');
          expect(text).toContain('This is a quote');
          expect(text).toContain('Second line of quote');
        }
      }
    });
  });

  describe('horizontal rules', () => {
    it('parses horizontal rules (---)', () => {
      const ast = parse('Content above\n\n---\n\nContent below');
      const hr = ast.children.find((c) => c.type === 'thematicBreak');
      expect(hr).toBeDefined();
      expect(hr?.type).toBe('thematicBreak');
    });
  });

  describe('HTML-like content', () => {
    it('parses HTML-like tags in text context', () => {
      const ast = parse('Text with <div> and <script> tags');
      expect(ast.children.length).toBeGreaterThan(0);
      // The parser should recognize these as HTML nodes or text
      // The important thing is no crash and content is preserved
      const allText = ast.children
        .flatMap((c) => {
          if (c.type === 'paragraph') {
            return c.children.map((ch) => {
              if (ch.type === 'text') return ch.value;
              if (ch.type === 'html') return ch.value;
              return '';
            });
          }
          if (c.type === 'html') return [c.value];
          return [''];
        })
        .join('');
      expect(allText).toContain('<div>');
      expect(allText).toContain('<script>');
    });
  });
});
