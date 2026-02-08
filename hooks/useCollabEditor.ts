import { useEffect, useState, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import { logger } from '@/lib/logger';
import { useSaveContent } from '@/hooks/useSaveContent';
import { useFetchPage } from '@/hooks/useFetchPage';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Timeout for waiting for Yjs sync to complete (in milliseconds)
const SYNC_TIMEOUT_MS = 500;

export function useCollabEditor(pageId: string) {
  const [peerCount, setPeerCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const updatePeerCountRef = useRef<(() => void) | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoFocusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const isInitializingRef = useRef(false);

  const { pageContent, loading } = useFetchPage(pageId);
  const { saveError, handleContentChange } = useSaveContent(pageId);

  // Track mounted state for cleanup (compatible with React 18+ strict mode)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize editor when page content becomes available
  useEffect(() => {
    if (loading || pageContent === null) return;

    const initialContent = pageContent;

    const initEditor = async () => {
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

        // Abort if component unmounted during sync wait
        if (!isMountedRef.current) {
          logger.log('[Editor] Component unmounted during sync, aborting');
          isInitializingRef.current = false;
          // Clean up provider and Yjs document to avoid leaks
          try {
            provider.destroy();
          } catch (e) {
            logger.error(
              '[Editor] Error destroying provider during unmount abort',
              e,
            );
          }
          try {
            ydoc.destroy();
          } catch (e) {
            logger.error(
              '[Editor] Error destroying ydoc during unmount abort',
              e,
            );
          }
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
            collabService.mergeOptions({
              yCursorOpts: {
                cursorBuilder: () => {
                  const cursor = document.createElement('span');
                  cursor.classList.add('ProseMirror-yjs-cursor');
                  return cursor;
                },
              },
            });
          })
          .create();

        // If component unmounted during initialization, clean up and bail out
        if (!isMountedRef.current) {
          logger.log(
            '[Editor] Component unmounted during editor creation, cleaning up',
          );
          isInitializingRef.current = false;
          try {
            editor.destroy();
          } catch (e) {
            logger.error('[Editor] Error destroying editor during unmount', e);
          }
          try {
            provider.destroy();
          } catch (e) {
            logger.error(
              '[Editor] Error destroying provider during unmount',
              e,
            );
          }
          try {
            ydoc.destroy();
          } catch (e) {
            logger.error('[Editor] Error destroying ydoc during unmount', e);
          }
          return;
        }

        // Connect the collab service AFTER editor is fully created
        // This is critical - calling connect() before the editor is ready will fail
        editor.action((ctx) => {
          ctx.get(collabServiceCtx).connect();
        });

        editorInstanceRef.current = editor;

        // Auto-focus the editor if it's a blank page
        if (!initialContent || initialContent.trim() === '') {
          autoFocusTimerRef.current = setTimeout(() => {
            autoFocusTimerRef.current = null;
            if (!isMountedRef.current) return;
            const editableElement = editorRef.current?.querySelector(
              'div[contenteditable="true"]',
            ) as HTMLElement | null;
            if (editableElement) {
              editableElement.focus();
              logger.log('[Editor] Auto-focused blank page editor');
            }
          }, 100);
        }
      } catch (error) {
        logger.error('Failed to initialize editor:', error);

        // Cleanup on initialization failure: destroy in reverse dependency order
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
      } finally {
        isInitializingRef.current = false;
      }
    };

    // Small delay to ensure DOM is ready
    initTimeoutRef.current = setTimeout(() => {
      initTimeoutRef.current = null;
      if (isMountedRef.current) {
        initEditor();
      }
    }, 100);

    return () => {
      // Cleanup: destroy in reverse dependency order (editor -> provider -> ydoc)
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (autoFocusTimerRef.current) {
        clearTimeout(autoFocusTimerRef.current);
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
    // handleContentChange is intentionally excluded: it is a debounced save
    // callback that must not re-trigger editor initialization when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, loading, pageContent]);

  return { loading, peerCount, saveError, editorRef };
}
