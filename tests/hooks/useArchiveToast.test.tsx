// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArchiveToast } from '@/hooks/useArchiveToast';

describe('useArchiveToast', () => {
  describe('initial state', () => {
    it('returns toast with visible set to false', () => {
      const { result } = renderHook(() => useArchiveToast());

      expect(result.current.toast.visible).toBe(false);
    });

    it('returns toast with empty pageId', () => {
      const { result } = renderHook(() => useArchiveToast());

      expect(result.current.toast.pageId).toBe('');
    });

    it('returns toast with empty pageTitle', () => {
      const { result } = renderHook(() => useArchiveToast());

      expect(result.current.toast.pageTitle).toBe('');
    });

    it('returns showToast and hideToast functions', () => {
      const { result } = renderHook(() => useArchiveToast());

      expect(typeof result.current.showToast).toBe('function');
      expect(typeof result.current.hideToast).toBe('function');
    });
  });

  describe('showToast', () => {
    it('sets visible to true', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      expect(result.current.toast.visible).toBe(true);
    });

    it('stores the provided pageId', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      expect(result.current.toast.pageId).toBe('page-1');
    });

    it('stores the provided pageTitle', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      expect(result.current.toast.pageTitle).toBe('My Page');
    });
  });

  describe('hideToast', () => {
    it('sets visible to false', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast.visible).toBe(false);
    });

    it('clears pageId to empty string', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast.pageId).toBe('');
    });

    it('clears pageTitle to empty string', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'My Page');
      });

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast.pageTitle).toBe('');
    });
  });

  describe('show then hide sequence', () => {
    it('transitions from visible to hidden with state fully reset', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-abc', 'Meeting Notes');
      });

      expect(result.current.toast).toEqual({
        visible: true,
        pageId: 'page-abc',
        pageTitle: 'Meeting Notes',
      });

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast).toEqual({
        visible: false,
        pageId: '',
        pageTitle: '',
      });
    });

    it('returns to the same state as initial after hide', () => {
      const { result } = renderHook(() => useArchiveToast());

      const initialToast = { ...result.current.toast };

      act(() => {
        result.current.showToast('page-1', 'Some Title');
      });

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast).toEqual(initialToast);
    });
  });

  describe('showing different toasts sequentially', () => {
    it('overwrites previous toast state with new values', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'First Page');
      });

      expect(result.current.toast).toEqual({
        visible: true,
        pageId: 'page-1',
        pageTitle: 'First Page',
      });

      act(() => {
        result.current.showToast('page-2', 'Second Page');
      });

      expect(result.current.toast).toEqual({
        visible: true,
        pageId: 'page-2',
        pageTitle: 'Second Page',
      });
    });

    it('does not retain any data from the previous toast', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('id-aaa', 'Title AAA');
      });

      act(() => {
        result.current.showToast('id-bbb', 'Title BBB');
      });

      expect(result.current.toast.pageId).not.toBe('id-aaa');
      expect(result.current.toast.pageTitle).not.toBe('Title AAA');
      expect(result.current.toast.pageId).toBe('id-bbb');
      expect(result.current.toast.pageTitle).toBe('Title BBB');
    });

    it('keeps visible as true when showing multiple toasts in a row', () => {
      const { result } = renderHook(() => useArchiveToast());

      act(() => {
        result.current.showToast('page-1', 'First');
      });

      act(() => {
        result.current.showToast('page-2', 'Second');
      });

      act(() => {
        result.current.showToast('page-3', 'Third');
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.pageId).toBe('page-3');
      expect(result.current.toast.pageTitle).toBe('Third');
    });
  });
});
