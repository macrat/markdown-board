// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import Sidebar from '@/components/Sidebar';
import type { PageListItem, ArchiveListItem } from '@/lib/types';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'current-page-id' }),
}));

let mockPages: PageListItem[] = [];
let mockArchives: ArchiveListItem[] = [];
let mockToast = { visible: false, pageId: '', pageTitle: '' };

// Stable function references to avoid infinite re-renders via useEffect deps
const stablePageListFns = {
  fetchPages: vi.fn().mockResolvedValue(undefined),
  createPage: vi.fn().mockResolvedValue('new-id'),
  removePage: vi.fn(),
  addPage: vi.fn(),
  findPage: vi.fn(),
};

const stableArchiveFns = {
  fetchArchives: vi.fn().mockResolvedValue(undefined),
  archivePage: vi.fn().mockResolvedValue('2024-01-01'),
  unarchivePage: vi.fn().mockResolvedValue(true),
  addArchive: vi.fn(),
  removeArchive: vi.fn(),
  findArchive: vi.fn(),
};

const stableAnimatingFns = {
  startFadeOut: vi.fn(),
  startFadeIn: vi.fn(),
  clearAnimation: vi.fn(),
  getItemOpacity: () => 1,
};

const stableToastFns = {
  showToast: vi.fn(),
  hideToast: vi.fn(),
};

vi.mock('@/hooks/usePageList', () => ({
  usePageList: () => ({
    pages: mockPages,
    ...stablePageListFns,
  }),
}));

vi.mock('@/hooks/useArchives', () => ({
  useArchives: () => ({
    archives: mockArchives,
    ...stableArchiveFns,
  }),
}));

vi.mock('@/hooks/useAnimatingItems', () => ({
  useAnimatingItems: () => stableAnimatingFns,
}));

vi.mock('@/hooks/useArchiveToast', () => ({
  useArchiveToast: () => ({
    toast: mockToast,
    ...stableToastFns,
  }),
}));

const now = Date.now();

function makePages(count: number): PageListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `page-${i + 1}`,
    title: `Page ${i + 1}`,
    created_at: now - (count - i) * 60000,
    updated_at: now - (count - i) * 60000,
  }));
}

function makeArchives(count: number): ArchiveListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `archive-${i + 1}`,
    title: `Archived ${i + 1}`,
    created_at: now - (count - i) * 60000,
    updated_at: now - (count - i) * 60000,
    archived_at: now - i * 60000,
  }));
}

async function renderSidebar() {
  await act(async () => {
    render(<Sidebar />);
  });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockPages = [];
  mockArchives = [];
  mockToast = { visible: false, pageId: '', pageTitle: '' };
});

describe('Sidebar', () => {
  describe('create button', () => {
    it('renders with correct title and aria-label', async () => {
      await renderSidebar();

      const button = screen.getByTitle('新しいページを作成');
      expect(button).toBeTruthy();
      expect(button.getAttribute('aria-label')).toBe('新しいページを作成');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('tab switching', () => {
    it('shows latest tab as active by default', async () => {
      await renderSidebar();

      const latestTab = screen.getByRole('tab', { name: '最新' });
      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });

      expect(latestTab.getAttribute('aria-selected')).toBe('true');
      expect(latestTab.getAttribute('tabindex')).toBe('0');
      expect(archiveTab.getAttribute('aria-selected')).toBe('false');
      expect(archiveTab.getAttribute('tabindex')).toBe('-1');
    });

    it('switches to archive tab on click', async () => {
      mockArchives = makeArchives(2);
      await renderSidebar();

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      await act(async () => {
        fireEvent.click(archiveTab);
      });

      expect(archiveTab.getAttribute('aria-selected')).toBe('true');
      expect(archiveTab.getAttribute('tabindex')).toBe('0');

      const latestTab = screen.getByRole('tab', { name: '最新' });
      expect(latestTab.getAttribute('aria-selected')).toBe('false');
      expect(latestTab.getAttribute('tabindex')).toBe('-1');
    });

    it('shows archive panel content when archive tab is active', async () => {
      mockArchives = makeArchives(1);
      await renderSidebar();

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      await act(async () => {
        fireEvent.click(archiveTab);
      });

      expect(screen.getByText('30日間保持されます')).toBeTruthy();
    });

    it('switches back to latest tab on click', async () => {
      await renderSidebar();

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      const latestTab = screen.getByRole('tab', { name: '最新' });

      await act(async () => {
        fireEvent.click(archiveTab);
      });
      await act(async () => {
        fireEvent.click(latestTab);
      });

      expect(latestTab.getAttribute('aria-selected')).toBe('true');
      expect(archiveTab.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('arrow key navigation (WAI-ARIA)', () => {
    it('switches to archive tab on ArrowRight from latest tab', async () => {
      await renderSidebar();

      const latestTab = screen.getByRole('tab', { name: '最新' });
      await act(async () => {
        fireEvent.keyDown(latestTab, { key: 'ArrowRight' });
      });

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      expect(archiveTab.getAttribute('aria-selected')).toBe('true');
      expect(archiveTab.getAttribute('tabindex')).toBe('0');
      expect(latestTab.getAttribute('tabindex')).toBe('-1');
    });

    it('switches to latest tab on ArrowLeft from archive tab', async () => {
      await renderSidebar();

      // First switch to archive
      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      await act(async () => {
        fireEvent.click(archiveTab);
      });

      // Now press ArrowLeft
      await act(async () => {
        fireEvent.keyDown(archiveTab, { key: 'ArrowLeft' });
      });

      const latestTab = screen.getByRole('tab', { name: '最新' });
      expect(latestTab.getAttribute('aria-selected')).toBe('true');
      expect(latestTab.getAttribute('tabindex')).toBe('0');
      expect(archiveTab.getAttribute('tabindex')).toBe('-1');
    });

    it('ArrowLeft on latest tab switches to archive tab', async () => {
      await renderSidebar();

      const latestTab = screen.getByRole('tab', { name: '最新' });
      await act(async () => {
        fireEvent.keyDown(latestTab, { key: 'ArrowLeft' });
      });

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      expect(archiveTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('ARIA structure', () => {
    it('has tablist role on tab container', async () => {
      await renderSidebar();

      expect(screen.getByRole('tablist')).toBeTruthy();
    });

    it('has tab roles with aria-controls linking to tabpanels', async () => {
      await renderSidebar();

      const latestTab = screen.getByRole('tab', { name: '最新' });
      expect(latestTab.getAttribute('aria-controls')).toBe('tabpanel-latest');

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      expect(archiveTab.getAttribute('aria-controls')).toBe('tabpanel-archive');
    });

    it('has tabpanel role with aria-labelledby on content', async () => {
      await renderSidebar();

      const panel = screen.getByRole('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe('tab-latest');
    });
  });

  describe('search', () => {
    it('shows search field even when no pages exist', async () => {
      mockPages = [];
      await renderSidebar();

      expect(screen.getByLabelText('ページを検索')).toBeTruthy();
    });

    it('shows search field regardless of page count', async () => {
      mockPages = makePages(2);
      await renderSidebar();

      expect(screen.getByLabelText('ページを検索')).toBeTruthy();
    });

    it('filters pages by search query', async () => {
      mockPages = makePages(6);
      await renderSidebar();

      const searchInput = screen.getByLabelText('ページを検索');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Page 1' } });
      });

      // "Page 1" and "Page 10" etc. would match, but we only have 6 pages
      // "Page 1" matches exactly "Page 1"
      expect(screen.getByText('Page 1')).toBeTruthy();
      expect(screen.queryByText('Page 2')).toBeNull();
    });

    it('shows no-results message when search matches nothing', async () => {
      mockPages = makePages(3);
      await renderSidebar();

      const searchInput = screen.getByLabelText('ページを検索');
      await act(async () => {
        fireEvent.change(searchInput, {
          target: { value: 'zzz-nonexistent' },
        });
      });

      expect(screen.getByText('一致するページが見つかりません。')).toBeTruthy();
    });

    it('shows all pages when search is cleared', async () => {
      mockPages = makePages(4);
      await renderSidebar();

      const searchInput = screen.getByLabelText('ページを検索');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Page 1' } });
      });
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '' } });
      });

      for (let i = 1; i <= 4; i++) {
        expect(screen.getByText(`Page ${i}`)).toBeTruthy();
      }
    });
  });

  describe('page list rendering', () => {
    it('renders page items with correct data-testid', async () => {
      mockPages = makePages(2);
      const { container } = await act(async () => render(<Sidebar />));

      expect(
        container.querySelector('[data-testid="page-item-page-1"]'),
      ).toBeTruthy();
      expect(
        container.querySelector('[data-testid="page-item-page-2"]'),
      ).toBeTruthy();
    });

    it('renders archive items with correct data-testid', async () => {
      mockArchives = makeArchives(2);
      const { container } = await act(async () => render(<Sidebar />));

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      await act(async () => {
        fireEvent.click(archiveTab);
      });

      expect(
        container.querySelector('[data-testid="archive-item-archive-1"]'),
      ).toBeTruthy();
      expect(
        container.querySelector('[data-testid="archive-item-archive-2"]'),
      ).toBeTruthy();
    });

    it('shows empty message when no pages exist', async () => {
      mockPages = [];
      await renderSidebar();

      expect(screen.getByText('ページがありません。')).toBeTruthy();
    });

    it('shows empty archive message when no archives exist', async () => {
      mockArchives = [];
      await renderSidebar();

      const archiveTab = screen.getByRole('tab', { name: 'アーカイブ' });
      await act(async () => {
        fireEvent.click(archiveTab);
      });

      expect(
        screen.getByText('アーカイブされたページはありません。'),
      ).toBeTruthy();
    });
  });

  describe('toast', () => {
    it('shows toast when toast.visible is true', async () => {
      mockToast = { visible: true, pageId: 'p1', pageTitle: 'My Page' };
      await renderSidebar();

      expect(screen.getByText('アーカイブしました')).toBeTruthy();
    });

    it('hides toast when toast.visible is false', async () => {
      mockToast = { visible: false, pageId: '', pageTitle: '' };
      await renderSidebar();

      expect(screen.queryByText('アーカイブしました')).toBeNull();
    });
  });

  describe('page navigation', () => {
    it('navigates to page when page item is clicked', async () => {
      mockPages = makePages(2);
      await renderSidebar();

      await act(async () => {
        fireEvent.click(screen.getByText('Page 1'));
      });

      expect(mockPush).toHaveBeenCalledWith('/p/page-1');
    });

    it('navigates to different pages independently', async () => {
      mockPages = makePages(3);
      await renderSidebar();

      await act(async () => {
        fireEvent.click(screen.getByText('Page 1'));
      });
      expect(mockPush).toHaveBeenCalledWith('/p/page-1');

      mockPush.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByText('Page 2'));
      });
      expect(mockPush).toHaveBeenCalledWith('/p/page-2');
    });
  });

  describe('create page', () => {
    it('creates new page and navigates to it', async () => {
      stablePageListFns.createPage.mockResolvedValue('new-page-id');
      await renderSidebar();

      const createButton = screen.getByTitle('新しいページを作成');
      await act(async () => {
        fireEvent.click(createButton);
      });

      expect(stablePageListFns.createPage).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/p/new-page-id');
    });

    it('does not navigate when createPage fails', async () => {
      stablePageListFns.createPage.mockResolvedValue(null);
      await renderSidebar();

      const createButton = screen.getByTitle('新しいページを作成');
      await act(async () => {
        fireEvent.click(createButton);
      });

      expect(stablePageListFns.createPage).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('archive operations', () => {
    it('archives a page: fadeOut → API → remove → add archive → toast', async () => {
      mockPages = makePages(1);
      stableAnimatingFns.startFadeOut.mockImplementation(
        (_id: string, cb: () => void) => cb(),
      );
      stablePageListFns.findPage.mockReturnValue(mockPages[0]);
      stableArchiveFns.archivePage.mockResolvedValue(now);
      await renderSidebar();

      const archiveButton = screen.getByLabelText('アーカイブする');
      await act(async () => {
        fireEvent.click(archiveButton);
      });

      expect(stableToastFns.hideToast).toHaveBeenCalled();
      expect(stableAnimatingFns.startFadeOut).toHaveBeenCalledWith(
        'page-1',
        expect.any(Function),
      );
      expect(stableArchiveFns.archivePage).toHaveBeenCalledWith('page-1');
      expect(stablePageListFns.removePage).toHaveBeenCalledWith('page-1');
      expect(stableArchiveFns.addArchive).toHaveBeenCalled();
      expect(stableToastFns.showToast).toHaveBeenCalledWith('page-1', 'Page 1');
    });

    it('cancels archive: unarchive → restore page → fade in', async () => {
      vi.useFakeTimers();
      const archivedPage = {
        id: 'page-1',
        title: 'Page 1',
        created_at: now,
        updated_at: now,
        archived_at: now,
      };
      stableArchiveFns.findArchive.mockReturnValue(archivedPage);
      stableArchiveFns.unarchivePage.mockResolvedValue(true);
      mockToast = { visible: true, pageId: 'page-1', pageTitle: 'Page 1' };
      await renderSidebar();

      const cancelButton = screen.getByText('キャンセル');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // Toast has an animation delay before calling onCancel
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(stableToastFns.hideToast).toHaveBeenCalled();
      expect(stableArchiveFns.findArchive).toHaveBeenCalledWith('page-1');
      expect(stablePageListFns.addPage).toHaveBeenCalled();
      expect(stableArchiveFns.removeArchive).toHaveBeenCalledWith('page-1');
      expect(stableAnimatingFns.startFadeIn).toHaveBeenCalledWith('page-1');
      expect(stableArchiveFns.unarchivePage).toHaveBeenCalledWith('page-1');

      vi.useRealTimers();
    });
  });
});
