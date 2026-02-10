// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MarkdownEditor from '@/components/MarkdownEditor';

vi.mock('@/hooks/useCollabEditor', () => ({
  useCollabEditor: vi.fn(() => ({
    loading: false,
    peerCount: 0,
    wsConnected: true,
    editorRef: { current: null },
  })),
}));

vi.mock('@/app/milkdown.css', () => ({}));

const { useCollabEditor } = await import('@/hooks/useCollabEditor');
const mockUseCollabEditor = vi.mocked(useCollabEditor);

beforeEach(() => {
  cleanup();
  mockUseCollabEditor.mockReturnValue({
    loading: false,
    peerCount: 0,
    wsConnected: true,
    editorRef: { current: null },
  });
});

describe('MarkdownEditor', () => {
  it('shows loading state when loading is true', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: true,
      peerCount: 0,
      wsConnected: true,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    expect(screen.getByText('読み込み中...')).toBeTruthy();
  });

  it('shows editor area when loading is false', () => {
    const { container } = render(<MarkdownEditor pageId="page-1" />);
    expect(container.querySelector('.milkdown')).toBeTruthy();
  });

  it('shows peer count when peerCount > 0', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      peerCount: 3,
      wsConnected: true,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('3');
    expect(status.querySelector('svg')).toBeTruthy();
  });

  it('does not show peer count when peerCount is 0', () => {
    render(<MarkdownEditor pageId="page-1" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders home link with aria-label', () => {
    render(<MarkdownEditor pageId="page-1" />);
    const link = screen.getByLabelText('ページ一覧に戻る');
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('Markdown Board');
  });

  it('shows offline indicator when WebSocket is disconnected', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      peerCount: 0,
      wsConnected: false,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    const offlineStatus =
      screen.getByLabelText('サーバーとの接続が切れています');
    expect(offlineStatus).toBeTruthy();
    expect(offlineStatus.textContent).toContain('オフライン');
  });

  it('does not show offline indicator when connected', () => {
    render(<MarkdownEditor pageId="page-1" />);
    expect(
      screen.queryByLabelText('サーバーとの接続が切れています'),
    ).toBeNull();
  });

  it('renders editor container with milkdown class', () => {
    const { container } = render(<MarkdownEditor pageId="page-1" />);
    const milkdown = container.querySelector('.milkdown');
    expect(milkdown).toBeTruthy();
    expect(milkdown?.tagName).toBe('DIV');
  });
});
