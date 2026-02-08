// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetchPage } from '@/hooks/useFetchPage';
import { logger } from '@/lib/logger';

// Mock the Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  logResponseError: vi.fn().mockResolvedValue(''),
  isPage: (data: unknown): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.content === 'string' &&
      typeof obj.created_at === 'number' &&
      typeof obj.updated_at === 'number' &&
      (obj.archived_at === null || typeof obj.archived_at === 'number')
    );
  },
}));

function createFetchResponse(
  ok: boolean,
  status: number,
  jsonData?: unknown,
  jsonError?: Error,
): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => {
      if (jsonError) {
        return Promise.reject(jsonError);
      }
      return Promise.resolve(jsonData);
    },
    text: () => Promise.resolve(''),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFetchPage', () => {
  it('loads page content successfully', async () => {
    const mockPageData = {
      id: 'page-1',
      title: 'Test Page',
      content: '# Test Content',
      created_at: Date.now(),
      updated_at: Date.now(),
      archived_at: null,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(true, 200, mockPageData));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useFetchPage('page-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.pageContent).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pageContent).toBe('# Test Content');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to home on non-ok response', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(false, 404));
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useFetchPage('page-1'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('logs JSON parse error and redirects on invalid JSON', async () => {
    const syntaxError = new SyntaxError('Unexpected token < in JSON');
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        createFetchResponse(true, 200, undefined, syntaxError),
      );
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useFetchPage('page-1'));

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[Editor FetchPage] JSON parse error:',
        syntaxError,
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('logs network error and redirects on fetch failure', async () => {
    const networkError = new Error('Network failure');
    const mockFetch = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useFetchPage('page-1'));

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[Editor FetchPage] Network error:',
        networkError,
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to home on unexpected response shape', async () => {
    const invalidData = {
      id: 'page-1',
      // Missing required fields
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(true, 200, invalidData));
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useFetchPage('page-1'));

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[Editor FetchPage] Unexpected response shape:',
        invalidData,
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('does not update state if component unmounts before fetch completes', async () => {
    const mockPageData = {
      id: 'page-1',
      title: 'Test Page',
      content: '# Test Content',
      created_at: Date.now(),
      updated_at: Date.now(),
      archived_at: null,
    };

    let resolvePromise: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', mockFetch);

    const { result, unmount } = renderHook(() => useFetchPage('page-1'));

    expect(result.current.loading).toBe(true);

    // Unmount before fetch completes
    unmount();

    // Now resolve the fetch
    resolvePromise!(createFetchResponse(true, 200, mockPageData));

    // Give it a moment to process (though it shouldn't update state)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // State should still be initial values
    expect(result.current.loading).toBe(true);
    expect(result.current.pageContent).toBeNull();
  });
});
