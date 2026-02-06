// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageData } from '@/hooks/usePageData';
import type { Page } from '@/lib/types';

const mockPage: Page = {
  id: 'page-1',
  title: 'Test Page',
  content: '# Hello',
  created_at: 1000,
  updated_at: 2000,
  archived_at: null,
};

describe('usePageData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with loading true and null page', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const onNotFound = vi.fn();
    const { result } = renderHook(() => usePageData('page-1', onNotFound));

    expect(result.current.loading).toBe(true);
    expect(result.current.page).toBeNull();
  });

  it('fetches page data on mount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPage,
    } as Response);

    const onNotFound = vi.fn();
    const { result } = renderHook(() => usePageData('page-1', onNotFound));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.page).toEqual(mockPage);
    expect(fetch).toHaveBeenCalledWith('/api/pages/page-1');
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it('calls onNotFound when page is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'not found',
    } as Response);

    const onNotFound = vi.fn();
    renderHook(() => usePageData('non-existent', onNotFound));

    await waitFor(() => {
      expect(onNotFound).toHaveBeenCalledOnce();
    });
  });

  it('calls onNotFound on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error'),
    );

    const onNotFound = vi.fn();
    renderHook(() => usePageData('page-1', onNotFound));

    await waitFor(() => {
      expect(onNotFound).toHaveBeenCalledOnce();
    });
  });

  it('re-fetches when pageId changes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPage,
    } as Response);

    const onNotFound = vi.fn();
    const { result, rerender } = renderHook(
      ({ pageId }) => usePageData(pageId, onNotFound),
      { initialProps: { pageId: 'page-1' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const secondPage: Page = { ...mockPage, id: 'page-2', title: 'Page 2' };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => secondPage,
    } as Response);

    rerender({ pageId: 'page-2' });

    await waitFor(() => {
      expect(result.current.page?.id).toBe('page-2');
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/pages/page-2');
  });

  it('does not re-fetch when onNotFound changes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPage,
    } as Response);

    const onNotFound1 = vi.fn();
    const { result, rerender } = renderHook(
      ({ onNotFound }) => usePageData('page-1', onNotFound),
      { initialProps: { onNotFound: onNotFound1 } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const onNotFound2 = vi.fn();
    rerender({ onNotFound: onNotFound2 });

    // Only one fetch should have been made
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
