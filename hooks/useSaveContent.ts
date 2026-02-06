import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';

export function useSaveContent(pageId: string) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (saveErrorTimeoutRef.current) {
        clearTimeout(saveErrorTimeoutRef.current);
      }
    };
  }, []);

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

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

        logger.log('[Editor] Saving content - length:', content.length);

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
            if (isMountedRef.current) {
              showSaveError(
                response.status === 413
                  ? '保存できませんでした: コンテンツが大きすぎます（上限: 10MB）'
                  : '保存に失敗しました',
              );
            }
          } else {
            if (isMountedRef.current) {
              if (saveErrorTimeoutRef.current) {
                clearTimeout(saveErrorTimeoutRef.current);
                saveErrorTimeoutRef.current = null;
              }
              setSaveError(null);
            }
            logger.log(
              '[Editor] Save successful - content length:',
              content.length,
            );
          }
        } catch (error) {
          logger.error('[Editor Save] Network error:', error);
          if (isMountedRef.current) {
            showSaveError('保存に失敗しました');
          }
        }
      }, 1000);
    },
    [pageId, showSaveError],
  );

  return { saveError, handleContentChange };
}
