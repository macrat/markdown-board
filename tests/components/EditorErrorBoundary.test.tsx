// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EditorErrorBoundary from '@/components/EditorErrorBoundary';

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const { logger } = await import('@/lib/logger');
const mockLoggerError = vi.mocked(logger.error);

function ThrowingChild() {
  throw new Error('Test editor crash');
}

function GoodChild() {
  return <div>Editor content</div>;
}

beforeEach(() => {
  cleanup();
  mockLoggerError.mockClear();
});

describe('EditorErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <EditorErrorBoundary>
        <GoodChild />
      </EditorErrorBoundary>,
    );
    expect(screen.getByText('Editor content')).toBeTruthy();
  });

  it('renders error UI when a child throws', () => {
    // Suppress React error boundary console output in test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EditorErrorBoundary>
        <ThrowingChild />
      </EditorErrorBoundary>,
    );

    expect(screen.getByText('エディタの読み込みに失敗しました')).toBeTruthy();

    spy.mockRestore();
  });

  it('shows reload and home buttons on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EditorErrorBoundary>
        <ThrowingChild />
      </EditorErrorBoundary>,
    );

    expect(screen.getByText('ページを再読み込み')).toBeTruthy();
    const homeLink = screen.getByText('ホームに戻る');
    expect(homeLink).toBeTruthy();
    expect(homeLink.getAttribute('href')).toBe('/');

    spy.mockRestore();
  });

  it('has role="alert" on the error container', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EditorErrorBoundary>
        <ThrowingChild />
      </EditorErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();

    spy.mockRestore();
  });

  it('logs the error to the logger', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EditorErrorBoundary>
        <ThrowingChild />
      </EditorErrorBoundary>,
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      'Editor error:',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    spy.mockRestore();
  });
});
