// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with isSaving false and no error', () => {
    const { result } = renderHook(() => useAutoSave('page-1'));
    expect(result.current.isSaving).toBe(false);
    expect(result.current.saveError).toBeNull();
  });

  describe('handleContentChange', () => {
    it('debounces save by 1 second', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('hello');
      });

      expect(fetchSpy).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(fetchSpy).toHaveBeenCalledWith('/api/pages/page-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      });
    });

    it('cancels previous debounce when called again', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('first');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.handleContentChange('second');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Only the second call should have been saved
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('/api/pages/page-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'second' }),
      });
    });

    it('sets isSaving during save', async () => {
      let resolvePromise: (value: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockReturnValue(
        new Promise<Response>((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('shows error on failed save', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe('保存に失敗しました');
    });

    it('shows specific error for 413 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 413,
        statusText: 'Content Too Large',
        text: async () => 'too large',
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe(
        '保存できませんでした: コンテンツが大きすぎます（上限: 10MB）',
      );
    });

    it('shows error on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Network error'),
      );

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe('保存に失敗しました');
    });

    it('clears error on successful save after error', async () => {
      // First save fails
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe('保存に失敗しました');

      // Second save succeeds
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      act(() => {
        result.current.handleContentChange('fixed content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBeNull();
    });

    it('auto-dismisses save error after 5 seconds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.saveError).toBe('保存に失敗しました');

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.saveError).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('clears pending save timeout', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useAutoSave('page-1'));

      act(() => {
        result.current.handleContentChange('content');
      });

      act(() => {
        result.current.cleanup();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Save should not have been triggered
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('reference stability', () => {
    it('returns stable handleContentChange reference', () => {
      const { result, rerender } = renderHook(() => useAutoSave('page-1'));
      const first = result.current.handleContentChange;
      rerender();
      expect(result.current.handleContentChange).toBe(first);
    });

    it('returns stable cleanup reference', () => {
      const { result, rerender } = renderHook(() => useAutoSave('page-1'));
      const first = result.current.cleanup;
      rerender();
      expect(result.current.cleanup).toBe(first);
    });
  });
});
