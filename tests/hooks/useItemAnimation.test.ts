// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useItemAnimation } from '@/hooks/useItemAnimation';

describe('useItemAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with no animations', () => {
    const { result } = renderHook(() => useItemAnimation());
    expect(result.current.getItemOpacity('any-id')).toBe(1);
  });

  describe('startFadeOut', () => {
    it('sets opacity to 0 for fade out animation', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);
    });

    it('does not affect other items', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
      });

      expect(result.current.getItemOpacity('item-2')).toBe(1);
    });
  });

  describe('startFadeIn', () => {
    it('sets opacity to 1 for fade in animation', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeIn('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });

    it('replaces existing animation for the same item', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);

      act(() => {
        result.current.startFadeIn('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });
  });

  describe('clearAnimation', () => {
    it('removes animation and restores default opacity', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);

      act(() => {
        result.current.clearAnimation('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });

    it('does not affect other animated items', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
        result.current.startFadeOut('item-2');
      });

      act(() => {
        result.current.clearAnimation('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
      expect(result.current.getItemOpacity('item-2')).toBe(0);
    });
  });

  describe('scheduleAfterAnimation', () => {
    it('calls callback after animation duration (200ms)', () => {
      const { result } = renderHook(() => useItemAnimation());
      const callback = vi.fn();

      act(() => {
        result.current.scheduleAfterAnimation(callback);
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(callback).toHaveBeenCalledOnce();
    });

    it('does not call callback before animation duration', () => {
      const { result } = renderHook(() => useItemAnimation());
      const callback = vi.fn();

      act(() => {
        result.current.scheduleAfterAnimation(callback);
      });

      act(() => {
        vi.advanceTimersByTime(199);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('handles multiple scheduled animations independently', () => {
      const { result } = renderHook(() => useItemAnimation());
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      act(() => {
        result.current.scheduleAfterAnimation(callback1);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.scheduleAfterAnimation(callback2);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe('cleanup on unmount', () => {
    it('clears pending timers when unmounted', () => {
      const { result, unmount } = renderHook(() => useItemAnimation());
      const callback = vi.fn();

      act(() => {
        result.current.scheduleAfterAnimation(callback);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Timer was cleared on unmount, callback should not fire
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getItemOpacity', () => {
    it('returns 1 for non-animated items', () => {
      const { result } = renderHook(() => useItemAnimation());
      expect(result.current.getItemOpacity('unknown')).toBe(1);
    });

    it('returns 0 for fade out items', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeOut('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(0);
    });

    it('returns 1 for fade in items', () => {
      const { result } = renderHook(() => useItemAnimation());

      act(() => {
        result.current.startFadeIn('item-1');
      });

      expect(result.current.getItemOpacity('item-1')).toBe(1);
    });
  });

  describe('reference stability', () => {
    it('returns stable startFadeOut reference', () => {
      const { result, rerender } = renderHook(() => useItemAnimation());
      const first = result.current.startFadeOut;
      rerender();
      expect(result.current.startFadeOut).toBe(first);
    });

    it('returns stable startFadeIn reference', () => {
      const { result, rerender } = renderHook(() => useItemAnimation());
      const first = result.current.startFadeIn;
      rerender();
      expect(result.current.startFadeIn).toBe(first);
    });

    it('returns stable clearAnimation reference', () => {
      const { result, rerender } = renderHook(() => useItemAnimation());
      const first = result.current.clearAnimation;
      rerender();
      expect(result.current.clearAnimation).toBe(first);
    });

    it('returns stable scheduleAfterAnimation reference', () => {
      const { result, rerender } = renderHook(() => useItemAnimation());
      const first = result.current.scheduleAfterAnimation;
      rerender();
      expect(result.current.scheduleAfterAnimation).toBe(first);
    });
  });
});
