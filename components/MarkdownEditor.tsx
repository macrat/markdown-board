'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { collab, collabServiceCtx } from '@milkdown/plugin-collab';
import type { Page } from '@/lib/types';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import '../app/milkdown.css';

// Extract title from markdown content
function extractTitle(content: string): string {
  if (!content || content.trim() === '') {
    return 'Untitled';
  }
  
  const firstLine = content.split('\n')[0].trim();
  
  if (!firstLine) {
    return 'Untitled';
  }
  
  // If the first line is a heading, remove the # characters (and escaped versions)
  if (firstLine.startsWith('#') || firstLine.startsWith('\\#')) {
    // Remove escaped backslashes and heading markers
    return firstLine.replace(/^\\?#+\s*/, '').trim() || 'Untitled';
  }
  
  return firstLine;
}

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const pageRef = useRef<Page | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Keep pageRef in sync with page state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const handleContentChange = useCallback(async (content: string) => {
    if (!pageRef.current) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        await fetch(`/api/pages/${pageId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
          }),
        });
      } catch (error) {
        console.error('Failed to save content:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, [pageId]);

  const initEditor = useCallback(async (initialContent: string) => {
    if (!editorRef.current || editorInstanceRef.current) return;

    try {
      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Connect to WebSocket server for collaborative editing
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      const wsPort = '1234'; // WebSocket server always runs on port 1234
      const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
      
      const provider = new WebsocketProvider(wsUrl, pageId, ydoc);
      providerRef.current = provider;

      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorRef.current!);
          ctx.set(defaultValueCtx, initialContent);
          
          // Set up collaboration
          ctx.get(collabServiceCtx).bindDoc(ydoc);
          
          // Listen to changes
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            handleContentChange(markdown);
          });
        })
        .use(commonmark)
        .use(listener)
        .use(collab)
        .create();

      editorInstanceRef.current = editor;
    } catch (error) {
      console.error('Failed to initialize editor:', error);
    }
  }, [pageId, handleContentChange]);

  const fetchPage = useCallback(async () => {
    try {
      const response = await fetch(`/api/pages/${pageId}`);
      if (response.ok) {
        const data = await response.json();
        setPage(data);
        setLoading(false);
        
        // Initialize editor after page is loaded
        setTimeout(() => initEditor(data.content), 100);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to fetch page:', error);
      router.push('/');
    }
  }, [pageId, router, initEditor]);

  useEffect(() => {
    fetchPage();
    
    return () => {
      // Cleanup
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, [fetchPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: '#574a46' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b" style={{ borderColor: 'rgba(87, 74, 70, 0.2)' }}>
        <div className="max-w-5xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded transition-colors text-sm"
              style={{
                backgroundColor: '#f5eae6',
                color: '#574a46',
                border: '1px solid #574a46',
              }}
            >
              ← Back
            </button>
            <div className="flex items-center gap-4">
              {isSaving && (
                <span className="text-sm" style={{ color: '#574a46', opacity: 0.6 }}>
                  Saving...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div 
          ref={editorRef}
          className="milkdown"
        />
      </div>
    </div>
  );
}
