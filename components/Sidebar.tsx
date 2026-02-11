'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
const RELATIVE_TIME_UPDATE_INTERVAL_MS = 30_000;

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('latest');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const params = useParams();
  const currentPageId = params?.id as string | undefined;

  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      RELATIVE_TIME_UPDATE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

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
      try {
        await Promise.all([fetchPages(), fetchArchives()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchPages, fetchArchives]);

  // Refetch page list when navigating to a different page
  const initialPageIdRef = useRef(currentPageId);
  useEffect(() => {
    if (currentPageId && currentPageId !== initialPageIdRef.current) {
      initialPageIdRef.current = currentPageId;
      fetchPages();
      fetchArchives();
    }
  }, [currentPageId, fetchPages, fetchArchives]);

  const handleCreatePage = async () => {
    const id = await createPage();
    if (id) {
      router.push(`/page/${id}`);
      onNavigate?.();
    }
  };

  const handleNavigate = useCallback(
    (id: string) => {
      router.push(`/page/${id}`);
      onNavigate?.();
    },
    [router, onNavigate],
  );

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

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Create button */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={handleCreatePage}
          className="create-page-button"
          aria-label="新しいページを作成"
          title="新しいページを作成"
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s ease',
          }}
        >
          <PlusIcon />
          作成
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(var(--foreground-rgb), 0.2)',
          margin: '12px 16px 0',
          flexShrink: 0,
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
                ? '2px solid var(--accent)'
                : '2px solid transparent',
            color:
              activeTab === 'latest' ? 'var(--accent)' : 'var(--foreground)',
            fontWeight: activeTab === 'latest' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '14px',
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
                ? '2px solid var(--accent)'
                : '2px solid transparent',
            color:
              activeTab === 'archive' ? 'var(--accent)' : 'var(--foreground)',
            fontWeight: activeTab === 'archive' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontSize: '14px',
          }}
        >
          アーカイブ
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ color: 'var(--foreground)', padding: '20px' }}>
            読み込み中...
          </div>
        ) : (
          <>
            {/* Latest Tab Content */}
            {activeTab === 'latest' && (
              <div
                role="tabpanel"
                id="tabpanel-latest"
                aria-labelledby="tab-latest"
              >
                {pages.length > SEARCH_VISIBLE_THRESHOLD && (
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ページを検索..."
                      aria-label="ページを検索"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid rgba(var(--foreground-rgb), 0.2)',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        color: 'var(--foreground)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
                {filteredPages.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--foreground)',
                      opacity: 0.7,
                      fontSize: '13px',
                    }}
                  >
                    {searchQuery
                      ? '一致するページが見つかりません。'
                      : 'ページがありません。新しいページを作成しましょう。'}
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {filteredPages.map((page) => (
                      <PageListItem
                        key={page.id}
                        dataTestId={`page-item-${page.id}`}
                        title={page.title}
                        timestamp={page.updated_at}
                        now={now}
                        opacity={getItemOpacity(page.id)}
                        active={page.id === currentPageId}
                        onNavigate={() => handleNavigate(page.id)}
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
                    color: 'var(--foreground)',
                    opacity: 0.4,
                    fontSize: '12px',
                    margin: '0 0 12px 0',
                  }}
                >
                  30日間保持されます
                </p>
                {archives.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--foreground)',
                      opacity: 0.7,
                      fontSize: '13px',
                    }}
                  >
                    アーカイブされたページはありません。
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {archives.map((page) => (
                      <PageListItem
                        key={page.id}
                        dataTestId={`archive-item-${page.id}`}
                        title={page.title}
                        timestamp={page.archived_at}
                        now={now}
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
          </>
        )}
      </div>

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
