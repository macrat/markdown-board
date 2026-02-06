// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArchiveList } from '@/hooks/useArchiveList';
import type { ArchiveListItem } from '@/lib/types';

const mockArchives: ArchiveListItem[] = [
  {
    id: '1',
    title: 'Archive 1',
    created_at: 1000,
    updated_at: 2000,
    archived_at: 3000,
  },
  {
    id: '2',
    title: 'Archive 2',
    created_at: 1100,
    updated_at: 2100,
    archived_at: 3100,
  },
];

describe('useArchiveList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty archives array', () => {
    const { result } = renderHook(() => useArchiveList());
    expect(result.current.archives).toEqual([]);
  });

  describe('fetchArchives', () => {
    it('fetches and sets archives on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockArchives,
      } as Response);

      const { result } = renderHook(() => useArchiveList());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual(mockArchives);
      expect(fetch).toHaveBeenCalledWith('/api/archives');
    });

    it('does not update archives on error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      } as Response);

      const { result } = renderHook(() => useArchiveList());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual([]);
    });

    it('does not update archives on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result } = renderHook(() => useArchiveList());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual([]);
    });
  });

  describe('addArchive', () => {
    it('adds an archive to the beginning of the list', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockArchives,
      } as Response);

      const { result } = renderHook(() => useArchiveList());

      await act(async () => {
        await result.current.fetchArchives();
      });

      const newArchive: ArchiveListItem = {
        id: '3',
        title: 'New Archive',
        created_at: 1200,
        updated_at: 2200,
        archived_at: 3200,
      };

      act(() => {
        result.current.addArchive(newArchive);
      });

      expect(result.current.archives).toHaveLength(3);
      expect(result.current.archives[0]).toEqual(newArchive);
    });

    it('adds an archive to an empty list', () => {
      const { result } = renderHook(() => useArchiveList());

      const newArchive: ArchiveListItem = {
        id: '1',
        title: 'First Archive',
        created_at: 1000,
        updated_at: 2000,
        archived_at: 3000,
      };

      act(() => {
        result.current.addArchive(newArchive);
      });

      expect(result.current.archives).toHaveLength(1);
      expect(result.current.archives[0]).toEqual(newArchive);
    });
  });

  describe('reference stability', () => {
    it('returns stable fetchArchives reference', () => {
      const { result, rerender } = renderHook(() => useArchiveList());
      const first = result.current.fetchArchives;
      rerender();
      expect(result.current.fetchArchives).toBe(first);
    });

    it('returns stable addArchive reference', () => {
      const { result, rerender } = renderHook(() => useArchiveList());
      const first = result.current.addArchive;
      rerender();
      expect(result.current.addArchive).toBe(first);
    });
  });
});
