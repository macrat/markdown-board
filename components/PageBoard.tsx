'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PageListItem as PageListItemType,
  ArchiveListItem,
} from '@/lib/types';
import Toast from './Toast';
import PageListItem from './PageListItem';
import { ArchiveIcon, UnarchiveIcon, PlusIcon } from './Icons';
import { usePageList } from '@/hooks/usePageList';
import { useArchives } from '@/hooks/useArchives';
import { useAnimatingItems } from '@/hooks/useAnimatingItems';
import { useArchiveToast } from '@/hooks/useArchiveToast';

type Tab = 'latest' | 'archive';

const SEARCH_VISIBLE_THRESHOLD = 5;

export default function PageBoard() {
  const [activeTab, setActiveTab] = useState<Tab>('latest');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const { pages, fetchPages, createPage, removePage, addPage, findPage } =
    usePageList();
  const {
    archives,
    fetchArchives,
    archivePage: archivePageApi,
    unarchivePage: unarchivePageApi,
    addArchive,
    removeArchive,
    findArchive,
  } = useArchives();
  const { startFadeOut, startFadeIn, clearAnimation, getItemOpacity } =
    useAnimatingItems();
  const { toast, showToast, hideToast } = useArchiveToast();

  const filteredPages = useMemo(() => {
    if (!searchQuery) return pages;
    const query = searchQuery.toLowerCase();
    return pages.filter((page) => page.title.toLowerCase().includes(query));
  }, [pages, searchQuery]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPages(), fetchArchives()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPages, fetchArchives]);

  const handleCreatePage = async () => {
    const id = await createPage();
    if (id) {
      router.push(`/page/${id}`);
    }
  };

  const handleArchivePage = useCallback(
    (id: string, title: string) => {
      hideToast();

      startFadeOut(id, async () => {
        const archivedAt = await archivePageApi(id);
        if (archivedAt !== null) {
          const archivedPage = findPage(id);
          if (archivedPage) {
            removePage(id);
            const newArchive: ArchiveListItem = {
              ...archivedPage,
              archived_at: archivedAt,
            };
            addArchive(newArchive);
          }
          showToast(id, title);
        }
        clearAnimation(id);
      });
    },
    [
      hideToast,
      startFadeOut,
      archivePageApi,
      findPage,
      removePage,
      addArchive,
      showToast,
      clearAnimation,
    ],
  );

  const handleCancelArchive = useCallback(async () => {
    const { pageId } = toast;
    hideToast();

    const archivedPage = findArchive(pageId);
    if (archivedPage) {
      const restoredPage: PageListItemType = {
        id: archivedPage.id,
        title: archivedPage.title,
        created_at: archivedPage.created_at,
        updated_at: archivedPage.updated_at,
      };
      addPage(restoredPage);
      removeArchive(pageId);
      startFadeIn(pageId);
    }

    const success = await unarchivePageApi(pageId);
    if (!success || !archivedPage) {
      await Promise.all([fetchPages(), fetchArchives()]);
    }
  }, [
    toast,
    hideToast,
    findArchive,
    addPage,
    removeArchive,
    startFadeIn,
    unarchivePageApi,
    fetchPages,
    fetchArchives,
  ]);

  const handleUnarchivePage = useCallback(
    (id: string) => {
      startFadeOut(id, async () => {
        const success = await unarchivePageApi(id);
        if (!success) {
          clearAnimation(id);
          return;
        }
        await Promise.all([fetchPages(), fetchArchives()]);
        startFadeIn(id);
      });
    },
    [
      startFadeOut,
      unarchivePageApi,
      clearAnimation,
      fetchPages,
      fetchArchives,
      startFadeIn,
    ],
  );

  if (loading) {
    return (
      <div style={{ color: '#574a46', padding: '20px' }}>読み込み中...</div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Tab Navigation */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(87, 74, 70, 0.2)',
          marginBottom: '24px',
        }}
      >
        <button
          id="tab-latest"
          role="tab"
          className="tab-button"
          tabIndex={activeTab === 'latest' ? 0 : -1}
          aria-selected={activeTab === 'latest'}
          aria-controls="tabpanel-latest"
          onClick={() => setActiveTab('latest')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              setActiveTab('archive');
              document.getElementById('tab-archive')?.focus();
            }
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'latest'
                ? '2px solid #c42776'
                : '2px solid transparent',
            color: activeTab === 'latest' ? '#c42776' : '#574a46',
            fontWeight: activeTab === 'latest' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '16px',
          }}
        >
          最新
        </button>
        <button
          id="tab-archive"
          role="tab"
          className="tab-button"
          tabIndex={activeTab === 'archive' ? 0 : -1}
          aria-selected={activeTab === 'archive'}
          aria-controls="tabpanel-archive"
          onClick={() => setActiveTab('archive')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              setActiveTab('latest');
              document.getElementById('tab-latest')?.focus();
            }
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'archive'
                ? '2px solid #c42776'
                : '2px solid transparent',
            color: activeTab === 'archive' ? '#c42776' : '#574a46',
            fontWeight: activeTab === 'archive' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '16px',
          }}
        >
          アーカイブ
        </button>
      </div>

      {/* Latest Tab Content */}
      {activeTab === 'latest' && (
        <div role="tabpanel" id="tabpanel-latest" aria-labelledby="tab-latest">
          {pages.length > SEARCH_VISIBLE_THRESHOLD && (
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ページを検索..."
                aria-label="ページを検索"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid rgba(87, 74, 70, 0.2)',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#574a46',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          {filteredPages.length === 0 ? (
            <p style={{ color: '#574a46', opacity: 0.7 }}>
              {searchQuery
                ? '一致するページが見つかりません。'
                : 'ページがありません。新しいページを作成しましょう。'}
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {filteredPages.map((page) => (
                <PageListItem
                  key={page.id}
                  dataTestId={`page-item-${page.id}`}
                  title={page.title}
                  timestamp={page.updated_at}
                  opacity={getItemOpacity(page.id)}
                  onNavigate={() => router.push(`/page/${page.id}`)}
                  navigateAriaLabel={`${page.title}を開く`}
                  onAction={() => handleArchivePage(page.id, page.title)}
                  actionAriaLabel="アーカイブする"
                  actionTitle="アーカイブ"
                  actionClassName="archive-button"
                  actionIcon={<ArchiveIcon />}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive Tab Content */}
      {activeTab === 'archive' && (
        <div
          role="tabpanel"
          id="tabpanel-archive"
          aria-labelledby="tab-archive"
        >
          <p
            style={{
              color: '#574a46',
              opacity: 0.4,
              fontSize: '12px',
              margin: '0 0 16px 0',
            }}
          >
            30日間保持されます
          </p>
          {archives.length === 0 ? (
            <p style={{ color: '#574a46', opacity: 0.7 }}>
              アーカイブされたページはありません。
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {archives.map((page) => (
                <PageListItem
                  key={page.id}
                  dataTestId={`archive-item-${page.id}`}
                  title={page.title}
                  timestamp={page.archived_at}
                  opacity={getItemOpacity(page.id)}
                  onAction={() => handleUnarchivePage(page.id)}
                  actionAriaLabel="アーカイブを解除する"
                  actionTitle="アーカイブを解除"
                  actionClassName="unarchive-button"
                  actionIcon={<UnarchiveIcon />}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleCreatePage}
        className="fab-button"
        aria-label="新しいページを作成"
        title="新しいページを作成"
        style={{
          position: 'fixed',
          bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          right: 'max(16px, calc(env(safe-area-inset-right, 0px) + 16px))',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#c42776',
          color: '#f5eae6',
          border: 'none',
          boxShadow: '0 4px 12px rgba(196, 39, 118, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          zIndex: 100,
        }}
      >
        <PlusIcon />
      </button>

      {/* Toast Notification */}
      {toast.visible && (
        <Toast
          message="アーカイブしました"
          onCancel={handleCancelArchive}
          onClose={hideToast}
        />
      )}
    </div>
  );
}
