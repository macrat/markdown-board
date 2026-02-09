// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageExists } from '@/hooks/usePageExists';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageExists', () => {
  it('sets loading to false when page exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => usePageExists('page-1'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/page-1');
  });

  it('redirects to home on 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => usePageExists('non-existent'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to home on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => usePageExists('page-1'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('does not update state if component unmounts before fetch completes', async () => {
    let resolvePromise: (value: Response) => void = () => {};
    const fetchPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    const mockFetch = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', mockFetch);

    const { result, unmount } = renderHook(() => usePageExists('page-1'));

    expect(result.current.loading).toBe(true);

    unmount();

    resolvePromise({ ok: true, status: 200 } as Response);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result.current.loading).toBe(true);
  });
});
