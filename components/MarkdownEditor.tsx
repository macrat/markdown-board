'use client';

import { useEffect } from 'react';
import { useCollabEditor } from '@/hooks/useCollabEditor';
import '../app/milkdown.css';

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const { loading, peerCount, wsConnected, editorRef } =
    useCollabEditor(pageId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: suppress browser save dialog
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }

      // Escape: unfocus from editor
      if (e.key === 'Escape') {
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLElement &&
          editorRef.current?.contains(activeElement)
        ) {
          activeElement.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorRef]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--foreground)' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Indicators container (fixed, top-right) */}
      {(!wsConnected || peerCount > 0) && (
        <div className="indicators-container">
          {!wsConnected && (
            <div
              role="status"
              aria-live="assertive"
              aria-label="サーバーとの接続が切れています。編集内容は保持され、再接続時に自動で同期されます"
              title="編集内容は保持され、再接続時に自動で同期されます"
              className="connection-status-indicator"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              オフライン（再接続時に同期）
            </div>
          )}
          {peerCount > 0 && (
            <div
              role="status"
              aria-live="polite"
              aria-label={`他に${peerCount}人が接続中`}
              title={`他に${peerCount}人が接続中`}
              className="peer-count-indicator"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {peerCount}
              <span aria-hidden="true">人</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <div
          ref={editorRef}
          className="milkdown max-w-4xl mx-auto"
          style={{ padding: '0 1rem' }}
        />
      </div>
    </div>
  );
}
