import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';

export function useAutoSave(pageId: string) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSaveError = useCallback((message: string) => {
    setSaveError(message);
    if (saveErrorTimeoutRef.current) {
      clearTimeout(saveErrorTimeoutRef.current);
    }
    saveErrorTimeoutRef.current = setTimeout(() => {
      setSaveError(null);
      saveErrorTimeoutRef.current = null;
    }, 5000);
  }, []);

  const handleContentChange = useCallback(
    (content: string) => {
      logger.log(
        '[Editor] Content changed - length:',
        content.length,
        'preview:',
        content.substring(0, 50),
      );

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save by 1 second
      saveTimeoutRef.current = setTimeout(async () => {
        logger.log('[Editor] Saving content - length:', content.length);
        setIsSaving(true);

        try {
          const response = await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content,
            }),
          });

          if (!response.ok) {
            await logResponseError('Editor Save', response);
            showSaveError(
              response.status === 413
                ? '保存できませんでした: コンテンツが大きすぎます（上限: 10MB）'
                : '保存に失敗しました',
            );
          } else {
            if (saveErrorTimeoutRef.current) {
              clearTimeout(saveErrorTimeoutRef.current);
              saveErrorTimeoutRef.current = null;
            }
            setSaveError(null);
            logger.log(
              '[Editor] Save successful - content length:',
              content.length,
            );
          }
        } catch (error) {
          logger.error('[Editor Save] Network error:', error);
          showSaveError('保存に失敗しました');
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [pageId, showSaveError],
  );

  const cleanup = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (saveErrorTimeoutRef.current) {
      clearTimeout(saveErrorTimeoutRef.current);
    }
  }, []);

  return { isSaving, saveError, handleContentChange, cleanup };
}
