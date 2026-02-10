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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    it('hides search field when 5 or fewer pages exist', async () => {
      mockPages = makePages(5);
      await renderSidebar();

      expect(screen.queryByLabelText('ページを検索')).toBeNull();
    });

    it('shows search field when more than 5 pages exist', async () => {
      mockPages = makePages(6);
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
      mockPages = makePages(6);
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
      mockPages = makePages(6);
      await renderSidebar();

      const searchInput = screen.getByLabelText('ページを検索');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Page 1' } });
      });
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '' } });
      });

      for (let i = 1; i <= 6; i++) {
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

      expect(
        screen.getByText('ページがありません。新しいページを作成しましょう。'),
      ).toBeTruthy();
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
});
