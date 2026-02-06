'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import type { Page } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logResponseError } from '@/lib/api';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import '../app/milkdown.css';

// Timeout for waiting for Yjs sync to complete (in milliseconds)
const SYNC_TIMEOUT_MS = 2000;

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const pageRef = useRef<Page | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Keep pageRef in sync with page state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
    async (content: string) => {
      if (!pageRef.current) return;

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
        }
      }, 1000);
    },
    [pageId, showSaveError],
  );

  const initEditor = useCallback(
    async (initialContent: string) => {
      if (!editorRef.current) return;

      // Prevent double initialization
      if (editorInstanceRef.current) {
        logger.log('[Editor] Editor already initialized, skipping');
        return;
      }

      logger.log(
        '[Editor] Initializing editor with SQLite content length:',
        initialContent?.length || 0,
      );

      try {
        // Create Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Connect to WebSocket server for collaborative editing
        const wsProtocol =
          window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        // NEXT_PUBLIC_WS_PORT (optional): public env var to override the default
        // y-websocket server port. If not set, port 1234 is used.
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '1234';
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;

        const provider = new WebsocketProvider(wsUrl, pageId, ydoc);
        providerRef.current = provider;

        logger.log(`[WebSocket] Connecting to room: ${pageId} at ${wsUrl}`);

        // Wait for initial sync to complete before deciding what to do
        await new Promise<void>((resolve) => {
          const handleSync = (isSynced: boolean) => {
            if (isSynced) {
              provider.off('sync', handleSync);
              if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
              }

              // Check if Yjs document is empty after sync
              const fragment = ydoc.getXmlFragment('prosemirror');
              const isEmpty = fragment.length === 0;

              logger.log(
                '[Yjs] Sync complete. Fragment isEmpty:',
                isEmpty,
                'initialContent length:',
                initialContent?.length || 0,
              );

              // If Yjs doc is empty AND we have SQLite content, populate Yjs doc directly
              if (isEmpty && initialContent) {
                logger.log(
                  '[Yjs] Populating empty Yjs document with SQLite content',
                );
                // Import the markdown content into the Yjs document
                // The collab plugin will convert markdown to ProseMirror doc structure
                // For now, we'll use the defaultValueCtx approach but need to ensure
                // it happens before collab syncs again
                logger.log('[Yjs] Direct Yjs population - fragment created');
              } else if (!isEmpty) {
                logger.log(
                  '[Yjs] Yjs document has content from another client, ignoring SQLite',
                );
              }

              resolve();
            }
          };

          provider.on('sync', handleSync);

          // Timeout fallback in case sync takes too long
          syncTimeoutRef.current = setTimeout(() => {
            syncTimeoutRef.current = null;
            provider.off('sync', handleSync);
            logger.log('[Yjs] Sync timeout, assuming empty document');
            resolve();
          }, SYNC_TIMEOUT_MS);
        });

        // Determine if we should use SQLite content
        const fragment = ydoc.getXmlFragment('prosemirror');
        const shouldUseSQLiteContent =
          fragment.length === 0 && !!initialContent;

        const editor = await Editor.make()
          .config((ctx) => {
            ctx.set(rootCtx, editorRef.current!);

            // Set initial content from SQLite if Yjs document is empty
            if (shouldUseSQLiteContent) {
              logger.log(
                '[Editor] Setting defaultValueCtx with SQLite content',
              );
              ctx.set(defaultValueCtx, initialContent);
            } else {
              logger.log(
                '[Editor] NOT setting defaultValueCtx (using Yjs content or empty)',
              );
            }

            // Listen to changes
            ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
              handleContentChange(markdown);
            });
          })
          .use(commonmark)
          .use(listener)
          .use(collab)
          .config((ctx) => {
            // Configure collab service AFTER loading the plugin
            const collabService = ctx.get(collabServiceCtx);
            collabService.bindDoc(ydoc);
            collabService.setAwareness(provider.awareness);
          })
          .create();

        // Connect the collab service AFTER editor is fully created
        // This is critical - calling connect() before the editor is ready will fail
        editor.action((ctx) => {
          ctx.get(collabServiceCtx).connect();
        });

        editorInstanceRef.current = editor;
      } catch (error) {
        logger.error('Failed to initialize editor:', error);
      }
    },
    [pageId, handleContentChange],
  );

  useEffect(() => {
    // Fetch page data and initialize editor - only once on mount
    let isMounted = true;

    const fetchPage = async () => {
      try {
        const response = await fetch(`/api/pages/${pageId}`);
        if (!response.ok) {
          await logResponseError('Editor FetchPage', response);
          if (isMounted) router.push('/');
          return;
        }

        const data = await response.json();
        if (!isMounted) return;

        setPage(data);
        setLoading(false);

        // Initialize editor after page is loaded
        // Small delay to ensure DOM is ready
        initTimeoutRef.current = setTimeout(() => {
          initTimeoutRef.current = null;
          if (isMounted) {
            initEditor(data.content);
          }
        }, 100);
      } catch (error) {
        logger.error('[Editor FetchPage] Network error:', error);
        if (isMounted) router.push('/');
      }
    };

    fetchPage();

    return () => {
      isMounted = false;

      // Cleanup
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (saveErrorTimeoutRef.current) {
        clearTimeout(saveErrorTimeoutRef.current);
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, [pageId, router, initEditor]);

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
