// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import PageBoard from '@/components/PageBoard';

vi.mock('@/hooks/usePageList', () => ({ usePageList: vi.fn() }));
vi.mock('@/hooks/useArchives', () => ({ useArchives: vi.fn() }));
vi.mock('@/hooks/useAnimatingItems', () => ({ useAnimatingItems: vi.fn() }));
vi.mock('@/hooks/useArchiveToast', () => ({ useArchiveToast: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

const { usePageList } = await import('@/hooks/usePageList');
const { useArchives } = await import('@/hooks/useArchives');
const { useAnimatingItems } = await import('@/hooks/useAnimatingItems');
const { useArchiveToast } = await import('@/hooks/useArchiveToast');
const { useRouter } = await import('next/navigation');

const mockUsePageList = vi.mocked(usePageList);
const mockUseArchives = vi.mocked(useArchives);
const mockUseAnimatingItems = vi.mocked(useAnimatingItems);
const mockUseArchiveToast = vi.mocked(useArchiveToast);
const mockUseRouter = vi.mocked(useRouter);

const now = Date.now();
const fiveMinutesAgo = now - 5 * 60 * 1000;

function makePages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `page-${i + 1}`,
    title: `Page ${i + 1}`,
    created_at: fiveMinutesAgo,
    updated_at: fiveMinutesAgo,
  }));
}

const defaultPageListReturn = {
  pages: makePages(3),
  fetchPages: vi.fn().mockResolvedValue(undefined),
  createPage: vi.fn().mockResolvedValue('new-page-id'),
  removePage: vi.fn(),
  addPage: vi.fn(),
  findPage: vi.fn(),
};

const defaultArchivesReturn = {
  archives: [] as ReturnType<typeof useArchives>['archives'],
  fetchArchives: vi.fn().mockResolvedValue(undefined),
  archivePage: vi.fn().mockResolvedValue(Date.now()),
  unarchivePage: vi.fn().mockResolvedValue(true),
  addArchive: vi.fn(),
  removeArchive: vi.fn(),
  findArchive: vi.fn(),
};

const defaultAnimatingReturn = {
  startFadeOut: vi.fn((_, cb: () => void) => cb()),
  startFadeIn: vi.fn(),
  clearAnimation: vi.fn(),
  getItemOpacity: vi.fn().mockReturnValue(1),
};

const defaultToastReturn = {
  toast: { visible: false, pageId: '', pageTitle: '' },
  showToast: vi.fn(),
  hideToast: vi.fn(),
};

const mockPush = vi.fn();

function setupMocks(overrides?: {
  pageList?: Partial<typeof defaultPageListReturn>;
  archives?: Partial<typeof defaultArchivesReturn>;
  animating?: Partial<typeof defaultAnimatingReturn>;
  toast?: Partial<typeof defaultToastReturn>;
}) {
  mockUsePageList.mockReturnValue({
    ...defaultPageListReturn,
    ...overrides?.pageList,
  });
  mockUseArchives.mockReturnValue({
    ...defaultArchivesReturn,
    ...overrides?.archives,
  });
  mockUseAnimatingItems.mockReturnValue({
    ...defaultAnimatingReturn,
    ...overrides?.animating,
  });
  mockUseArchiveToast.mockReturnValue({
    ...defaultToastReturn,
    ...overrides?.toast,
  });
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  setupMocks();
});

describe('PageBoard', () => {
  // ==================== Loading / Empty States ====================

  it('shows loading state', async () => {
    const fetchPages = vi.fn(() => new Promise<void>(() => {}));
    const fetchArchives = vi.fn(() => new Promise<void>(() => {}));
    setupMocks({
      pageList: { fetchPages },
      archives: { fetchArchives },
    });

    await act(async () => {
      render(<PageBoard />);
    });

    expect(screen.getByText('読み込み中...')).toBeTruthy();
  });

  it('shows empty state when no pages exist', async () => {
    setupMocks({ pageList: { pages: [] } });

    await act(async () => {
      render(<PageBoard />);
    });
    // Wait for loading to complete
    await act(async () => {});

    expect(
      screen.getByText('ページがありません。新しいページを作成しましょう。'),
    ).toBeTruthy();
  });

  // ==================== Tab Switching ====================

  it('switches between tabs correctly', async () => {
    setupMocks({
      archives: {
        archives: [
          {
            id: 'arch-1',
            title: 'Archived Page',
            created_at: fiveMinutesAgo,
            updated_at: fiveMinutesAgo,
            archived_at: now,
          },
        ],
      },
    });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // "最新" tab is active by default
    const recentTab = screen.getByRole('tab', { name: '最新' });
    expect(recentTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByText('Page 1')).toBeTruthy();

    // Switch to archive tab
    const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
    await act(async () => {
      fireEvent.click(archiveTab);
    });

    expect(archiveTab.getAttribute('aria-selected')).toBe('true');
    expect(recentTab.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('Archived Page')).toBeTruthy();

    // Switch back to latest tab
    await act(async () => {
      fireEvent.click(recentTab);
    });

    expect(recentTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Page 1')).toBeTruthy();
  });

  it('supports arrow key navigation between tabs (WAI-ARIA)', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const recentTab = screen.getByRole('tab', { name: '最新' });
    const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });

    // "最新" tab should have tabIndex=0, "アーカイブ" should have tabIndex=-1
    expect(recentTab.getAttribute('tabindex')).toBe('0');
    expect(archiveTab.getAttribute('tabindex')).toBe('-1');

    // ArrowRight switches to archive tab
    await act(async () => {
      fireEvent.keyDown(recentTab, { key: 'ArrowRight' });
    });

    expect(archiveTab.getAttribute('aria-selected')).toBe('true');
    expect(archiveTab.getAttribute('tabindex')).toBe('0');
    expect(recentTab.getAttribute('tabindex')).toBe('-1');

    // ArrowLeft switches back to latest tab
    await act(async () => {
      fireEvent.keyDown(archiveTab, { key: 'ArrowLeft' });
    });

    expect(recentTab.getAttribute('aria-selected')).toBe('true');
    expect(recentTab.getAttribute('tabindex')).toBe('0');
    expect(archiveTab.getAttribute('tabindex')).toBe('-1');
  });

  // ==================== Archive / Unarchive ====================

  it('archives a page and moves it to archive tab', async () => {
    const removePage = vi.fn();
    const addArchive = vi.fn();
    const showToast = vi.fn();
    const hideToast = vi.fn();
    const archivePageApi = vi.fn().mockResolvedValue(now);
    const findPage = vi.fn().mockReturnValue({
      id: 'page-1',
      title: 'Page 1',
      created_at: fiveMinutesAgo,
      updated_at: fiveMinutesAgo,
    });
    const startFadeOut = vi.fn((_id: string, cb: () => void) => cb());

    setupMocks({
      pageList: { pages: makePages(1), removePage, findPage },
      archives: { archivePage: archivePageApi, addArchive },
      animating: { startFadeOut },
      toast: { showToast, hideToast },
    });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // Click archive button
    const archiveButton = screen.getByLabelText('アーカイブする');
    await act(async () => {
      fireEvent.click(archiveButton);
    });

    expect(hideToast).toHaveBeenCalled();
    expect(startFadeOut).toHaveBeenCalledWith('page-1', expect.any(Function));
    expect(archivePageApi).toHaveBeenCalledWith('page-1');
    expect(removePage).toHaveBeenCalledWith('page-1');
    expect(addArchive).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('page-1', 'Page 1');
  });

  it('shows toast notification on archive with cancel', async () => {
    setupMocks({
      toast: {
        toast: { visible: true, pageId: 'page-1', pageTitle: 'Page 1' },
      },
    });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    expect(screen.getByText('アーカイブしました')).toBeTruthy();
    expect(screen.getByText('キャンセル')).toBeTruthy();
  });

  // ==================== Create Page via FAB ====================

  it('creates new page via FAB button', async () => {
    const createPage = vi.fn().mockResolvedValue('new-page-id');
    setupMocks({ pageList: { createPage } });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const fabButton = screen.getByLabelText('新しいページを作成');
    await act(async () => {
      fireEvent.click(fabButton);
    });

    expect(createPage).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/page/new-page-id');
  });

  // ==================== Search ====================

  it('shows search field when more than 5 pages exist and filters by title', async () => {
    setupMocks({ pageList: { pages: makePages(6) } });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const searchInput = screen.getByLabelText('ページを検索');
    expect(searchInput).toBeTruthy();

    // Type to filter
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Page 1' } });
    });

    // "Page 1" and "Page 10" would match "Page 1", but we only have 6 pages
    expect(screen.getByText('Page 1')).toBeTruthy();
    expect(screen.queryByText('Page 3')).toBeNull();
  });

  it('shows no-results message when search matches nothing', async () => {
    setupMocks({ pageList: { pages: makePages(6) } });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const searchInput = screen.getByLabelText('ページを検索');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    });

    expect(screen.getByText('一致するページが見つかりません。')).toBeTruthy();
  });

  it('hides search field when 5 or fewer pages exist', async () => {
    setupMocks({ pageList: { pages: makePages(5) } });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    expect(screen.queryByLabelText('ページを検索')).toBeNull();
  });

  // ==================== Timestamps ====================

  it('shows proper timestamps on page list', async () => {
    setupMocks({
      pageList: {
        pages: [
          {
            id: 'page-1',
            title: 'Timestamp Test',
            created_at: fiveMinutesAgo,
            updated_at: fiveMinutesAgo,
          },
        ],
      },
    });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    expect(screen.getByText('Timestamp Test')).toBeTruthy();
    expect(screen.getByText('5分前')).toBeTruthy();
  });

  // ==================== ARIA Attributes ====================

  it('has proper ARIA roles and attributes', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // tablist
    expect(screen.getByRole('tablist')).toBeTruthy();

    // tabs
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);

    // tab aria-controls
    expect(tabs[0].getAttribute('aria-controls')).toBe('tabpanel-latest');
    expect(tabs[1].getAttribute('aria-controls')).toBe('tabpanel-archive');

    // FAB aria-label
    expect(screen.getByLabelText('新しいページを作成')).toBeTruthy();
  });

  // ==================== Archive Tab Empty State ====================

  it('shows archive empty state', async () => {
    setupMocks({ archives: { archives: [] } });

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // Switch to archive tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'アーカイブ' }));
    });

    expect(
      screen.getByText('アーカイブされたページはありません。'),
    ).toBeTruthy();
  });

  it('shows 30-day retention message on archive tab', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // Switch to archive tab
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'アーカイブ' }));
    });

    expect(screen.getByText('30日間保持されます')).toBeTruthy();
  });

  // ==================== Page Navigation ====================

  it('navigates to page when page item is clicked', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // Click on page item
    const pageItem = screen.getByText('Page 1');
    await act(async () => {
      fireEvent.click(pageItem);
    });

    expect(mockPush).toHaveBeenCalledWith('/page/page-1');
  });

  it('navigates to different pages independently', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    // Click first page
    await act(async () => {
      fireEvent.click(screen.getByText('Page 1'));
    });
    expect(mockPush).toHaveBeenCalledWith('/page/page-1');

    mockPush.mockClear();

    // Click second page
    await act(async () => {
      fireEvent.click(screen.getByText('Page 2'));
    });
    expect(mockPush).toHaveBeenCalledWith('/page/page-2');
  });

  // ==================== FAB Button Accessibility ====================

  it('FAB button has title and aria-label attributes', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const fab = screen.getByLabelText('新しいページを作成');
    expect(fab.tagName).toBe('BUTTON');
    expect(fab.getAttribute('title')).toBe('新しいページを作成');
  });

  // ==================== Tab tabIndex Management ====================

  it('manages tabIndex correctly for WAI-ARIA tabs', async () => {
    setupMocks();

    await act(async () => {
      render(<PageBoard />);
    });
    await act(async () => {});

    const recentTab = screen.getByRole('tab', { name: '最新' });
    const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });

    // Active tab has tabIndex 0, inactive has -1
    expect(recentTab.getAttribute('tabindex')).toBe('0');
    expect(archiveTab.getAttribute('tabindex')).toBe('-1');

    // Switch tab
    await act(async () => {
      fireEvent.click(archiveTab);
    });

    expect(recentTab.getAttribute('tabindex')).toBe('-1');
    expect(archiveTab.getAttribute('tabindex')).toBe('0');
  });
});
