import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';
import { extractTitle } from '@/lib/utils';

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

        // Update browser tab title synchronized with save debounce
        const title = extractTitle(content);
        document.title =
          title === 'Untitled' ? 'Markdown Board' : `${title} - Markdown Board`;

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
                  ? '変更を反映できませんでした: コンテンツが大きすぎます（上限: 10MB）'
                  : '変更を反映できませんでした',
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
            showSaveError('変更を反映できませんでした');
          }
        }
      }, 1000);
    },
    [pageId, showSaveError],
  );

  return { saveError, handleContentChange };
}
