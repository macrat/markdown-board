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
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: '#574a46' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="h-screen p-4 sm:p-8 overflow-auto">
        <div ref={editorRef} className="milkdown max-w-4xl mx-auto" />
      </div>

      {/* 接続状態・同時編集ユーザー数インジケーター - 右上に控えめに表示 */}
      {(!wsConnected || peerCount > 0) && (
        <div
          className="connection-status-area"
          style={{ pointerEvents: 'none' }}
        >
          {!wsConnected && (
            <div
              role="status"
              aria-live="assertive"
              aria-label="サーバーとの接続が切れています"
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
              オフライン
            </div>
          )}
          {peerCount > 0 && (
            <div
              role="status"
              aria-live="polite"
              aria-label={`他に${peerCount}人が接続中`}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
