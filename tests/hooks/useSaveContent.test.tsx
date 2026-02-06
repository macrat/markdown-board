// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveContent } from '@/hooks/useSaveContent';

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  logResponseError: vi.fn().mockResolvedValue(''),
}));

function createFetchResponse(
  ok: boolean,
  status: number,
  statusText?: string,
): Response {
  return {
    ok,
    status,
    statusText: statusText ?? (ok ? 'OK' : 'Internal Server Error'),
    text: () => Promise.resolve(''),
  } as Response;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSaveContent', () => {
  it('returns null as initial saveError', () => {
    const { result } = renderHook(() => useSaveContent('page-1'));

    expect(result.current.saveError).toBeNull();
  });

  it('calls fetch with correct params after 1 second debounce on content change', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createFetchResponse(true, 200));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    act(() => {
      result.current.handleContentChange('Hello, world!');
    });

    // fetch should not be called immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past the 1000ms debounce
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/page-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Hello, world!' }),
    });
  });

  it('clears any existing save error on successful save', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // First call fails, second call succeeds
    mockFetch
      .mockResolvedValueOnce(createFetchResponse(false, 500))
      .mockResolvedValueOnce(createFetchResponse(true, 200));

    const { result } = renderHook(() => useSaveContent('page-1'));

    // Trigger a failed save first
    act(() => {
      result.current.handleContentChange('fail content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBe('保存に失敗しました');

    // Now trigger a successful save
    act(() => {
      result.current.handleContentChange('success content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBeNull();
  });

  it('sets saveError to generic message on non-ok response', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(false, 500));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    act(() => {
      result.current.handleContentChange('some content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBe('保存に失敗しました');
  });

  it('sets saveError to size limit message on 413 status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(false, 413, 'Payload Too Large'));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    act(() => {
      result.current.handleContentChange('very large content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBe(
      '保存できませんでした: コンテンツが大きすぎます（上限: 10MB）',
    );
  });

  it('sets saveError on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    act(() => {
      result.current.handleContentChange('some content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBe('保存に失敗しました');
  });

  it('debounces multiple rapid changes and only triggers one save', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createFetchResponse(true, 200));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    // Simulate rapid typing: multiple changes within the debounce window
    act(() => {
      result.current.handleContentChange('H');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.handleContentChange('He');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.handleContentChange('Hel');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.handleContentChange('Hell');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.handleContentChange('Hello');
    });

    // No fetch should have been called yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past the debounce window from the last change
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Only one fetch call with the final content
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/page-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Hello' }),
    });
  });

  it('auto-dismisses save error after 5 seconds', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse(false, 500));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useSaveContent('page-1'));

    act(() => {
      result.current.handleContentChange('some content');
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveError).toBe('保存に失敗しました');

    // Advance 4999ms - error should still be visible
    act(() => {
      vi.advanceTimersByTime(4999);
    });

    expect(result.current.saveError).toBe('保存に失敗しました');

    // Advance the remaining 1ms to reach 5000ms total
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.saveError).toBeNull();
  });
});
