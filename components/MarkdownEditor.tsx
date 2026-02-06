'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePageData } from '@/hooks/usePageData';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useCollaborativeEditor } from '@/hooks/useCollaborativeEditor';
import '../app/milkdown.css';

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInitializedRef = useRef(false);
  const router = useRouter();

  const handleNotFound = useCallback(() => {
    router.push('/');
  }, [router]);

  const { page, loading } = usePageData(pageId, handleNotFound);
  const {
    isSaving,
    saveError,
    handleContentChange,
    cleanup: cleanupSave,
  } = useAutoSave(pageId);
  const { initEditor, cleanup: cleanupEditor } = useCollaborativeEditor(
    pageId,
    handleContentChange,
  );

  // Initialize editor when page data arrives
  useEffect(() => {
    if (page && editorRef.current && !editorInitializedRef.current) {
      editorInitializedRef.current = true;
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (editorRef.current) {
          initEditor(editorRef.current, page.content);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [page, initEditor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupEditor();
      cleanupSave();
    };
  }, [cleanupEditor, cleanupSave]);

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

      {/* 保存中表示 - 右下に控えめに表示 */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 text-xs px-3 py-1.5 rounded-full transition-opacity duration-300"
        style={{
          color: '#574a46',
          backgroundColor: 'rgba(245, 234, 230, 0.9)',
          opacity: isSaving ? 0.8 : 0,
          pointerEvents: 'none',
        }}
      >
        保存中...
      </div>

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
