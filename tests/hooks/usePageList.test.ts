// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageList } from '@/hooks/usePageList';
import type { PageListItem } from '@/lib/types';

const mockPages: PageListItem[] = [
  { id: '1', title: 'Page 1', created_at: 1000, updated_at: 2000 },
  { id: '2', title: 'Page 2', created_at: 1100, updated_at: 2100 },
  { id: '3', title: 'Page 3', created_at: 1200, updated_at: 2200 },
];

describe('usePageList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty pages array', () => {
    const { result } = renderHook(() => usePageList());
    expect(result.current.pages).toEqual([]);
  });

  describe('fetchPages', () => {
    it('fetches and sets pages on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockPages,
      } as Response);

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual(mockPages);
      expect(fetch).toHaveBeenCalledWith('/api/pages');
    });

    it('does not update pages on error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      } as Response);

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual([]);
    });

    it('does not update pages on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toEqual([]);
    });
  });

  describe('removePage', () => {
    it('removes a page by id', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockPages,
      } as Response);

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      expect(result.current.pages).toHaveLength(3);

      act(() => {
        result.current.removePage('2');
      });

      expect(result.current.pages).toHaveLength(2);
      expect(result.current.pages.find((p) => p.id === '2')).toBeUndefined();
    });

    it('does nothing when removing non-existent page', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockPages,
      } as Response);

      const { result } = renderHook(() => usePageList());

      await act(async () => {
        await result.current.fetchPages();
      });

      act(() => {
        result.current.removePage('non-existent');
      });

      expect(result.current.pages).toHaveLength(3);
    });
  });

  describe('fetchPages stability', () => {
    it('returns a stable fetchPages reference', () => {
      const { result, rerender } = renderHook(() => usePageList());
      const firstFetchPages = result.current.fetchPages;
      rerender();
      expect(result.current.fetchPages).toBe(firstFetchPages);
    });

    it('returns a stable removePage reference', () => {
      const { result, rerender } = renderHook(() => usePageList());
      const firstRemovePage = result.current.removePage;
      rerender();
      expect(result.current.removePage).toBe(firstRemovePage);
    });
  });
});
