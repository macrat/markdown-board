// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import Toast from '@/components/Toast';

vi.mock('@/lib/constants', () => ({
  ANIMATION_DURATION_MS: 200,
}));

beforeEach(() => {
  cleanup();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('displays the message', () => {
    render(
      <Toast message="テストメッセージ" onCancel={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText('テストメッセージ')).toBeTruthy();
  });

  it('has proper ARIA attributes', () => {
    render(
      <Toast message="テストメッセージ" onCancel={vi.fn()} onClose={vi.fn()} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });

  it('calls onCancel after animation when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <Toast
        message="テストメッセージ"
        onCancel={onCancel}
        onClose={vi.fn()}
      />,
    );

    const cancelButton = screen.getByText('キャンセル');
    fireEvent.click(cancelButton);

    expect(onCancel).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onClose after duration elapses', () => {
    const onClose = vi.fn();
    render(
      <Toast message="テストメッセージ" onCancel={vi.fn()} onClose={onClose} />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respects custom duration', () => {
    const onClose = vi.fn();
    render(
      <Toast
        message="テストメッセージ"
        onCancel={vi.fn()}
        onClose={onClose}
        duration={2000}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cleans up timers on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Toast message="テストメッセージ" onCancel={vi.fn()} onClose={onClose} />,
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
