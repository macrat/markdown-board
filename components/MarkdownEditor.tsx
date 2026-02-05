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

export default function MarkdownEditor({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const router = useRouter();

  const initEditor = useCallback(async (initialContent: string) => {
    if (!editorRef.current || editorInstanceRef.current) return;

    try {
      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Connect to WebSocket server for collaborative editing
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      const wsPort = process.env.NODE_ENV === 'production' ? window.location.port || '80' : '1234';
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
  }, [pageId]);

  const handleContentChange = useCallback(async (content: string) => {
    if (!page) return;
    
    // Debounced save
    setIsSaving(true);
    
    try {
      await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });
    } catch (error) {
      console.error('Failed to save content:', error);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [page, pageId, title]);

  const fetchPage = useCallback(async () => {
    try {
      const response = await fetch(`/api/pages/${pageId}`);
      if (response.ok) {
        const data = await response.json();
        setPage(data);
        setTitle(data.title);
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
      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
      }
    };
  }, [fetchPage]);

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    
    if (!page) return;
    
    try {
      await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle,
          content: page.content,
        }),
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  };

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
          <div className="flex justify-between items-center mb-4">
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
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full text-3xl font-bold border-none outline-none"
            style={{
              backgroundColor: 'transparent',
              color: '#574a46',
            }}
            placeholder="Page title..."
          />
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
