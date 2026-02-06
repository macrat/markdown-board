'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import type { Page } from '@/lib/types';
import { logger } from '@/lib/logger';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import '../app/milkdown.css';

// Timeout for waiting for Yjs sync to complete (in milliseconds)
const SYNC_TIMEOUT_MS = 2000;

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const pageRef = useRef<Page | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updatePeerCountRef = useRef<(() => void) | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isInitializingRef = useRef(false);
  const router = useRouter();

  // Keep pageRef in sync with page state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
            logger.error('[Editor] Save failed with status:', response.status);
          } else {
            logger.log(
              '[Editor] Save successful - content length:',
              content.length,
            );
          }
        } catch (error) {
          logger.error('Failed to save content:', error);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [pageId],
  );

  const initEditor = useCallback(
    async (initialContent: string) => {
      if (!editorRef.current) return;

      // Prevent double initialization
      if (editorInstanceRef.current || isInitializingRef.current) {
        logger.log(
          '[Editor] Editor already initialized or initializing, skipping',
        );
        return;
      }
      isInitializingRef.current = true;

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

        // Track peer count via Awareness API
        const updatePeerCount = () => {
          const states = provider.awareness.getStates();
          setPeerCount(Math.max(0, states.size - 1));
        };
        updatePeerCountRef.current = updatePeerCount;
        provider.awareness.on('change', updatePeerCount);
        updatePeerCount();

        logger.log(`[WebSocket] Connecting to room: ${pageId} at ${wsUrl}`);

        // Wait for initial sync to complete before deciding what to do
        await new Promise<void>((resolve) => {
          const handleSync = (isSynced: boolean) => {
            if (isSynced) {
              provider.off('sync', handleSync);

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
            provider.off('sync', handleSync);
            logger.log('[Yjs] Sync timeout, assuming empty document');
            resolve();
          }, SYNC_TIMEOUT_MS);
        });

        // Abort if component unmounted during sync wait
        if (!isMountedRef.current) {
          logger.log('[Editor] Component unmounted during sync, aborting');
          isInitializingRef.current = false;
          return;
        }

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
      } finally {
        isInitializingRef.current = false;
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
          if (isMounted) {
            initEditor(data.content);
          }
        }, 100);
      } catch (error) {
        logger.error('Failed to fetch page:', error);
        if (isMounted) router.push('/');
      }
    };

    fetchPage();

    return () => {
      isMounted = false;
      isMountedRef.current = false;

      // Cleanup: destroy in reverse dependency order (editor → provider → ydoc)
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
      if (providerRef.current) {
        if (updatePeerCountRef.current) {
          providerRef.current.awareness.off(
            'change',
            updatePeerCountRef.current,
          );
        }
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
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
      <div className="h-screen p-8 overflow-auto">
        <div ref={editorRef} className="milkdown max-w-4xl mx-auto" />
      </div>

      {/* 同時編集ユーザー数インジケーター - 右上に控えめに表示 */}
      <div
        role="status"
        aria-live="polite"
        aria-hidden={peerCount === 0}
        aria-label={`他に${peerCount}人が接続中`}
        className="peer-count-indicator"
        style={{
          opacity: peerCount > 0 ? 1 : 0,
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
    </div>
  );
}
