import { useEffect, useState, useRef } from 'react';
import { Editor, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import { logger } from '@/lib/logger';
import { usePageExists } from '@/hooks/usePageExists';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Timeout for waiting for Yjs sync to complete (in milliseconds)
const SYNC_TIMEOUT_MS = 500;

function buildWsUrl(): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname;
  const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '1234';
  return `${wsProtocol}//${wsHost}:${wsPort}`;
}

function waitForSync(
  provider: WebsocketProvider,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        provider.off('sync', handleSync);
        clearTimeout(timeout);
        logger.log('[Yjs] Sync complete');
        resolve();
      }
    };

    provider.on('sync', handleSync);

    const timeout = setTimeout(() => {
      provider.off('sync', handleSync);
      logger.log('[Yjs] Sync timeout, proceeding');
      resolve();
    }, timeoutMs);
  });
}

function createMilkdownEditor(
  container: HTMLElement,
  ydoc: Y.Doc,
  awareness: WebsocketProvider['awareness'],
): Promise<Editor> {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
    })
    .use(commonmark)
    .use(gfm)
    .use(collab)
    .config((ctx) => {
      const collabService = ctx.get(collabServiceCtx);
      collabService.bindDoc(ydoc);
      collabService.setAwareness(awareness);
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
}

function safeDestroy(
  resource: { destroy(): void } | null,
  label: string,
): void {
  if (!resource) return;
  try {
    resource.destroy();
  } catch (e) {
    logger.error(`[Editor] Error destroying ${label}`, e);
  }
}

export function useCollabEditor(pageId: string) {
  const [peerCount, setPeerCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const updatePeerCountRef = useRef<(() => void) | null>(null);
  const statusHandlerRef = useRef<((event: { status: string }) => void) | null>(
    null,
  );
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoFocusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const isInitializingRef = useRef(false);

  // Cleanup all collab resources stored in refs (editor -> provider -> ydoc)
  const cleanupResources = () => {
    safeDestroy(editorInstanceRef.current, 'editor');
    editorInstanceRef.current = null;

    if (providerRef.current) {
      if (updatePeerCountRef.current) {
        providerRef.current.awareness.off('change', updatePeerCountRef.current);
      }
      if (statusHandlerRef.current) {
        providerRef.current.off('status', statusHandlerRef.current);
      }
    }
    safeDestroy(providerRef.current, 'provider');
    providerRef.current = null;

    safeDestroy(ydocRef.current, 'ydoc');
    ydocRef.current = null;
  };

  const { loading } = usePageExists(pageId);

  // Track mounted state for cleanup (compatible with React 18+ strict mode)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize editor when page existence is confirmed
  useEffect(() => {
    if (loading) return;

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

      logger.log('[Editor] Initializing editor for page:', pageId);

      try {
        // Create Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Connect to WebSocket server for collaborative editing
        const wsUrl = buildWsUrl();

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

        // Track WebSocket connection status
        const handleStatus = (event: { status: string }) => {
          setWsConnected(event.status === 'connected');
        };
        statusHandlerRef.current = handleStatus;
        provider.on('status', handleStatus);

        logger.log(`[WebSocket] Connecting to room: ${pageId} at ${wsUrl}`);

        // Wait for initial sync to complete
        await waitForSync(provider, SYNC_TIMEOUT_MS);

        // Abort if component unmounted during sync wait
        if (!isMountedRef.current) {
          logger.log('[Editor] Component unmounted during sync, aborting');
          isInitializingRef.current = false;
          safeDestroy(provider, 'provider');
          safeDestroy(ydoc, 'ydoc');
          return;
        }

        const editor = await createMilkdownEditor(
          editorRef.current!,
          ydoc,
          provider.awareness,
        );

        // If component unmounted during initialization, clean up and bail out
        if (!isMountedRef.current) {
          logger.log(
            '[Editor] Component unmounted during editor creation, cleaning up',
          );
          isInitializingRef.current = false;
          safeDestroy(editor, 'editor');
          safeDestroy(provider, 'provider');
          safeDestroy(ydoc, 'ydoc');
          return;
        }

        // Connect the collab service AFTER editor is fully created
        editor.action((ctx) => {
          ctx.get(collabServiceCtx).connect();
        });

        editorInstanceRef.current = editor;

        // Auto-focus the editor if the Yjs doc is empty (blank page).
        // Skip on mobile viewports to avoid the soft keyboard covering the screen.
        const isMobile = window.innerWidth < 768;
        const fragment = ydoc.getXmlFragment('prosemirror');
        if (fragment.length === 0 && !isMobile) {
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
        cleanupResources();
      } finally {
        isInitializingRef.current = false;
      }
    };

    // Milkdown requires the container to be fully laid out before initialization.
    // useEffect fires after paint, but React may not have flushed the ref'd element yet.
    initTimeoutRef.current = setTimeout(() => {
      initTimeoutRef.current = null;
      if (isMountedRef.current) {
        initEditor();
      }
    }, 100);

    return () => {
      document.title = 'Markdown Board';
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (autoFocusTimerRef.current) {
        clearTimeout(autoFocusTimerRef.current);
      }
      cleanupResources();
    };
  }, [pageId, loading]);

  return { loading, peerCount, wsConnected, editorRef };
}
