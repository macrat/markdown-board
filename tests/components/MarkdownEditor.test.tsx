// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MarkdownEditor from '@/components/MarkdownEditor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCollabEditor', () => ({
  useCollabEditor: vi.fn(() => ({
    loading: false,
    error: null,
    readOnly: false,
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
    error: null,
    readOnly: false,
    peerCount: 0,
    wsConnected: true,
    editorRef: { current: null },
  });
});

describe('MarkdownEditor', () => {
  it('shows loading state when loading is true', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: true,
      error: null,
      readOnly: false,
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

  it('shows not-found error message', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: 'not-found',
      readOnly: false,
      peerCount: 0,
      wsConnected: true,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('ページが見つかりません')).toBeTruthy();
    expect(screen.getByText('ホームに戻る')).toBeTruthy();
  });

  it('shows network-error message', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: 'network-error',
      readOnly: false,
      peerCount: 0,
      wsConnected: true,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('接続に失敗しました')).toBeTruthy();
    expect(screen.getByText('ホームに戻る')).toBeTruthy();
  });

  it('shows peer count when peerCount > 0', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: null,
      readOnly: false,
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

  it('shows offline indicator when WebSocket is disconnected', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: null,
      readOnly: false,
      peerCount: 0,
      wsConnected: false,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    const offlineStatus = screen.getByLabelText(
      'サーバーとの接続が切れています。編集内容は保持され、再接続時に自動で同期されます',
    );
    expect(offlineStatus).toBeTruthy();
    expect(offlineStatus.textContent).toContain('オフライン');
    expect(offlineStatus.textContent).toContain('再接続時に同期');
  });

  it('does not show offline indicator when connected', () => {
    render(<MarkdownEditor pageId="page-1" />);
    expect(
      screen.queryByLabelText(
        'サーバーとの接続が切れています。編集内容は保持され、再接続時に自動で同期されます',
      ),
    ).toBeNull();
  });

  it('renders editor container with milkdown class', () => {
    const { container } = render(<MarkdownEditor pageId="page-1" />);
    const milkdown = container.querySelector('.milkdown');
    expect(milkdown).toBeTruthy();
    expect(milkdown?.tagName).toBe('DIV');
  });

  it('shows archive banner when readOnly is true', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: null,
      readOnly: true,
      peerCount: 0,
      wsConnected: true,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    expect(
      screen.getByText('アーカイブされているため編集できません'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'アーカイブを解除する' }),
    ).toBeTruthy();
  });

  it('does not show archive banner when readOnly is false', () => {
    render(<MarkdownEditor pageId="page-1" />);
    expect(
      screen.queryByText('アーカイブされているため編集できません'),
    ).toBeNull();
  });

  it('hides indicators when readOnly is true', () => {
    mockUseCollabEditor.mockReturnValue({
      loading: false,
      error: null,
      readOnly: true,
      peerCount: 3,
      wsConnected: false,
      editorRef: { current: null },
    });

    render(<MarkdownEditor pageId="page-1" />);
    expect(
      screen.queryByLabelText(
        'サーバーとの接続が切れています。編集内容は保持され、再接続時に自動で同期されます',
      ),
    ).toBeNull();
  });
});
