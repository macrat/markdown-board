import { useCallback, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import { logger } from '@/lib/logger';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Timeout for waiting for Yjs sync to complete (in milliseconds)
const SYNC_TIMEOUT_MS = 2000;

export function useCollaborativeEditor(
  pageId: string,
  onContentChange: (content: string) => void,
) {
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const initEditor = useCallback(
    async (editorElement: HTMLDivElement, initialContent: string) => {
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
          let resolved = false;

          const onResolved = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };

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
                logger.log('[Yjs] Direct Yjs population - fragment created');
              } else if (!isEmpty) {
                logger.log(
                  '[Yjs] Yjs document has content from another client, ignoring SQLite',
                );
              }

              onResolved();
            }
          };

          provider.on('sync', handleSync);

          // Timeout fallback in case sync takes too long
          setTimeout(() => {
            provider.off('sync', handleSync);
            logger.log('[Yjs] Sync timeout, assuming empty document');
            onResolved();
          }, SYNC_TIMEOUT_MS);
        });

        // Determine if we should use SQLite content
        const fragment = ydoc.getXmlFragment('prosemirror');
        const shouldUseSQLiteContent =
          fragment.length === 0 && !!initialContent;

        const editor = await Editor.make()
          .config((ctx) => {
            ctx.set(rootCtx, editorElement);

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
              onContentChange(markdown);
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
    [pageId, onContentChange],
  );

  const cleanup = useCallback(() => {
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
  }, []);

  return { initEditor, cleanup };
}
