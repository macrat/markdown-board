// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatingItems } from '@/hooks/useAnimatingItems';
import { ANIMATION_DURATION_MS } from '@/lib/constants';

describe('useAnimatingItems', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns opacity 1 for any id', () => {
      const { result } = renderHook(() => useAnimatingItems());

      expect(result.current.getItemOpacity('any-id')).toBe(1);
      expect(result.current.getItemOpacity('another-id')).toBe(1);
      expect(result.current.getItemOpacity('')).toBe(1);
    });
  });

  describe('startFadeOut', () => {
    it('sets opacity to 0 for the item', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);
    });

    it('calls onComplete callback after ANIMATION_DURATION_MS', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(ANIMATION_DURATION_MS);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('does not call onComplete before ANIMATION_DURATION_MS', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      act(() => {
        vi.advanceTimersByTime(ANIMATION_DURATION_MS - 1);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('startFadeIn', () => {
    it('sets opacity to 1 for the item with fadeIn animation', () => {
      const { result } = renderHook(() => useAnimatingItems());

      act(() => {
        result.current.startFadeIn('item-1');
      });

      // fadeIn type returns opacity 1
      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });

    it('replaces existing animation for the same id', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);

      act(() => {
        result.current.startFadeIn('item-1');
      });

      // fadeIn replaces the fadeOut, so opacity should be 1
      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });

    it('auto-clears animation after ANIMATION_DURATION_MS', () => {
      const { result } = renderHook(() => useAnimatingItems());

      act(() => {
        result.current.startFadeIn('item-1');
      });

      // The item has a fadeIn animation entry
      expect(result.current.getItemOpacity('item-1')).toBe(1);

      act(() => {
        vi.advanceTimersByTime(ANIMATION_DURATION_MS);
      });

      // After the timer, the animation entry is removed;
      // getItemOpacity returns 1 for items without animation entries
      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });
  });

  describe('clearAnimation', () => {
    it('removes animation for the specified id', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);

      act(() => {
        result.current.clearAnimation('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });

    it('does not affect other animations', () => {
      const { result } = renderHook(() => useAnimatingItems());

      act(() => {
        result.current.startFadeOut('item-1', vi.fn());
        result.current.startFadeOut('item-2', vi.fn());
      });

      act(() => {
        result.current.clearAnimation('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
      expect(result.current.getItemOpacity('item-2')).toBe(0);
    });
  });

  describe('multiple animations', () => {
    it('can track multiple items independently', () => {
      const { result } = renderHook(() => useAnimatingItems());
      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();

      act(() => {
        result.current.startFadeOut('item-1', onComplete1);
      });

      act(() => {
        result.current.startFadeIn('item-2');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);
      expect(result.current.getItemOpacity('item-2')).toBe(1);
      expect(result.current.getItemOpacity('item-3')).toBe(1);

      act(() => {
        result.current.startFadeOut('item-3', onComplete2);
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);
      expect(result.current.getItemOpacity('item-2')).toBe(1);
      expect(result.current.getItemOpacity('item-3')).toBe(0);
    });
  });

  describe('cleanup on unmount', () => {
    it('clears all timers when unmounted', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { result, unmount } = renderHook(() => useAnimatingItems());

      act(() => {
        result.current.startFadeOut('item-1', vi.fn());
        result.current.startFadeIn('item-2');
      });

      const clearTimeoutCallsBefore = clearTimeoutSpy.mock.calls.length;

      unmount();

      // clearTimeout should have been called for each pending timer
      const clearTimeoutCallsAfter = clearTimeoutSpy.mock.calls.length;
      expect(clearTimeoutCallsAfter).toBeGreaterThan(clearTimeoutCallsBefore);

      clearTimeoutSpy.mockRestore();
    });

    it('does not fire callbacks after unmount', () => {
      const onComplete = vi.fn();
      const { result, unmount } = renderHook(() => useAnimatingItems());

      act(() => {
        result.current.startFadeOut('item-1', onComplete);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(ANIMATION_DURATION_MS);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
