import { describe, it, expect } from 'vitest';
import {
  isPageListItemArray,
  isArchiveListItemArray,
  isPage,
  isCreatePageResponse,
  isArchivePageResponse,
} from '@/lib/api';

describe('isPageListItemArray', () => {
  it('accepts a valid page list', () => {
    const data = [
      { id: 'a', title: 'A', created_at: 1, updated_at: 2 },
      { id: 'b', title: 'B', created_at: 3, updated_at: 4 },
    ];
    expect(isPageListItemArray(data)).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(isPageListItemArray([])).toBe(true);
  });

  it('rejects non-array values', () => {
    expect(isPageListItemArray(null)).toBe(false);
    expect(isPageListItemArray(undefined)).toBe(false);
    expect(isPageListItemArray('string')).toBe(false);
    expect(isPageListItemArray(123)).toBe(false);
    expect(isPageListItemArray({})).toBe(false);
  });

  it('rejects items with missing fields', () => {
    expect(isPageListItemArray([{ id: 'a' }])).toBe(false);
    expect(isPageListItemArray([{ id: 'a', title: 'A' }])).toBe(false);
    expect(isPageListItemArray([{ id: 'a', title: 'A', created_at: 1 }])).toBe(
      false,
    );
  });

  it('rejects items with wrong field types', () => {
    expect(
      isPageListItemArray([
        { id: 1, title: 'A', created_at: 1, updated_at: 2 },
      ]),
    ).toBe(false);
    expect(
      isPageListItemArray([
        { id: 'a', title: 123, created_at: 1, updated_at: 2 },
      ]),
    ).toBe(false);
    expect(
      isPageListItemArray([
        { id: 'a', title: 'A', created_at: '1', updated_at: 2 },
      ]),
    ).toBe(false);
  });

  it('accepts items with extra fields', () => {
    const data = [
      { id: 'a', title: 'A', created_at: 1, updated_at: 2, extra: true },
    ];
    expect(isPageListItemArray(data)).toBe(true);
  });
});

describe('isArchiveListItemArray', () => {
  it('accepts a valid archive list', () => {
    const data = [
      {
        id: 'a',
        title: 'A',
        created_at: 1,
        updated_at: 2,
        archived_at: 3,
      },
    ];
    expect(isArchiveListItemArray(data)).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(isArchiveListItemArray([])).toBe(true);
  });

  it('rejects items missing archived_at', () => {
    const data = [{ id: 'a', title: 'A', created_at: 1, updated_at: 2 }];
    expect(isArchiveListItemArray(data)).toBe(false);
  });

  it('rejects items with non-number archived_at', () => {
    const data = [
      {
        id: 'a',
        title: 'A',
        created_at: 1,
        updated_at: 2,
        archived_at: null,
      },
    ];
    expect(isArchiveListItemArray(data)).toBe(false);
  });
});

describe('isPage', () => {
  it('accepts a valid page', () => {
    const data = {
      id: 'a',
      title: 'A',
      content: '# Hello',
      created_at: 1,
      updated_at: 2,
      archived_at: null,
    };
    expect(isPage(data)).toBe(true);
  });

  it('accepts a page with numeric archived_at', () => {
    const data = {
      id: 'a',
      title: 'A',
      content: '',
      created_at: 1,
      updated_at: 2,
      archived_at: 3,
    };
    expect(isPage(data)).toBe(true);
  });

  it('rejects non-object values', () => {
    expect(isPage(null)).toBe(false);
    expect(isPage(undefined)).toBe(false);
    expect(isPage([])).toBe(false);
    expect(isPage('string')).toBe(false);
  });

  it('rejects objects with missing fields', () => {
    expect(isPage({ id: 'a' })).toBe(false);
    expect(isPage({ id: 'a', title: 'A' })).toBe(false);
  });

  it('rejects objects with wrong content type', () => {
    expect(
      isPage({
        id: 'a',
        title: 'A',
        content: 123,
        created_at: 1,
        updated_at: 2,
        archived_at: null,
      }),
    ).toBe(false);
  });

  it('rejects objects with string archived_at', () => {
    expect(
      isPage({
        id: 'a',
        title: 'A',
        content: '',
        created_at: 1,
        updated_at: 2,
        archived_at: 'not-null',
      }),
    ).toBe(false);
  });
});

describe('isCreatePageResponse', () => {
  it('accepts a valid response', () => {
    expect(isCreatePageResponse({ id: 'abc-123' })).toBe(true);
    expect(isCreatePageResponse({ success: true, id: 'abc-123' })).toBe(true);
  });

  it('rejects responses without id', () => {
    expect(isCreatePageResponse({})).toBe(false);
    expect(isCreatePageResponse({ success: true })).toBe(false);
  });

  it('rejects non-string id', () => {
    expect(isCreatePageResponse({ id: 123 })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isCreatePageResponse(null)).toBe(false);
    expect(isCreatePageResponse('string')).toBe(false);
  });
});

describe('isArchivePageResponse', () => {
  it('accepts a valid response', () => {
    expect(isArchivePageResponse({ archived_at: 1234567890 })).toBe(true);
    expect(
      isArchivePageResponse({ success: true, archived_at: 1234567890 }),
    ).toBe(true);
  });

  it('rejects responses without archived_at', () => {
    expect(isArchivePageResponse({})).toBe(false);
    expect(isArchivePageResponse({ success: true })).toBe(false);
  });

  it('rejects non-number archived_at', () => {
    expect(isArchivePageResponse({ archived_at: '123' })).toBe(false);
    expect(isArchivePageResponse({ archived_at: null })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isArchivePageResponse(null)).toBe(false);
    expect(isArchivePageResponse([])).toBe(false);
  });
});
