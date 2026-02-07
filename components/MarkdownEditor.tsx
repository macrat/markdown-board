'use client';

import { useCollabEditor } from '@/hooks/useCollabEditor';
import '../app/milkdown.css';

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const { loading, peerCount, saveError, editorRef } = useCollabEditor(pageId);

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

      {/* 同時編集ユーザー数インジケーター - 右上に控えめに表示 */}
      {peerCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`他に${peerCount}人が接続中`}
          className="peer-count-indicator"
          style={{
            pointerEvents: 'none',
          }}
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

      {/* 保存エラー表示 */}
      {saveError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm px-5 py-3 rounded-lg shadow-lg transition-opacity duration-300"
          style={{
            color: '#f5eae6',
            backgroundColor: '#574a46',
          }}
        >
          {saveError}
        </div>
      )}
    </div>
  );
}
