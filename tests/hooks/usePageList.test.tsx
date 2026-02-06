// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageList } from '@/hooks/usePageList';
import type { PageListItem } from '@/lib/types';

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockPages: PageListItem[] = [
  { id: 'page-1', title: 'First Page', created_at: 1000, updated_at: 2000 },
  { id: 'page-2', title: 'Second Page', created_at: 1500, updated_at: 2500 },
];

function createFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageList', () => {
  describe('fetchPages', () => {
    it('successful fetch sets pages state', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(mockPages)),
      );

      const { result } = renderHook(() => usePageList());

      expect(result.current.pages).toEqual([]);

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual(mockPages);
      expect(fetch).toHaveBeenCalledWith('/api/pages');
    });

    it('handles non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse({}, false, 500)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual([]);
    });

    it('handles invalid response shape', async () => {
      const invalidData = { not: 'an array' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(invalidData)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual([]);
    });

    it('handles network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure')),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual([]);
    });
  });

  describe('createPage', () => {
    it('successful create returns page id', async () => {
      const createResponse = { id: 'new-page-id' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(createResponse)),
      );

      const { result } = renderHook(() => usePageList());
      let pageId: string | null = null;

      await act(async () => {
        pageId = await result.current.createPage();
      });

      expect(pageId).toBe('new-page-id');
      expect(fetch).toHaveBeenCalledWith('/api/pages', { method: 'POST' });
    });

    it('handles non-ok response, returns null', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse({}, false, 500)),
      );

      const { result } = renderHook(() => usePageList());
      let pageId: string | null = 'should-become-null';

      await act(async () => {
        pageId = await result.current.createPage();
      });

      expect(pageId).toBeNull();
    });

    it('handles invalid response shape, returns null', async () => {
      const invalidData = { name: 'not-an-id-field' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(invalidData)),
      );

      const { result } = renderHook(() => usePageList());
      let pageId: string | null = 'should-become-null';

      await act(async () => {
        pageId = await result.current.createPage();
      });

      expect(pageId).toBeNull();
    });

    it('handles network error, returns null', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure')),
      );

      const { result } = renderHook(() => usePageList());
      let pageId: string | null = 'should-become-null';

      await act(async () => {
        pageId = await result.current.createPage();
      });

      expect(pageId).toBeNull();
    });
  });

  describe('removePage', () => {
    it('removes a page from the list', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(mockPages)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toHaveLength(2);

      act(() => {
        result.current.removePage('page-1');
      });

      expect(result.current.pages).toHaveLength(1);
      expect(result.current.pages[0].id).toBe('page-2');
    });
  });

  describe('addPage', () => {
    it('adds a page to the beginning of the list', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(mockPages)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      const newPage: PageListItem = {
        id: 'page-3',
        title: 'Third Page',
        created_at: 3000,
        updated_at: 3500,
      };

      act(() => {
        result.current.addPage(newPage);
      });

      expect(result.current.pages).toHaveLength(3);
      expect(result.current.pages[0]).toEqual(newPage);
      expect(result.current.pages[1]).toEqual(mockPages[0]);
      expect(result.current.pages[2]).toEqual(mockPages[1]);
    });
  });

  describe('findPage', () => {
    it('finds a page by id', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(mockPages)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      const found = result.current.findPage('page-2');
      expect(found).toEqual(mockPages[1]);
    });

    it('returns undefined for non-existent id', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(createFetchResponse(mockPages)),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      const found = result.current.findPage('non-existent');
      expect(found).toBeUndefined();
    });
  });
});
