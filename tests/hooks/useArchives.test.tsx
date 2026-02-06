// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArchives } from '@/hooks/useArchives';
import type { ArchiveListItem } from '@/lib/types';

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    logResponseError: vi.fn(),
  };
});

vi.stubGlobal('fetch', vi.fn());

const mockFetch = fetch as ReturnType<typeof vi.fn>;

function createArchive(
  overrides: Partial<ArchiveListItem> = {},
): ArchiveListItem {
  return {
    id: 'archive-1',
    title: 'Test Archive',
    created_at: 1000,
    updated_at: 2000,
    archived_at: 3000,
    ...overrides,
  };
}

function okJsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function errorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useArchives', () => {
  describe('fetchArchives', () => {
    it('successful fetch sets archives state', async () => {
      const archives: ArchiveListItem[] = [
        createArchive({ id: 'a-1', title: 'First' }),
        createArchive({ id: 'a-2', title: 'Second' }),
      ];
      mockFetch.mockResolvedValueOnce(okJsonResponse(archives));

      const { result } = renderHook(() => useArchives());

      expect(result.current.archives).toEqual([]);

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/archives');
      expect(result.current.archives).toEqual(archives);
    });

    it('handles non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(500, 'Internal Server Error'),
      );

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual([]);
    });

    it('handles invalid response shape', async () => {
      const invalidData = { not: 'an array' };
      mockFetch.mockResolvedValueOnce(okJsonResponse(invalidData));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual([]);
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      expect(result.current.archives).toEqual([]);
    });
  });

  describe('archivePage', () => {
    it('successful archive returns archived_at timestamp', async () => {
      const archivedAt = Date.now();
      mockFetch.mockResolvedValueOnce(
        okJsonResponse({ archived_at: archivedAt }),
      );

      const { result } = renderHook(() => useArchives());

      let returnValue: number | null = null;
      await act(async () => {
        returnValue = await result.current.archivePage('page-1');
      });

      expect(returnValue).toBe(archivedAt);
      expect(mockFetch).toHaveBeenCalledWith('/api/pages/page-1/archive', {
        method: 'POST',
      });
    });

    it('handles non-ok response, returns null', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'));

      const { result } = renderHook(() => useArchives());

      let returnValue: number | null = 999;
      await act(async () => {
        returnValue = await result.current.archivePage('non-existent');
      });

      expect(returnValue).toBeNull();
    });

    it('handles invalid response shape, returns null', async () => {
      const invalidData = { wrong_field: 'value' };
      mockFetch.mockResolvedValueOnce(okJsonResponse(invalidData));

      const { result } = renderHook(() => useArchives());

      let returnValue: number | null = 999;
      await act(async () => {
        returnValue = await result.current.archivePage('page-1');
      });

      expect(returnValue).toBeNull();
    });

    it('handles network error, returns null', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useArchives());

      let returnValue: number | null = 999;
      await act(async () => {
        returnValue = await result.current.archivePage('page-1');
      });

      expect(returnValue).toBeNull();
    });
  });

  describe('unarchivePage', () => {
    it('successful unarchive returns true', async () => {
      mockFetch.mockResolvedValueOnce(okJsonResponse({ success: true }));

      const { result } = renderHook(() => useArchives());

      let returnValue = false;
      await act(async () => {
        returnValue = await result.current.unarchivePage('page-1');
      });

      expect(returnValue).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/pages/page-1/unarchive', {
        method: 'POST',
      });
    });

    it('handles non-ok response, returns false', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(500, 'Internal Server Error'),
      );

      const { result } = renderHook(() => useArchives());

      let returnValue = true;
      await act(async () => {
        returnValue = await result.current.unarchivePage('page-1');
      });

      expect(returnValue).toBe(false);
    });

    it('handles network error, returns false', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useArchives());

      let returnValue = true;
      await act(async () => {
        returnValue = await result.current.unarchivePage('page-1');
      });

      expect(returnValue).toBe(false);
    });
  });

  describe('addArchive', () => {
    it('adds an archive to the beginning of the list', async () => {
      const existing: ArchiveListItem[] = [
        createArchive({ id: 'a-1', title: 'Existing' }),
      ];
      mockFetch.mockResolvedValueOnce(okJsonResponse(existing));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      const newArchive = createArchive({ id: 'a-2', title: 'New Archive' });

      act(() => {
        result.current.addArchive(newArchive);
      });

      expect(result.current.archives).toHaveLength(2);
      expect(result.current.archives[0]).toEqual(newArchive);
      expect(result.current.archives[1]).toEqual(existing[0]);
    });
  });

  describe('removeArchive', () => {
    it('removes an archive from the list', async () => {
      const archives: ArchiveListItem[] = [
        createArchive({ id: 'a-1', title: 'First' }),
        createArchive({ id: 'a-2', title: 'Second' }),
        createArchive({ id: 'a-3', title: 'Third' }),
      ];
      mockFetch.mockResolvedValueOnce(okJsonResponse(archives));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      act(() => {
        result.current.removeArchive('a-2');
      });

      expect(result.current.archives).toHaveLength(2);
      expect(result.current.archives.map((a) => a.id)).toEqual(['a-1', 'a-3']);
    });
  });

  describe('findArchive', () => {
    it('finds an archive by id', async () => {
      const target = createArchive({ id: 'a-2', title: 'Target' });
      const archives: ArchiveListItem[] = [
        createArchive({ id: 'a-1', title: 'First' }),
        target,
        createArchive({ id: 'a-3', title: 'Third' }),
      ];
      mockFetch.mockResolvedValueOnce(okJsonResponse(archives));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      const found = result.current.findArchive('a-2');
      expect(found).toEqual(target);
    });

    it('returns undefined for non-existent id', async () => {
      const archives: ArchiveListItem[] = [
        createArchive({ id: 'a-1', title: 'First' }),
      ];
      mockFetch.mockResolvedValueOnce(okJsonResponse(archives));

      const { result } = renderHook(() => useArchives());

      await act(async () => {
        await result.current.fetchArchives();
      });

      const found = result.current.findArchive('non-existent');
      expect(found).toBeUndefined();
    });
  });
});
